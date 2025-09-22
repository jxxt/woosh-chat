# backend/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI()

# Allow frontend (Vite) to call backend
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins + ["*"],  # during dev, '*' is okay, but lock this down in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# import and include routers
from signup import router as signup_router
from login import router as login_router
from protected import router as protected_router

app.include_router(signup_router)
app.include_router(login_router)
app.include_router(protected_router)
