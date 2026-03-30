from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from sqlalchemy import text
from app.api.api import api_router
from app.db import session
from app.core.config import settings
from app.db.session import SessionLocal

app = FastAPI(
    title="Project Accounting API",
    description="API for the Automatic Project Accounting Monitoring App",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/")
def read_root():
    return {"message": "Welcome to Project Accounting API"}

@app.get("/health")
def health_check():
    try:
        db = SessionLocal()
        # Simple query to check if DB is reachable
        db.execute(text("SELECT 1"))
        db.close()
        return {"status": "online", "database": "connected (SQLite)"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

app.include_router(api_router, prefix=settings.API_V1_STR)
