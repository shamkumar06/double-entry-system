from fastapi import APIRouter
from app.api.endpoints import accounting, reports, projects, categories

api_router = APIRouter()
api_router.include_router(accounting.router, tags=["accounting"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
