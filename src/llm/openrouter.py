"""OpenAI-compatible LLM client using DeepSeek only.

This module exposes openrouter_chat for compatibility, but routes to DeepSeek.
"""

import os
import asyncio
import time
from openai import OpenAI
from typing import List, Dict, Tuple
import anyio


def _get_deepseek_client_and_model() -> tuple[OpenAI, str]:
    """Return (client, default_model) for DeepSeek.

    Requires DEEPSEEK_API_KEY. Base URL defaults to https://api.deepseek.com
    """
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    if not deepseek_key:
        raise RuntimeError("DEEPSEEK_API_KEY not set in environment")
    client = OpenAI(base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"), api_key=deepseek_key)
    default_model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
    return client, default_model


async def openrouter_chat(
    messages: List[Dict[str, str]],
    model: str = None
) -> Tuple[str, str]:
    """
    Send chat completion request to OpenRouter.
    
    Args:
        messages: List of message dicts with 'role' and 'content'
        model: Model name (defaults to OPENROUTER_MODEL env var)
        
    Returns:
        Tuple of (content, model_name)
    """
    # Build DeepSeek client
    try:
        client, default_model = _get_deepseek_client_and_model()
    except Exception as e:
        raise RuntimeError(f"Failed to create DeepSeek client: {str(e)}")

    model = model or default_model
    app_name = os.getenv("APP_NAME", "disease-ai")
    app_url = os.getenv("APP_URL", "https://your-app.example.com")
    
    # Timeout configuration (seconds)
    try:
        timeout_s = float(os.getenv("OPENROUTER_TIMEOUT", "15"))
    except Exception:
        timeout_s = 15.0

    try:
        # Configure retries
        try:
            max_retries = int(os.getenv("OPENROUTER_MAX_RETRIES", "3"))
        except Exception:
            max_retries = 3
        try:
            base_delay = float(os.getenv("OPENROUTER_RETRY_BASE_DELAY", "1.5"))
        except Exception:
            base_delay = 1.5

        # Run the blocking API call in a thread with a timeout and retries
        def _do_request():
            return client.chat.completions.create(
                extra_headers={
                    "HTTP-Referer": app_url,
                    "X-Title": app_name,
                },
                extra_body={},
                model=model,
                messages=messages,
                temperature=0.2,
            )

        attempt = 0
        while True:
            attempt += 1
            try:
                completion = await asyncio.wait_for(
                    anyio.to_thread.run_sync(_do_request, cancellable=True),
                    timeout=timeout_s,
                )
                break
            except asyncio.TimeoutError:
                # Timeouts are not retried here to respect overall latency target
                raise
            except Exception as e:
                msg = str(e)
                # Retry on 429 or rate-limit/provider temporary issues
                retriable = (
                    "429" in msg
                    or "rate" in msg.lower()
                    or "temporarily" in msg.lower()
                    or "Rate limit" in msg
                )
                if retriable and attempt <= max_retries:
                    # Exponential backoff with jitter
                    delay = base_delay * (2 ** (attempt - 1))
                    delay = min(delay, 10.0)
                    await asyncio.sleep(delay)
                    continue
                # Not retriable or retries exhausted
                raise
        
        content = completion.choices[0].message.content
        model_name = completion.model or model
        
        return content, model_name
    except asyncio.TimeoutError:
        raise RuntimeError("LLM API timeout")
    except Exception as e:
        error_msg = str(e)
        if "API key" in error_msg or "401" in error_msg or "Unauthorized" in error_msg:
            raise RuntimeError(
                f"LLM API authentication failed: {error_msg}. "
                "Please set DEEPSEEK_API_KEY in .env file."
            )
        raise RuntimeError(f"LLM API error: {error_msg}")

