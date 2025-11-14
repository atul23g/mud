"""Groq LLM client using OpenAI-compatible chat completions API."""

import os
from typing import List, Dict, Tuple
import httpx


async def groq_chat(messages: List[Dict[str, str]]) -> Tuple[str, str]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set in environment")
    model = os.getenv("GROQ_MODEL", "llama3-70b-8192")
    base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    url = f"{base_url.rstrip('/')}/chat/completions"

    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(url, json=body, headers=headers)
            if r.status_code != 200:
                try:
                    err = r.json()
                except Exception:
                    err = {"error": r.text[:200]}
                raise RuntimeError(f"HTTP {r.status_code}: {err}")
            data = r.json()
            choices = data.get("choices") or []
            if not choices:
                raise RuntimeError("No choices in Groq response")
            content = choices[0].get("message", {}).get("content", "")
            content = (content or "").strip()
            if not content:
                raise RuntimeError("Empty response from Groq")
            used_model = data.get("model") or model
            return content, used_model
    except Exception as e:
        raise RuntimeError(f"Groq API error: {e}")
