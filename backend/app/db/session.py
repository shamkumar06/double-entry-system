from sqlalchemy.orm import Session
from app.models.orm import SessionLocal, init_db
from app.core.config import settings
import logging

# Initialize SQL Database
try:
    init_db()
    logging.info("SQL database initialized successfully.")
except Exception as e:
    logging.error(f"Failed to initialize SQL database: {str(e)}")

def get_db():
    """Returns a new SQLAlchemy database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
