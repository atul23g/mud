"""Pydantic schemas for API request/response validation."""

from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from src.utils.enums import Task


# Feature schemas for each task
HEART_SCHEMA = {
    "age": "int",
    "sex": "int: {0,1}",
    "cp": "int: {0,1,2,3}",
    "trestbps": "float",
    "chol": "float",
    "fbs": "int: {0,1}",
    "restecg": "int: {0,1,2}",
    "thalach": "float",
    "exang": "int: {0,1}",
    "oldpeak": "float",
    "slope": "int: {0,1,2}",
    "ca": "int",
    "thal": "int: {0,1,2}"
}

DIABETES_SCHEMA = {
    "pregnancies": "int",
    "glucose": "float",
    "blood_pressure": "float",
    "skin_thickness": "float",
    "insulin": "float",
    "bmi": "float",
    "diabetes_pedigree_function": "float",
    "age": "int"
}

PARKINSONS_SCHEMA = {
    "fo": "float",
    "fhi": "float",
    "flo": "float",
    "jitter_percent": "float",
    "jitter_abs": "float",
    "rap": "float",
    "ppq": "float",
    "ddp": "float",
    "shimmer": "float",
    "shimmer_db": "float",
    "apq3": "float",
    "apq5": "float",
    "apq": "float",
    "dda": "float",
    "nhr": "float",
    "hnr": "float",
    "rpde": "float",
    "dfa": "float",
    "spread1": "float",
    "spread2": "float",
    "d2": "float",
    "ppe": "float"
}

ANEMIA_TAB_SCHEMA = {
    "hemoglobin": "float",
    "mcv": "float",
    "mch": "float",
    "mchc": "float",
    "gender": "str: {M,F}"
}

ANEMIA_IMG_SCHEMA = {
    "image_path": "str"
}


def schema_for(task: Task) -> Dict[str, str]:
    """Get feature schema for a task."""
    schemas = {
        Task.HEART: HEART_SCHEMA,
        Task.DIABETES: DIABETES_SCHEMA,
        Task.PARKINSONS: PARKINSONS_SCHEMA,
        Task.ANEMIA_TAB: ANEMIA_TAB_SCHEMA,
        Task.ANEMIA_IMG: ANEMIA_IMG_SCHEMA,
    }
    return schemas.get(task, {})


# Request/Response models
class FeatureSchemaResponse(BaseModel):
    """Response for feature schema endpoint."""
    task: Task
    feature_schema: Dict[str, str] = Field(alias="schema", serialization_alias="schema")
    
    model_config = {"populate_by_name": True}


class FeatureCompleteRequest(BaseModel):
    """Request to complete features with user inputs."""
    report_id: Optional[str] = None
    task: Task
    user_inputs: Dict[str, Any] = Field(default_factory=dict)


class FeatureCompleteResponse(BaseModel):
    """Response for feature completion."""
    features_ready: Dict[str, Any]
    still_missing: List[str]
    notes: List[str] = Field(default_factory=list)


class PredictWithFeaturesRequest(BaseModel):
    """Request for prediction with features."""
    task: Task
    features: Dict[str, Any]
    report_id: Optional[str] = None


class PredictWithFeaturesResponse(BaseModel):
    """Response for prediction."""
    task: Task
    label: int
    probability: float
    health_score: float
    top_contributors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    prediction_id: str


class TriageRequest(BaseModel):
    """Request for LLM triage."""
    task: Task
    features: Dict[str, Any]
    complaint: Optional[str] = None
    model_output: Optional[Dict[str, Any]] = None


class TriageResponse(BaseModel):
    """Response for LLM triage."""
    triage_summary: str
    followups: List[str] = Field(default_factory=list)
    model_name: str


class SessionSubmitRequest(BaseModel):
    """Request to submit session data."""
    report_id: Optional[str] = None
    task: str
    features: Dict[str, Any]
    prediction: Dict[str, Any]
    triage: Optional[Dict[str, Any]] = None
    complaint: Optional[str] = None
    prediction_id: Optional[str] = None


class SessionSubmitResponse(BaseModel):
    """Response for session submission."""
    ok: bool
    prediction_id: str

