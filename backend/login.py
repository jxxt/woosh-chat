# backend/login.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from argon2 import PasswordHasher, exceptions as argon2_exceptions
import os
import jwt
from _firebase import get_db_ref

router = APIRouter()

ph = PasswordHasher()
JWT_SECRET = os.environ.get("JWT_SECRET", "super_secure_random_secret_here_replace_this")

class LoginIn(BaseModel):
    email: EmailStr
    password: str

@router.post("/login")
async def login(body: LoginIn):
    email = body.email.strip().lower()
    password = body.password

    users_ref = get_db_ref("/users")
    users_snapshot = users_ref.get() or {}

    # find user by email
    found = None
    found_uid = None
    for uid, u in users_snapshot.items():
        if u.get("email") == email:
            found = u
            found_uid = uid
            break

    if not found:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    hashed = found.get("hashedPassword")
    try:
        ph.verify(hashed, password)
    except argon2_exceptions.VerifyMismatchError:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception:
        raise HTTPException(status_code=500, detail="Hash verification error")

    # Create JWT (no expiry per your requirement)
    payload = {"uid": found_uid, "email": email}
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

    return {"token": token}
