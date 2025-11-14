"""End-to-end pipeline: PDF → features → prediction."""

from pathlib import Path
from src.etl.pdf_ingest import pdf_to_text
from src.etl.report_parse import parse_text_to_pairs, coalesce_pairs
from src.etl.map_to_features import map_features
from src.models.inference_router import _load_tab
from src.models.predictor import run_prediction


def ingest_and_predict(task: str, pdf_path: str):
    """
    Ingest PDF and return prediction results.
    
    Args:
        task: Task name ('heart' or 'diabetes')
        pdf_path: Path to PDF file (can be string or Path object)
        
    Returns:
        dict: Prediction results with label, probability, health_score, etc.
    """
    from pathlib import Path
    
    # Convert to Path object if string
    if isinstance(pdf_path, str):
        pdf_path_obj = Path(pdf_path)
    else:
        pdf_path_obj = pdf_path
    
    # Resolve path if needed
    if not pdf_path_obj.exists() and not pdf_path_obj.is_absolute():
        project_root = Path(__file__).parent.parent.parent
        pdf_path_obj = project_root / pdf_path
    
    # Step 1: Extract text from PDF
    text = pdf_to_text(str(pdf_path_obj))
    
    if not text.strip():
        return {
            "error": "Could not extract text from PDF. The PDF might be image-based and require OCR (Tesseract).",
            "task": task,
            "suggestion": "Install Tesseract: brew install tesseract (macOS) or sudo apt-get install tesseract-ocr (Linux)"
        }
    
    # Step 2: Parse lab values
    pairs = parse_text_to_pairs(text)
    kv = coalesce_pairs(pairs)  # {lab_name: (value, unit)}
    
    # Step 3: Load model to get required features
    model, preproc, feats = _load_tab(task)
    
    # Step 4: Map parsed labs to model features
    feats_dict, missing, warnings = map_features(task, kv, feats)
    
    # Step 5: Run prediction
    out = run_prediction(task, feats_dict)
    
    # Step 6: Add metadata
    out.update({
        "missing_fields": missing,
        "warnings": warnings,
        "parsed_keys": list(kv.keys()),
        "extracted_text_length": len(text),
    })
    
    return out


if __name__ == "__main__":
    import json
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python -m src.etl.run_ingest <task> <pdf_path>")
        print("Example: python -m src.etl.run_ingest heart data/reports/sample.pdf")
        sys.exit(1)
    
    task = sys.argv[1]
    pdf = sys.argv[2]
    
    result = ingest_and_predict(task, pdf)
    print(json.dumps(result, indent=2))
