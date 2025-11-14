"""Test inference pipeline."""

import pytest
from src.models.inference_router import predict_tabular
from src.models.predictor import run_prediction


def test_heart_infer():
    """Test heart disease prediction."""
    row = {
        'age': [52],
        'sex': [1],
        'cp': [2],
        'trestbps': [130],
        'chol': [245],
        'fbs': [0],
        'restecg': [1],
        'thalach': [160],
        'exang': [0],
        'oldpeak': [1.4],
        'slope': [2],
        'ca': [0],








        
        'thal': [3]
    }
    
    out = predict_tabular("heart", row)
    assert "label" in out
    assert "probability" in out
    assert 0 <= out["probability"] <= 1
    assert out["label"] in [0, 1]


def test_diabetes_infer():
    """Test diabetes prediction."""
    row = {
        'Pregnancies': [2],
        'Glucose': [130],
        'BloodPressure': [80],
        'SkinThickness': [25],
        'Insulin': [130],
        'BMI': [30.5],
        'DiabetesPedigreeFunction': [0.45],
        'Age': [45]
    }
    
    out = predict_tabular("diabetes", row)
    assert "label" in out
    assert "probability" in out
    assert 0 <= out["probability"] <= 1
    assert out["label"] in [0, 1]


def test_heart_prediction_with_score():
    """Test heart prediction with health score."""
    row = {
        'age': [52],
        'sex': [1],
        'cp': [2],
        'trestbps': [130],
        'chol': [245],
        'fbs': [0],
        'restecg': [1],
        'thalach': [160],
        'exang': [0],
        'oldpeak': [1.4],
        'slope': [2],
        'ca': [0],
        'thal': [3]
    }
    
    out = run_prediction("heart", row)
    assert "task" in out
    assert "label" in out
    assert "probability" in out
    assert "health_score" in out
    assert "top_contributors" in out
    assert 0 <= out["health_score"] <= 100


def test_diabetes_prediction_with_score():
    """Test diabetes prediction with health score."""
    row = {
        'Pregnancies': [2],
        'Glucose': [130],
        'BloodPressure': [80],
        'SkinThickness': [25],
        'Insulin': [130],
        'BMI': [30.5],
        'DiabetesPedigreeFunction': [0.45],
        'Age': [45]
    }
    
    out = run_prediction("diabetes", row)
    assert "task" in out
    assert "label" in out
    assert "probability" in out
    assert "health_score" in out
    assert "top_contributors" in out
    assert 0 <= out["health_score"] <= 100
