from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import os

from app.db.session import get_db
from app.services.reports import generate_project_word_report

router = APIRouter()

class SubHeader(BaseModel):
    text: str = ""
    font_size: int = 12

class ReportRequest(BaseModel):
    project_id: int
    project_name: str = ""
    report_type: str = "Journal"
    phase_id: str = None
    account_name: str = ""
    date_format: str = "YYYY-MM-DD"
    sort_order: str = "Descending"
    sections: dict[str, bool] = None
    custom_header: str = ""
    sub_headers: list[SubHeader] = []
    footer_note: str = ""
    show_date_corner: bool = True
    columns: dict[str, list[str]] = None
    ledger_accounts: list[str] = []
    header_font_size: int = 26

@router.post("/generate", summary="Generate a Word report for a Project")
def generate_report(request: ReportRequest, db: Session = Depends(get_db)):
    """
    Generates a financial Word Document for a specific project
    by fetching data directly from SQLite and returns the file download.
    """
    try:
        file_path = generate_project_word_report(
            db=db,
            project_id=request.project_id,
            report_type=request.report_type,
            phase_id=request.phase_id,
            account_name=request.account_name,
            date_format=request.date_format,
            sort_order=request.sort_order,
            sections=request.sections,
            custom_header=request.custom_header,
            sub_headers=[sh.dict() for sh in request.sub_headers],
            footer_note=request.footer_note,
            show_date_corner=request.show_date_corner,
            columns=request.columns,
            ledger_accounts=request.ledger_accounts,
            header_font_size=request.header_font_size
        )
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=500, detail="Report generation failed")
            
        return FileResponse(
            path=file_path,
            filename=f"{request.report_type.replace(' ', '_')}_Report_{request.project_name or request.project_id}.docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
