"""Unified prediction function that combines inference and health scoring."""

from .inference_router import predict_tabular
from src.scoring.health_score import compute_score


def run_prediction(task: str, features: dict):
    """
    Run prediction and compute health score.
    
    Args:
        task: Task name ('heart', 'diabetes', or 'parkinsons')
        features: Dictionary of feature values (can be lists or scalars)
        
    Returns:
        dict: Prediction results with label, probability, health_score, top_contributors
    """
    # Get prediction from model
    pred = predict_tabular(task, features)
    
    # Clean features for health score calculation (extract from lists)
    features_clean = {}
    for k, v in features.items():
        if isinstance(v, list):
            features_clean[k] = v[0] if len(v) > 0 else None
        else:
            features_clean[k] = v
    
    # Compute health score
    score, top = compute_score(task, features_clean, pred["probability"])
    
    return {
        "task": task,
        "label": pred["label"],
        "probability": pred["probability"],
        "health_score": score,
        "top_contributors": [k for k, _ in top]
    }
