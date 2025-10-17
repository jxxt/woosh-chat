# backend/main.py
from chat import router as chat_router
from protected import router as protected_router
from login import router as login_router
from signup import router as signup_router
from messages import router as messages_router, cleanup_expired_messages
import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI()

# Allow frontend (Vite) to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Must be False when allow_origins is ["*"]
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# import and include routers

app.include_router(signup_router)
app.include_router(login_router)
app.include_router(protected_router)
app.include_router(chat_router)
app.include_router(messages_router)


@app.on_event("startup")
async def startup_event():
    """Start background task for cleaning up expired messages"""
    asyncio.create_task(cleanup_expired_messages())
