from fastapi import APIRouter, HTTPException, Depends
from typing import Any
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.orm import Category

router = APIRouter()

class CategoryCreate(BaseModel):
    name: str
    account_type: str = "Expense"  # Expense, Asset, Liability, Revenue

@router.get("/", summary="List all Categories")
def list_categories(db: Session = Depends(get_db)) -> Any:
    categories = db.query(Category).all()
    if not categories:
        return []
    return [{"id": str(c.code), "code": c.code, "name": c.name, "account_type": c.account_type} for c in categories]

@router.post("/", status_code=201, summary="Create a Category")
def create_category(category_in: CategoryCreate, db: Session = Depends(get_db)) -> Any:
    # 1. Prevent duplicates
    existing = db.query(Category).filter(Category.name.ilike(category_in.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Category '{category_in.name}' already exists")

    # 2. Assign Next Logical Code
    ranges = {"Asset": 1000, "Revenue": 4000, "Expense": 5000, "Liability": 3000, "Equity": 2000}
    start_code = ranges.get(category_in.account_type, 5000)
    
    existing_codes = [c.code for c in db.query(Category.code).filter(Category.code >= start_code, Category.code < start_code + 1000).all()]
    next_code = max(existing_codes + [start_code]) + 1

    new_cat = Category(
        code=next_code,
        name=category_in.name.strip(),
        account_type=category_in.account_type
    )
    db.add(new_cat)
    db.commit()
    return {"id": str(next_code), "code": next_code, "name": new_cat.name, "account_type": new_cat.account_type}

@router.put("/{category_code}", summary="Update a Category")
def rename_category(category_code: int, category_update: CategoryCreate, db: Session = Depends(get_db)) -> Any:
    category = db.query(Category).filter(Category.code == category_code).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    if category.name == category_update.name:
        return {"message": "No change needed", "code": category_code}

    category.name = category_update.name.strip()
    db.commit()
    
    return {
        "message": f"Category updated to '{category.name}'.",
        "code": category_code
    }
