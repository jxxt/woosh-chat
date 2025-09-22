# backend/protected.py
from fastapi import APIRouter, Request, HTTPException
import os
import jwt

router = APIRouter()

JWT_SECRET = os.environ.get("JWT_SECRET", "super_secure_random_secret_here_replace_this")

def verify_token_from_header(request: Request):
    auth = request.headers.get("Authorization")
    if not auth:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    parts = auth.split()
    if parts[0].lower() != "bearer" or len(parts) != 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = parts[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/protected")
async def protected_route(request: Request):
    payload = verify_token_from_header(request)
    # You can use payload['uid'] to fetch user-specific data
    return {"message": f"Hello {payload.get('email')}, this is protected data."}
