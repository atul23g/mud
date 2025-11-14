"""Normalize units (e.g., mmol/L → mg/dL)."""


def mmolL_to_mgdl(val, factor):
    """Convert mmol/L to mg/dL."""
    return val * factor


# Conversion factors: (lab_name, source_unit, target_unit) -> factor
CONV = {
    ("glucose", "mmol/l", "mg/dl"): 18.0,
    ("glucose", "mmol/l", "mg/dl"): 18.0,
    ("chol", "mmol/l", "mg/dl"): 38.67,
    ("cholesterol", "mmol/l", "mg/dl"): 38.67,
    ("hemoglobin", "g/l", "g/dl"): 0.1,
    ("hemoglobin", "mmol/l", "g/dl"): 1.611,  # Approximate
}


def normalize(lab: str, val: float, unit: str, target_unit: str):
    """
    Normalize unit to target unit.
    
    Args:
        lab: Lab name
        val: Value
        unit: Current unit
        target_unit: Target unit
        
    Returns:
        tuple: (normalized_value, normalized_unit)
    """
    if not unit or not target_unit:
        return val, unit or target_unit
    
    if unit.lower().replace(" ", "") == target_unit.lower().replace(" ", ""):
        return val, target_unit
    
    # Normalize unit strings
    unit_clean = unit.lower().replace(" ", "").replace("/", "/")
    target_clean = target_unit.lower().replace(" ", "").replace("/", "/")
    
    # Try exact match
    key = (lab.lower(), unit_clean, target_clean)
    if key in CONV:
        return mmolL_to_mgdl(val, CONV[key]), target_unit
    
    # Try without lab name (generic conversion)
    for (lab_key, src_unit, tgt_unit), factor in CONV.items():
        if src_unit == unit_clean and tgt_unit == target_clean:
            return val * factor, target_unit
    
    # Unknown conversion: return as-is
    return val, unit
