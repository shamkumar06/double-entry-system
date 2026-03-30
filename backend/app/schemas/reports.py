from pydantic import BaseModel, Field

class ReportRequest(BaseModel):
    project_name: str = Field(..., example="Alpha Construction")

class ReportResponse(BaseModel):
    message: str
    download_url: str
