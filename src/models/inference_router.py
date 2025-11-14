"""Lightweight model loader with caching for inference."""

import json
import joblib
import pickle
from functools import lru_cache
from pathlib import Path
import numpy as np
import pandas as pd

BASE = Path("outputs/models")


@lru_cache(maxsize=None)
def _load_tab(task: str):
    """
    Load model, scaler, and features for a given task.
    Cached for performance.
    
    Args:
        task: Task name ('heart', 'diabetes', or 'parkinsons')
        
    Returns:
        tuple: (model, scaler, features_list)
    """
    folder = BASE / task
    
    # Load model
    model_path = folder / "model.pkl"
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")
    
    # Try both joblib and pickle
    try:
        model = joblib.load(model_path)
    except:
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
    
    # Load scaler (if exists)
    scaler_path = folder / "scaler.pkl"
    scaler = None
    if scaler_path.exists():
        try:
            scaler = joblib.load(scaler_path)
        except:
            with open(scaler_path, 'rb') as f:
                scaler = pickle.load(f)
    
    # Load features list
    features_path = folder / "features.pkl"
    if features_path.exists():
        try:
            features = joblib.load(features_path)
        except:
            with open(features_path, 'rb') as f:
                features = pickle.load(f)
    else:
        # Fallback: use known feature lists
        if task == "heart":
            features = ['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 
                       'restecg', 'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal']
        elif task == "diabetes":
            features = ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
                       'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age']
        elif task == "parkinsons":
            features = ['fo', 'fhi', 'flo', 'Jitter_percent', 'Jitter_Abs', 'RAP', 'PPQ', 
                       'DDP', 'Shimmer', 'Shimmer_dB', 'APQ3', 'APQ5', 'APQ', 'DDA', 
                       'NHR', 'HNR', 'RPDE', 'DFA', 'spread1', 'spread2', 'D2', 'PPE']
        else:
            raise ValueError(f"Unknown task: {task}")
    
    # Convert to list if it's not already
    if isinstance(features, (np.ndarray, pd.Series)):
        features = features.tolist()
    elif not isinstance(features, list):
        features = list(features)
    
    return model, scaler, features


def _row_to_X(row: dict, feats: list):
    """
    Convert row dictionary to numpy array in correct feature order.
    
    Args:
        row: Dictionary of feature values
        feats: List of feature names in correct order
        
    Returns:
        numpy array: Feature array in correct order
    """
    # Handle list values (convert [value] to value)
    row_clean = {}
    for k, v in row.items():
        if isinstance(v, list) and len(v) > 0:
            row_clean[k] = v[0]
        else:
            row_clean[k] = v
    
    # Create array in correct feature order
    X = np.array([[row_clean.get(f, 0.0) for f in feats]], dtype=float)
    return X


def predict_tabular(task: str, row: dict):
    """
    Predict using tabular model.
    
    Args:
        task: Task name ('heart', 'diabetes', or 'parkinsons')
        row: Dictionary of feature values (can be lists or scalars)
        
    Returns:
        dict: Prediction results with 'label' and 'probability'
    """
    model, scaler, feats = _load_tab(task)
    
    # Convert row to feature array
    X = _row_to_X(row, feats)
    
    # Apply scaler if exists
    if scaler is not None:
        # Create DataFrame with feature names to avoid warnings
        try:
            X_df = pd.DataFrame(X, columns=feats)
            X_scaled = scaler.transform(X_df)
            X = X_scaled
        except Exception:
            # Fallback: transform without feature names
            X = scaler.transform(X)
    
    # Predict
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X)[0, 1]  # Get probability of positive class
        label = int(proba >= 0.5)
    elif hasattr(model, "decision_function"):
        score = model.decision_function(X)[0]
        proba = 1 / (1 + np.exp(-score))  # Convert to probability (sigmoid)
        label = int(proba >= 0.5)
    else:
        # Fallback: just predict class
        label = int(model.predict(X)[0])
        proba = float(label)  # Assume 1.0 if predicted positive, 0.0 if negative
    
    return {
        "label": label,
        "probability": float(proba)
    }
