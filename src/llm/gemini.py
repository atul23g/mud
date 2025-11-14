"""Gemini (Google Generative AI) client using REST API (v1beta)."""

import os
from typing import List, Dict, Tuple
import httpx


def _messages_to_prompt(messages: List[Dict[str, str]]) -> str:
    lines: List[str] = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


async def gemini_chat(messages: List[Dict[str, str]]) -> Tuple[str, str]:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY not set in environment")
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    prompt = _messages_to_prompt(messages)
    url = f"https://generativelanguage.googleapis.com/v1/models/{model_name}:generateContent?key={api_key}"
    body = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "topP": 0.9,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(url, json=body)
            if r.status_code != 200:
                try:
                    err = r.json()
                except Exception:
                    err = {"error": r.text[:200]}
                raise RuntimeError(f"HTTP {r.status_code}: {err}")
            data = r.json()
            cands = data.get("candidates") or []
            if not cands:
                raise RuntimeError("No candidates in Gemini response")
            parts = cands[0].get("content", {}).get("parts", [])
            text = "".join([p.get("text", "") for p in parts])
            text = (text or "").strip()
            if not text:
                raise RuntimeError("Empty response from Gemini")
            return text, model_name
    except Exception as e:
        raise RuntimeError(f"Gemini API error: {e}")
