"""Tests for health score calculation (Phase 8)."""

import pytest
from src.scoring.health_score import compute_score


def test_diabetes_score_inrange_lowrisk():
    """Test diabetes score with in-range features and low risk."""
    features = {
        "glucose": 95,
        "hba1c": 5.3,
        "bmi": 22,
        "blood_pressure": 100
    }
    score, breakdown = compute_score("diabetes", features, risk_proba=0.1)
    assert 85 <= score <= 100
    assert isinstance(score, float)


def test_heart_score_outofrange():
    """Test heart score with out-of-range cholesterol."""
    features = {
        "chol": 280,  # High cholesterol
        "trestbps": 140,  # Slightly high BP
        "thalach": 160,
        "oldpeak": 1.4
    }
    score, breakdown = compute_score("heart", features, risk_proba=0.5)
    assert 0 <= score <= 100
    # Should have penalties
    assert len(breakdown) > 0


def test_score_blend_check():
    """Test that higher risk_proba results in lower score."""
    features = {"glucose": 95, "bmi": 22}
    
    score_low_risk, _ = compute_score("diabetes", features, risk_proba=0.1)
    score_high_risk, _ = compute_score("diabetes", features, risk_proba=0.8)
    
    assert score_low_risk > score_high_risk


def test_score_missing_features():
    """Test that missing features don't crash."""
    features = {}  # Empty features
    score, breakdown = compute_score("diabetes", features, risk_proba=0.5)
    assert 0 <= score <= 100
    # Should mostly reflect model risk when no features
    assert score < 70  # Since risk_proba is 0.5, score should be around 50


def test_score_deterministic():
    """Test that score is deterministic (same inputs = same output)."""
    features = {"glucose": 120, "bmi": 25, "hba1c": 6.0}
    
    score1, _ = compute_score("diabetes", features, risk_proba=0.3)
    score2, _ = compute_score("diabetes", features, risk_proba=0.3)
    
    assert score1 == score2


def test_score_clamped():
    """Test that score is always between 0 and 100."""
    # Test with extreme values
    features = {"glucose": 500, "bmi": 50}  # Extreme values
    score, _ = compute_score("diabetes", features, risk_proba=0.99)
    assert 0 <= score <= 100
    
    # Test with perfect values
    features = {"glucose": 85, "bmi": 22}  # Perfect values
    score, _ = compute_score("diabetes", features, risk_proba=0.01)
    assert 0 <= score <= 100


