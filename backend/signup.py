# backend/signup.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from argon2 import PasswordHasher, exceptions as argon2_exceptions
from _firebase import get_db_ref

router = APIRouter()

ph = PasswordHasher()

class SignupIn(BaseModel):
    email: EmailStr
    password: str

@router.post("/signup")
async def signup(body: SignupIn):
    email = body.email.strip().lower()
    password = body.password

    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # check if user already exists
    users_ref = get_db_ref("/users")
    # read all users and check for email match (simple approach)
    users_snapshot = users_ref.get() or {}
    for uid, u in users_snapshot.items():
        if u.get("email") == email:
            raise HTTPException(status_code=400, detail="Email already registered")

    # hash password with Argon2
    hashed = ph.hash(password)

    # generate simple user id (push key)
    user_ref = users_ref.push()
    user_ref.set({
        "email": email,
        "hashedPassword": hashed
    })

    return {"success": True, "uid": user_ref.key}
