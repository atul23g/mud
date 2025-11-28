"""PDF ingestion endpoint (Phase 6 + 7)."""

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from src.api.deps import get_user_id
from src.db.client import prisma
from prisma import Json
from src.utils.enums import Task
from pathlib import Path
import tempfile
import os
import json
from openai import OpenAI
from src.llm.prompts import load_ranges

router = APIRouter()


def _strip_nulls(obj):
    """Recursively remove null bytes from strings within nested structures."""
    try:
        if obj is None:
            return None
        if isinstance(obj, str):
            # Remove \x00 which Postgres cannot store in text/JSON
            return obj.replace("\x00", "")
        if isinstance(obj, (int, float, bool)):
            return obj
        if isinstance(obj, list):
            return [_strip_nulls(x) for x in obj]
        if isinstance(obj, tuple):
            return tuple(_strip_nulls(x) for x in obj)
        if isinstance(obj, dict):
            return {k: _strip_nulls(v) for k, v in obj.items()}
    except Exception:
        pass
    return obj

@router.post("/report")
async def ingest_report(
    file: UploadFile = File(...),
    task: str = Query("heart"),
    user_id: str = Depends(get_user_id)
):
    """
    Upload PDF report and extract features.
    
    Returns extracted features, missing fields, and report_id for later completion.
    """
    # Normalize and validate task parameter to handle trailing whitespace/newlines
    task_input = (task or "").strip().lower()
    try:
        task_enum = Task(task_input)
    except Exception:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid task '{task}'. Expected one of: {[t.value for t in Task]}"
        )
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name
    
    try:
        from src.etl.pdf_ingest import pdf_to_text
        from src.etl.map_to_features import map_features
        from src.models.inference_router import _load_tab

        text = pdf_to_text(tmp_path)
        ocr_tokens = {}
        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="Could not extract text from PDF. Ensure the PDF is readable."
            )

        client = OpenAI()
        system = (
            "You are a medical report extraction expert. Extract ALL medical test values from lab reports "
            "and return them as strict JSON. Be flexible with naming conventions - different labs use different names. "
            "Always normalize to canonical medical terms. "
            "Output only JSON with a 'pairs' array where each item has: "
            "name (canonical snake_case), value (number or string), unit (string or ''), "
            "confidence (0-1 based on how clear the value is)."
        )
        
        # Build comprehensive examples and aliases for common tests
        task_specific_guidance = {
            "heart": (
                "For heart health, extract:\n"
                "- Blood Pressure: 'trestbps' (systolic), 'blood_pressure_diastolic' (diastolic) - look for BP, Blood Pressure, Systolic BP\n"
                "- Cholesterol: 'chol' (total), 'hdl', 'ldl', 'triglycerides' - may be labeled as Chol, Cholesterol, HDL-C, LDL-C, TG, VLDL\n"
                "- Fasting Blood Sugar: 'fbs' - MAP 'Fasting Blood Sugar', 'FBS', 'Fasting Glucose', 'Blood Glucose (F)' -> 'fbs'\n"
                "- Heart Rate: 'thalach' (max), 'resting_heart_rate' - look for HR, Heart Rate, Pulse, Max HR, Peak Heart Rate\n"
                "- ECG Results: 'restecg' - look for ECG, EKG, Resting ECG\n"
                "- Exercise metrics: 'oldpeak' (ST Depression), 'slope' (ST Slope) - look for ST Depression, ST Slope\n"
                "- Other: 'ca' (calcium score/major vessels), 'thal' (thalassemia), 'exang' (exercise angina)\n"
                "- Blood tests: 'hemoglobin' (Hb, HGB), 'wbc' (WBC, White Blood Cells), 'platelets' (PLT)\n"
                "CRITICAL: After extracting these specific fields, extract ALL other medical values found in the report (e.g., Blood Count, Liver Function, Kidney Function, etc.) as well."
            ),
            "diabetes": (
                "For diabetes, extract:\n"
                "- Blood Glucose: 'Glucose' - CRITICAL: MAP 'Fasting Blood Sugar', 'FBS', 'RBS', 'Random Blood Sugar', 'Blood Glucose', 'Plasma Glucose' -> 'Glucose'\n"
                "- Blood Pressure: 'BloodPressure' - systolic value, look for BP, Blood Pressure, Systolic BP\n"
                "- BMI/Body: 'BMI' - Body Mass Index, Quetelet Index, or calculate from height/weight\n"
                "- Insulin: 'Insulin' - CRITICAL: MAP 'Serum Insulin', 'Insulin Level', 'Fasting Insulin' -> 'Insulin'\n"
                "- Skin: 'SkinThickness' - look for 'Skin Fold', 'Triceps Skin Fold'\n"
                "- Pregnancies: 'Pregnancies' - look for 'Number of Pregnancies', 'Gravida', 'Para'\n"
                "- Family History: 'DiabetesPedigreeFunction' - look for 'DPF', 'Diabetes Pedigree', 'Family History Score'\n"
                "- Age: 'Age' - patient age in years\n"
                "CRITICAL: After extracting these specific fields, extract ALL other medical values found in the report (e.g., Blood Count, Liver Function, Kidney Function, etc.) as well."
            ),
            "general": (
                "Extract ALL medical values found. Use descriptive canonical names for:\n"
                "- Blood counts: hemoglobin, wbc, rbc, platelets, hematocrit, neutrophils, lymphocytes\n"
                "- Metabolic: glucose (MAP ALL GLUCOSE TERMS HERE), cholesterol, hdl, ldl, triglycerides, creatinine, urea, bilirubin\n"
                "- Liver: sgpt, sgot, alp, albumin, globulin\n"
                "- Thyroid: tsh, t3, t4\n"
                "- Vitamins: vitamin_d, vitamin_b12, iron, ferritin\n"
                "- Vitals: blood_pressure, heart_rate, temperature, weight, height, bmi, age"
            )
        }
        
        guidance = task_specific_guidance.get(task_enum.value, task_specific_guidance["general"])
        
        user = (
            f"Task: {task_enum.value}\n\n"
            f"{guidance}\n\n"
            "IMPORTANT INSTRUCTIONS:\n"
            "1. Look for values even if the naming is different (e.g., 'Haemoglobin' vs 'Hemoglobin', 'TC' vs 'Total Count')\n"
            "2. Extract numeric values only - ignore reference ranges\n"
            "3. If a value has multiple measurements, use the actual measured value (not the reference range)\n"
            "4. Set confidence to 0.9+ if the value is clearly stated, 0.5-0.8 if uncertain\n"
            "5. Include units exactly as shown (e.g., 'g/dL', 'mg/dL', 'mmHg', '%', 'cells/cumm')\n"
            "6. For ratios or fractions, extract the decimal value\n"
            "7. MAPPING RULE: Always map specific lab terms to the canonical keys listed above (e.g. 'FBS' -> 'Glucose', 'Serum Insulin' -> 'Insulin')\n\n"
            "Report text (first 20000 chars):\n\n"
            + text[:20000]
        )
        try:
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,  # Lower temperature for more consistent extraction
            )
            content_str = resp.choices[0].message.content or "{}"
            parsed_json = json.loads(content_str)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"LLM extraction failed: {str(e)}")

        pairs = parsed_json.get("pairs", []) if isinstance(parsed_json, dict) else []
        kv = {}
        for item in pairs:
            try:
                n = str(item.get("name", "")).lower().strip()
                v = item.get("value")
                u = item.get("unit") or ""
                if n:
                    kv[n] = (v, u)
            except Exception:
                pass

        extraction_methods = ["llm_openai"]
        feats_dict = {}
        extracted_meta = {}
        
        # If general mode, skip model feature mapping and return all parsed pairs
        if task_enum == Task.GENERAL:
            for k, tup in kv.items():
                try:
                    feats_dict[k] = float(tup[0])
                except Exception:
                    feats_dict[k] = tup[0]
            missing = []
            warnings = []
            feats = list(feats_dict.keys())
        else:
            try:
                model, preproc, feats = _load_tab(task_enum.value)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to load model for task {task_enum.value}: {str(e)}")
            feats_dict, missing, warnings = map_features(task_enum.value, kv, feats)

        ranges = load_ranges(task_enum.value)
        extracted_meta = {}
        try:
            for f in feats:
                val = feats_dict.get(f)
                source = 'llm' if f.lower() in kv else 'imputed'
                confidence = 0.93 if source == 'llm' else 0.5
                unit = None
                if f.lower() in kv:
                    tup = kv.get(f.lower())
                    if isinstance(tup, (tuple, list)) and len(tup) >= 2:
                        unit = tup[1]
                rng = None
                out_of_range = False
                try:
                    r = ranges.get(f) or ranges.get(f.lower())
                    if isinstance(r, dict):
                        mn = r.get('min')
                        mx = r.get('max')
                        rng = {'min': mn, 'max': mx}
                        if isinstance(val, (int, float)):
                            if mn is not None and val < mn:
                                out_of_range = True
                            if mx is not None and val > mx:
                                out_of_range = True
                except Exception:
                    pass
                extracted_meta[f] = {
                    'value': val,
                    'unit': unit,
                    'confidence': confidence,
                    'source': source,
                    'normal_range': rng,
                    'out_of_range': out_of_range,
                }
        except Exception:
            extracted_meta = {k: {'value': v, 'confidence': 0.5, 'source': 'unknown'} for k, v in (feats_dict or {}).items()}
        
        # Ensure Profile exists for user (required relation)
        try:
            await prisma.profile.upsert(
                where={"userId": user_id},
                data={
                    "create": {"userId": user_id},
                    "update": {}
                }
            )
        except Exception as e:
            # Do not proceed without a related Profile
            raise HTTPException(
                status_code=500,
                detail=f"Failed to ensure user profile: {str(e)}"
            )
        
        # Create report record in database
        # Prisma JSON fields accept Python dict/list directly
        try:
            # Convert to JSON-serializable format
            extracted_json = json.loads(json.dumps(feats_dict)) if feats_dict else {}
            missing_json = json.loads(json.dumps(missing)) if missing else []
            warnings_json = json.loads(json.dumps(warnings)) if warnings else []
            
            # Sanitize to avoid Postgres "unsupported Unicode escape" (e.g., \u0000)
            safe_text = _strip_nulls(text)
            safe_tokens = _strip_nulls(ocr_tokens)

            report = await prisma.report.create(
                data={
                    "userId": user_id,
                    "task": task_enum.value,
                    "rawFilename": file.filename,
                    "extracted": Json(extracted_json),
                    "missingFields": Json(missing_json),
                    "warnings": Json(warnings_json),
                    # Persist artifacts for history and UI
                    "rawOCR": Json({"text": safe_text, "tokens": safe_tokens}),
                    "extractedMeta": Json(extracted_meta),
                }
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save report to database: {str(e)}"
            )
        
        out_of_range_fields = [k for k, v in extracted_meta.items() if isinstance(v, dict) and v.get('out_of_range')]
        return {
            "report_id": report.id,
            "extracted": feats_dict,
            "missing_fields": missing,
            "warnings": warnings,
            "extracted_meta": extracted_meta,
            "parsed_keys": list(kv.keys()),
            "extracted_text_length": len(text),
            "raw_text": text,
            "pages": len(ocr_tokens.get('pages', [])) if isinstance(ocr_tokens, dict) else 0,
            "task": task_enum.value,
            "extraction_methods": extraction_methods,
            "out_of_range_fields": out_of_range_fields,
            "out_of_range_fields": out_of_range_fields,
            "overall_confidence": 0.0,
            "all_extracted_values": kv
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing PDF: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

