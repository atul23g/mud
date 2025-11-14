"""LLM triage endpoints."""

from fastapi import APIRouter, Request, Depends
from src.api.schemas import TriageRequest, TriageResponse
from src.llm.gemini import gemini_chat
from src.llm.groq import groq_chat
from src.llm.prompts import triage_prompt, load_ranges
from src.api.deps import get_user_id
import os

router = APIRouter()


@router.post("", response_model=TriageResponse)
async def triage(
    req: TriageRequest,
    request: Request,
    user_id: str = Depends(get_user_id)
):
    """Get LLM triage explanation for prediction."""
    # Load reference ranges
    ranges = load_ranges(req.task.value)
    
    # Prepare model output if not provided
    model_output = req.model_output or {
        "label": "Not provided",
        "probability": "Not provided",
        "health_score": "Not provided"
    }
    
    # Generate prompt
    messages = triage_prompt(
        req.features,
        model_output,
        req.complaint,
        ranges
    )
    
    # Optional mock mode for testing end-to-end without external LLMs
    if os.getenv("TRIAGE_MOCK_LLM", "false").lower() == "true":
        keys = list(req.features.keys())[:5]
        parts = []
        if req.complaint:
            parts.append(f"Chief complaint: {req.complaint}")
        parts.append(f"Triage summary for {req.task.value} based on provided features.")
        if keys:
            parts.append("Key inputs: " + ", ".join(keys))
        if isinstance(model_output, dict) and model_output:
            label = model_output.get("label", "N/A")
            prob = model_output.get("probability", "N/A")
            hs = model_output.get("health_score", "N/A")
            parts.append(f"Model output: label={label}, probability={prob}, health_score={hs}")
        parts.append("Advice: Maintain a balanced diet, regular exercise, and routine check-ups. Monitor any new or worsening symptoms.")
        content = "\n".join(parts)
        followups = [
            f"Have you noticed any changes related to {k}?" for k in keys
        ] or [
            "Any recent changes in your health?",
            "Do you have any specific concerns to discuss?",
        ]
        return TriageResponse(
            triage_summary=content,
            followups=followups[:5],
            model_name="mock-llm"
        )

    # Call Gemini as primary LLM provider
    try:
        gem_content, gem_model = await gemini_chat(messages)
        lines = [ln.strip("- •").strip() for ln in gem_content.split("\n") if ln.strip()]
        followups = [
            ln for ln in lines
            if ln.lower().startswith("ask") or ln.endswith("?") or "?" in ln
        ][:5]
        return TriageResponse(
            triage_summary=gem_content,
            followups=followups,
            model_name=gem_model
        )
    except Exception:
        # Try Groq fallback
        try:
            groq_content, groq_model = await groq_chat(messages)
            lines = [ln.strip("- •").strip() for ln in groq_content.split("\n") if ln.strip()]
            followups = [
                ln for ln in lines
                if ln.lower().startswith("ask") or ln.endswith("?") or "?" in ln
            ][:5]
            return TriageResponse(
                triage_summary=groq_content,
                followups=followups,
                model_name=groq_model
            )
        except Exception:
            pass
        # Heuristic final fallback
        # Heuristic final fallback
        model_output = req.model_output or {}
        parts = []
        if req.complaint:
            parts.append(f"Chief complaint: {req.complaint}")
        parts.append(f"Triage summary for {req.task.value} based on provided features.")
        if req.features:
            keys = list(req.features.keys())[:5]
            parts.append("Key inputs: " + ", ".join(keys))
        if isinstance(model_output, dict) and model_output:
            label = model_output.get("label", "N/A")
            prob = model_output.get("probability", "N/A")
            hs = model_output.get("health_score", "N/A")
            parts.append(f"Model output: label={label}, probability={prob}, health_score={hs}")
        parts.append("Unable to contact LLM service; providing a concise heuristic summary. Consider clinical consultation if symptoms persist or worsen.")
        content = "\n".join(parts)
        followups = [
            f"Do you experience issues related to {k}?" for k in list(req.features.keys())[:5]
        ]
        return TriageResponse(
            triage_summary=content,
            followups=followups,
            model_name="local-fallback"
        )

