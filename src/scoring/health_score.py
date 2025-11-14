"""Health score computation from lab values and model risk (Phase 8 - Config-driven)."""

import json
import os
from pathlib import Path
from math import isfinite
from typing import Dict, Any, Tuple, List


def _load_config(task: str) -> Dict[str, Any]:
    """Load health score configuration for a task."""
    range_files = {
        "heart": "heart.json",
        "diabetes": "diabetes.json",
        "parkinsons": "parkinsons.json",
        "anemia_tab": "anemia.json",
    }
    
    fname = range_files.get(task)
    if not fname:
        return {}
    
    path = Path("src/config/ranges") / fname
    if path.exists():
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load config for {task}: {e}")
            return {}
    
    return {}


def _std_divisor(ideal_min: float, ideal_max: float) -> float:
    """Calculate standard divisor for z-score calculation."""
    span = max(ideal_max - ideal_min, 1e-6)
    return span / 2.0  # Simple default; can be per-lab from config


def _clamp(value: float, min_val: float, max_val: float) -> float:
    """Clamp value between min and max."""
    return max(min_val, min(value, max_val))


def compute_score(task: str, features: Dict[str, Any], risk_proba: float) -> Tuple[float, List[Tuple[str, float]]]:
    """
    Compute health score (0-100) from lab values and model risk.
    
    Args:
        task: Task name ('heart', 'diabetes', 'parkinsons', 'anemia_tab')
        features: Feature dictionary (canonical, before scaling)
        risk_proba: Model's probability of positive class (risk)
        
    Returns:
        Tuple of (score, breakdown) where score is 0-100 and breakdown is list of (feature, penalty)
    """
    cfg = _load_config(task)
    
    if not cfg:
        # Fallback: just use model risk if no config
        score = 100.0 * (1.0 - risk_proba)
        return round(score, 1), []
    
    penalty = 0.0
    breakdown = []
    
    # Process each configured feature
    for k, spec in cfg.items():
        # Get value from features (handle case variations)
        val = None
        for key in features.keys():
            if k.lower() == key.lower() or k.lower().replace("_", "") == key.lower().replace("_", ""):
                val = features[key]
                break
        
        if val is None:
            continue
        
        # Extract value from list if needed
        if isinstance(val, list):
            val = val[0] if len(val) > 0 else None
        
        if val is None:
            continue
        
        # Convert to float
        try:
            x = float(val)
            if not isfinite(x):
                continue
        except (ValueError, TypeError):
            continue
        
        # Get config values
        ideal_min = float(spec.get("ideal_min", 0))
        ideal_max = float(spec.get("ideal_max", 100))
        weight = float(spec.get("weight", 1.0))
        transform = spec.get("transform", "z")
        
        # If value is in ideal range, no penalty
        if ideal_min <= x <= ideal_max:
            continue
        
        # Calculate penalty based on transform type
        if transform == "z":
            # Z-score distance to nearest boundary
            sd = _std_divisor(ideal_min, ideal_max)
            nearest = ideal_min if x < ideal_min else ideal_max
            z = abs(x - nearest) / sd if sd > 0 else 0.0
            z = _clamp(z, 0.0, 3.0)  # Clip to max 3.0
            pen = weight * z
        else:
            # Fallback: absolute percentage deviation
            mid = (ideal_min + ideal_max) / 2
            span = max(ideal_max - ideal_min, 1e-6)
            perc_dev = abs(x - mid) / span
            pen = weight * _clamp(perc_dev, 0.0, 3.0)
        
        penalty += pen
        breakdown.append((k, round(pen, 2)))
    
    # Convert penalty to lab score (0-100)
    # Scale penalty: each unit of penalty reduces score by some factor
    score_labs = max(0.0, 100.0 - penalty * 5.0)
    score_labs = min(100.0, score_labs)
    
    # Convert model risk to score component
    model_component = max(0.0, 100.0 - 100.0 * float(risk_proba))
    
    # Blend: 70% labs + 30% model
    final = 0.7 * score_labs + 0.3 * model_component
    
    # Clamp to 0-100
    final = _clamp(final, 0.0, 100.0)
    
    # Sort breakdown by penalty (highest first)
    breakdown_sorted = sorted(breakdown, key=lambda x: -x[1])[:3]
    
    return round(final, 1), breakdown_sorted
