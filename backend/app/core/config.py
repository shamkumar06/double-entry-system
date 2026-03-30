import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Project Accounting API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # DB Configuration
    SQLALCHEMY_DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./finance.db")

settings = Settings()
