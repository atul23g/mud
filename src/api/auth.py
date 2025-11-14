"""Supabase JWT authentication middleware."""

from fastapi import Request, HTTPException
from jose import jwt
import httpx
import os
from functools import lru_cache


@lru_cache(maxsize=1)
def get_jwks():
    """Get JWKS from Supabase (cached)."""
    url = os.getenv("SUPABASE_JWKS_URL")
    if not url:
        raise RuntimeError("SUPABASE_JWKS_URL not set in environment")
    
    # Supabase JWKS endpoint requires apikey header
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    if not anon_key:
        raise RuntimeError("SUPABASE_ANON_KEY not set in environment. Required for JWKS access.")
    
    headers = {"apikey": anon_key}
    
    try:
        r = httpx.get(url, headers=headers, timeout=10)
        r.raise_for_status()
        jwks = r.json()
        
        # Validate JWKS structure
        if "keys" not in jwks:
            raise RuntimeError("Invalid JWKS response: missing 'keys' field")
        
        return jwks
    except httpx.HTTPStatusError as e:
        error_detail = f"HTTP {e.response.status_code}"
        try:
            error_body = e.response.json()
            error_detail += f": {error_body.get('message', 'Unknown error')}"
        except:
            error_detail += f": {e.response.text[:200]}"
        raise RuntimeError(f"Failed to fetch JWKS from {url}: {error_detail}")
    except Exception as e:
        raise RuntimeError(f"Failed to fetch JWKS: {e}")


def extract_user_id(token: str) -> str:
    """
    Extract user ID from JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        User ID from token payload
    """
    jwks = get_jwks()
    
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        
        # Find the key with matching kid
        key = next((k for k in jwks["keys"] if k["kid"] == kid), None)
        if not key:
            raise HTTPException(status_code=401, detail="Key not found in JWKS")
        
        # Decode token
        payload = jwt.decode(
            token,
            key,
            algorithms=[key["alg"]],
            audience=None,
            options={"verify_aud": False}
        )
        
        # Supabase user id is in 'sub' field
        user_id = payload.get("sub") or payload.get("user_metadata", {}).get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        return user_id
    except jwt.JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")


async def auth_middleware(request: Request, call_next):
    """
    FastAPI middleware to authenticate requests using Supabase JWT.
    
    Public endpoints (health, docs, openapi) are excluded from authentication.
    Can be disabled for testing by setting DISABLE_AUTH=true in environment.
    """
    # Public endpoints that don't require authentication
    public_paths = ["/health", "/openapi.json", "/docs", "/redoc", "/"]
    
    if any(request.url.path.startswith(path) for path in public_paths):
        return await call_next(request)
    
    # Check if auth is disabled for testing
    if os.getenv("DISABLE_AUTH", "false").lower() == "true":
        # Use a test user ID
        request.state.user_id = "test-user-123"
        return await call_next(request)
    
    # Check for Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header. Use 'Bearer <token>'. For testing, set DISABLE_AUTH=true in .env"
        )
    
    # Extract token
    token = auth_header.split(" ", 1)[1]
    
    # Validate token and extract user ID
    try:
        user_id = extract_user_id(token)
        request.state.user_id = user_id
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        # Provide helpful error message for JWKS fetch failures
        if "JWKS" in error_msg or "401" in error_msg:
            error_msg += ". Tip: For testing, set DISABLE_AUTH=true in .env to bypass authentication."
        raise HTTPException(status_code=401, detail=f"Authentication failed: {error_msg}")
    
    return await call_next(request)

