"""Feature merging utilities."""

from typing import Dict, Any, Tuple, List


def merge_features(
    extracted: Dict[str, Any],
    user_inputs: Dict[str, Any],
    prefer_user: bool = True
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Merge extracted features with user inputs.
    
    Args:
        extracted: Features extracted from PDF/report
        user_inputs: User-provided feature values
        prefer_user: If True, user inputs override extracted when both present
        
    Returns:
        Tuple of (merged_dict, still_missing_keys)
    """
    keys = set(extracted.keys()) | set(user_inputs.keys())
    merged = {}
    
    for k in keys:
        if prefer_user and k in user_inputs and user_inputs[k] not in (None, ""):
            merged[k] = user_inputs[k]
        elif k in extracted and extracted[k] not in (None, ""):
            merged[k] = extracted[k]
        elif not prefer_user and k in extracted and extracted[k] not in (None, ""):
            merged[k] = extracted[k]
        elif k in user_inputs and user_inputs[k] not in (None, ""):
            merged[k] = user_inputs[k]
        else:
            merged[k] = None
    
    still_missing = [k for k, v in merged.items() if v is None]
    return merged, still_missing


