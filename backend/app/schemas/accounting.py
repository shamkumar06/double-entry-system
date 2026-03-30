from pydantic import BaseModel, Field
from datetime import date
from typing import Optional

class TransactionCreate(BaseModel):
    project_name: str = Field(..., example="Website Redesign")
    project_id: int = Field(..., example=2001)
    phase_name: Optional[str] = Field(None, example="Phase 1")
    phase_id: Optional[str] = Field(None, example="01")
    category_name: str = Field(..., example="Software")
    category_id: int = Field(..., example=5001)
    amount: float = Field(..., gt=0.0)
    
    # From Details
    from_name: str = Field(..., example="John Doe")
    from_date: str = Field(..., example="2026-03-01T10:30")
    from_payment_mode: str = Field(..., example="UPI")
    from_reference: Optional[str] = Field(None, example="UPI-823812")
    
    # To Details
    to_name: str = Field(..., example="Jane Smith")
    to_date: str = Field(..., example="2026-03-01T10:35")
    to_payment_mode: str = Field(..., example="Bank")
    to_reference: Optional[str] = Field(None, example="TXN-982121")

    description: Optional[str] = Field(None, example="Monthly cloud hosting")
    receipt_url: Optional[str] = Field(None, example="https://storage.googleapis.com/.../receipt.png")
    material_image_url: Optional[str] = Field(None, example="https://storage.googleapis.com/.../material.jpg")

class TransactionResponse(BaseModel):
    id: str
    message: str

