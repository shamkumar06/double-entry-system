from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Any, Optional
import secrets
import mimetypes
import os

from app.schemas.accounting import TransactionCreate, TransactionResponse
from app.services.accounting import (
    create_transaction_service, 
    get_ledger_page, 
    get_trial_balance, 
    delete_transaction_service,
    get_journal,
    restore_transaction_service,
    list_deleted_service
)
from app.db.session import get_db

router = APIRouter()

@router.post("/transactions", response_model=TransactionResponse, status_code=201)
def create_transaction(
    *,
    db: Session = Depends(get_db),
    transaction_in: TransactionCreate,
) -> Any:
    """
    Create a new transaction and double-entry ledger records in the SQL database.
    """
    try:
        tx_id = create_transaction_service(db=db, transaction=transaction_in)
        return {"id": tx_id, "message": "Transaction created successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: str, 
    transaction_in: TransactionCreate,
    db: Session = Depends(get_db)
) -> Any:
    """
    Update a transaction by recalculating ledger entries and modifying project balances correctly.
    """
    try:
        # Reverse old transaction impacts and recreate with same ID
        delete_transaction_service(db=db, transaction_id=transaction_id)
        tx_id = create_transaction_service(db=db, transaction=transaction_in, tx_id=transaction_id)
        return {"id": tx_id, "message": "Transaction updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/upload_receipt", summary="Upload a Receipt Image")
async def upload_receipt(file: UploadFile = File(...)) -> Any:
    """
    Uploads an image locally and returns the URL.
    """
    try:
        file_extension = mimetypes.guess_extension(file.content_type) or ""
        blob_name = f"{secrets.token_hex(8)}{file_extension}"
        
        current_dir = os.path.dirname(os.path.abspath(__file__))
        app_dir = os.path.dirname(os.path.dirname(current_dir))
        upload_dir = os.path.join(app_dir, "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        
        file_path = os.path.join(upload_dir, blob_name)
        contents = await file.read()
        
        with open(file_path, "wb") as f:
            f.write(contents)
        
        return {"url": f"http://localhost:8000/uploads/{blob_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file local: {str(e)}")

@router.get("/journal")
def get_project_journal(
    project_id: int, 
    phase_id: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Any:
    try:
        journal = get_journal(db, project_id, phase_id)
        return journal
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ledger")
def get_account_ledger(
    project_id: int, 
    account_id: int, 
    phase_id: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Any:
    try:
        ledger = get_ledger_page(db, project_id, account_id, phase_id)
        return ledger
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trial-balance")
def get_project_trial_balance(
    project_id: int, 
    phase_id: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Any:
    try:
        tb = get_trial_balance(db, project_id, phase_id)
        return tb
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/phases/totals")
def get_phases_totals(
    project_id: int,
    db: Session = Depends(get_db)
) -> Any:
    """
    Returns summarized spending per phase using high-performance SQL aggregation.
    """
    try:
        # Sum non-revenue amounts grouped by phase_id
        # Excludes: Revenue, Liability, Equity (as these are inflows)
        totals = db.query(
            Transaction.phase_id,
            func.sum(Transaction.amount)
        ).filter(
            Transaction.project_id == project_id,
            Transaction.is_deleted == False,
            Transaction.account_type.notin_(["Revenue", "Liability", "Equity"])
        ).group_by(Transaction.phase_id).all()
        
        # Format for UI (id -> name mapping)
        # Fetch current mapping for phase names
        phases = {p.id: p.name for p in db.query(Phase).filter(Phase.project_id == project_id).all()}
        
        results = []
        for ph_id, spent in totals:
            results.append({
                "phase_name": phases.get(ph_id) or "Whole Project",
                "spent": float(spent or 0)
            })
            
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/transactions/{transaction_id}", summary="Delete a Transaction")
def delete_transaction(
    transaction_id: str,
    db: Session = Depends(get_db)
) -> Any:
    """
    Deletes a transaction and its associated ledger entries.
    """
    try:
        delete_transaction_service(db, transaction_id)
        return {"message": f"Transaction {transaction_id} moved to Recycle Bin"}
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recycle-bin", summary="List Deleted Transactions")
def list_deleted(
    project_id: int,
    db: Session = Depends(get_db)
) -> Any:
    """
    Lists transactions currently in the recycle bin for a project.
    """
    try:
        return list_deleted_service(db, project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recycle-bin/restore/{transaction_id}", summary="Restore a Transaction")
def restore_transaction(
    transaction_id: str,
    db: Session = Depends(get_db)
) -> Any:
    """
    Restores a transaction from the recycle bin and re-applies its balance changes.
    """
    try:
        restore_transaction_service(db, transaction_id)
        return {"message": "Transaction restored successfully"}
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
