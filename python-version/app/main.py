from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path, override=False)
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import dashboard as dashboard_router
from app.routers import leads as leads_router

app = FastAPI(title="AI-Assisted Lead Management System (Python)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

app.include_router(leads_router.router, prefix="")
app.include_router(dashboard_router.router, prefix="")


@app.get("/")
def root():
    return {
        "service": "python-lead-mgmt",
        "port": 8000,
        "docs": "/docs",
    }
