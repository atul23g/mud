"""Map parsed labs to model features with imputation and warnings."""

import json
from pathlib import Path
from .normalize_units import normalize

UNIT_CANON = {}
if Path("src/config/units.json").exists():
    UNIT_CANON = json.loads(Path("src/config/units.json").read_text())


def map_features(task: str, parsed: dict, required: list):
    """
    Map parsed lab values to model features.
    
    Args:
        task: Task name ('heart', 'diabetes')
        parsed: Dictionary of parsed labs {lab_name: (value, unit)}
        required: List of required feature names
        
    Returns:
        tuple: (features_dict, missing_list, warnings_list)
    """
    feats = {}
    missing = []
    warnings = []
    
    # First pass: build a canonical feature set from parsed labs
    # Canonical keys follow our internal model training names for heart: 
    # age, sex, cp, trestbps, chol, fbs, restecg, thalach, exang, oldpeak, slope, ca, thal
    canonical = {}
    for lab_name, (val, unit) in parsed.items():
        key = lab_name.lower()
        # Normalize unit to target if known
        target_unit = UNIT_CANON.get(key, "")
        v, u = normalize(key, val, unit, target_unit)
        canonical[key] = v

    # Alias map: alternate required names -> canonical keys
    alias_map = {
        # Heart alternate naming (Kaggle-style)
        "restingbp": "trestbps",
        "cholesterol": "chol",
        "fastingbs": "fbs",
        "maxhr": "thalach",
        "oldpeak": "oldpeak",
        "sex_m": "sex",
        "exerciseangina_y": "exang",
        "restingecg_normal": "restecg",
        "restingecg_st": "restecg",
        "st_slope_flat": "slope",
        "st_slope_up": "slope",
        "chestpaintype_ata": "cp",
        "chestpaintype_nap": "cp",
        "chestpaintype_ta": "cp",
    }

    # Now construct the output features exactly as required
    out = {}
    for f in required:
        fl = f.lower()
        # Direct canonical copy if present
        if fl in canonical:
            out[f] = canonical[fl]
            continue
        # Alias resolution
        if fl in alias_map:
            canon_key = alias_map[fl]
            val = canonical.get(canon_key)
            if val is not None:
                # Derive one-hots or boolean style features as needed
                if task == "heart":
                    if fl == "sex_m":
                        out[f] = 1 if int(val) == 1 else 0
                        continue
                    if fl == "exerciseangina_y":
                        out[f] = 1 if int(val) == 1 else 0
                        continue
                    if fl.startswith("chestpaintype_"):
                        # cp: 0=TA, 1=ATA, 2=NAP, 3=ASY
                        cp = int(val)
                        label = fl.split("_")[-1].upper()
                        mapping = {0: "TA", 1: "ATA", 2: "NAP", 3: "ASY"}
                        out[f] = 1 if mapping.get(cp) == label else 0
                        continue
                    if fl.startswith("restingecg_"):
                        # restecg: 0=Normal,1=ST,2=LVH (we only one-hot Normal/ST here)
                        recg = int(val)
                        label = fl.split("_")[-1].upper()
                        mapping = {0: "NORMAL", 1: "ST", 2: "LVH"}
                        out[f] = 1 if mapping.get(recg) == label else 0
                        continue
                    if fl.startswith("st_slope_"):
                        # slope: 0=Up,1=Flat,2=Down (we one-hot Up/Flat here)
                        sl = int(val)
                        label = fl.split("_")[-1].capitalize()
                        mapping = {0: "Up", 1: "Flat", 2: "Down"}
                        out[f] = 1 if mapping.get(sl) == label else 0
                        continue
                # Default: pass-through numeric copy (e.g., RestingBP -> trestbps)
                out[f] = val
                continue
        # If not found, mark missing
        out[f] = None
        missing.append(f)

    # Impute missing values (simple: use 0 or median defaults)
    # TODO: Use actual median values from training data
    imputation_defaults = {
        "heart": {
            "age": 54,
            "sex": 1,
            "cp": 1,
            "trestbps": 130,
            "chol": 246,
            "fbs": 0,
            "restecg": 0,
            "thalach": 150,
            "exang": 0,
            "oldpeak": 1.0,
            "slope": 1,
            "ca": 0,
            "thal": 2,
        },
        "diabetes": {
            "Pregnancies": 3,
            "Glucose": 120,
            "BloodPressure": 72,
            "SkinThickness": 23,
            "Insulin": 30,
            "BMI": 32.0,
            "DiabetesPedigreeFunction": 0.372,
            "Age": 29,
        }
    }
    
    defaults = imputation_defaults.get(task, {})
    for k in out:
        if out[k] is None:
            out[k] = defaults.get(k, 0.0)
            if k in missing:
                warnings.append(f"Missing field {k}, imputed with default value")

    return out, missing, warnings
