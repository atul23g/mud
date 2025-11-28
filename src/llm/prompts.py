"""LLM prompts for triage."""

from typing import Dict, Any, List, Optional
import json
import os
from pathlib import Path


def load_ranges(task: str) -> Dict[str, Any]:
    """Load reference ranges for a task."""
    # Try to load from config/ranges
    ranges_path = Path("src/config/ranges")
    
    range_files = {
        "heart": "heart.json",
        "diabetes": "diabetes.json",
        "anemia_tab": "anemia.json",
    }
    
    fname = range_files.get(task)
    if not fname:
        return {}
    
    path = ranges_path / fname
    if path.exists():
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    
    # Fallback: return empty dict
    return {}


def triage_prompt(
    features: Dict[str, Any],
    model_output: Dict[str, Any],
    complaint: Optional[str],
    ranges: Dict[str, Any]
) -> List[Dict[str, str]]:
    """
    Generate triage prompt for LLM.
    
    Args:
        features: Feature dictionary
        model_output: Model prediction output
        complaint: User complaint (optional)
        ranges: Reference ranges
        
    Returns:
        List of message dicts for chat completion
    """
    system_prompt = (
        "You are Dr. Intelligence, a caring and experienced medical consultant. "
        "Your goal is to have a natural, supportive conversation about the user's health. "
        
        "**Persona Guidelines**:\n"
        "1. **Be Human & Varied**: Speak naturally. Do NOT use rigid templates. Vary your opening and closing phrases.\n"
        "2. **Avoid Repetition**: NEVER start with 'Based on your medical information' or 'I see that'. Mix it up! Use phrases like 'Looking at your results...', 'It appears...', or jump straight into the insight.\n"
        "3. **Be Specific**: Reference their actual numbers (e.g., 'Your glucose is 105') so they know you're looking at *their* data.\n"
        "4. **Be Proactive**: If you see a risk, suggest a fix before they ask. Connect the dots between different results.\n"
        "5. **Tone**: Warm, professional, and encouraging. Like a doctor who knows you well.\n"
        
        "**Formatting**:\n"
        "Use markdown for readability (bullet points are good), but keep it looking like a chat message, not a formal report. "
        "Avoid unnecessary section headers unless the answer is long."
    )
    
    # Check if this is a follow-up question based on conversation context
    is_followup = False
    if complaint and len(complaint) > 50:  # Longer complaint likely includes conversation history
        is_followup = "Recent Conversation:" in complaint or "Patient:" in complaint
    
    if is_followup:
        user_prompt = f"""As Dr. Intelligence, continue the conversation naturally:

**Context**:
User's Question: {complaint.split('User Question:')[-1].strip() if 'User Question:' in complaint else complaint}

**Medical Data**:
{json.dumps(features, indent=2) if features else 'No specific lab data available'}

**Previous Analysis**:
{json.dumps(model_output, indent=2) if model_output else 'No previous analysis'}

**Instructions**:
1. **Answer Directly**: Address their specific question immediately. Don't waste time with long intros.
2. **Be Conversational**: Connect back to what you said before ("As I mentioned...", "Building on that...").
3. **New Info Only**: Don't repeat general advice. Give them something new and specific to their question.
4. **Actionable Advice**: Give 2-3 clear, practical tips they can use right now.
5. **Natural Tone**: Sound like a helpful human expert, not a robot. Avoid "It looks like..." or "I see that..." if you used them recently.

**Important**:
Educational only. Consult a doctor for medical advice.

**Length**: Keep it concise (6-10 lines). Focus on value."""
    else:
        user_prompt = f"""As Dr. Intelligence, give a warm, insightful medical analysis:

**Patient Query**: {complaint or 'General health consultation'}

**Clinical Data**:
{json.dumps(features, indent=2)}

**AI Analysis**:
{json.dumps(model_output, indent=2)}

**Reference Ranges**:
{json.dumps(ranges, indent=2) if ranges else 'Standard clinical ranges'}

**Instructions**:
1. **Start Fresh**: Open with a unique, personalized observation. Ex: "Your cholesterol levels caught my eye..." or "Overall, your heart health looks stable, but..."
2. **No Templates**: Do NOT start with "Based on your medical information" or "I have reviewed...". Be more casual and direct.
3. **Explain Clearly**: What do the numbers mean for *them*? Avoid medical jargon where possible.
4. **Action Plan**: Give 2-3 specific things they can do (diet, exercise, lifestyle).
5. **Next Steps**: What should they focus on before the next visit?

**Important**:
Educational only. Consult a doctor for medical advice.

**Length**: Concise and punchy (8-12 lines). Make every word count."""
    
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]


