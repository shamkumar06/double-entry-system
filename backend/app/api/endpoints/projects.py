from fastapi import APIRouter, HTTPException, Depends
from typing import Any, Optional, List
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.orm import Project, Phase, Transaction, Category
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    total_funds: float = 0.0
    logo_url: str = ""

class PhaseCreate(BaseModel):
    name: str
    description: str = ""
    allocated_funds: float = 0.0
    received_amount: float = 0.0
    is_received: bool = False
    received_from: str = ""
    received_to: str = ""
    payment_mode: str = ""
    reference: str = ""
    is_settled: bool = False

class PhaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    allocated_funds: Optional[float] = None
    received_amount: Optional[float] = None
    is_received: Optional[bool] = None
    received_from: Optional[str] = None
    received_to: Optional[str] = None
    payment_mode: Optional[str] = None
    reference: Optional[str] = None
    is_settled: Optional[bool] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    total_funds: Optional[float] = None
    logo_url: Optional[str] = None

def generate_next_logical_id(db: Session):
    max_id = db.query(Project.id).order_by(Project.id.desc()).first()
    if not max_id:
        return 2001
    return max_id[0] + 1

def generate_next_phase_id(db: Session, project_id: int):
    # project_id here is the logical ID (e.g., 2001)
    max_phase = db.query(Phase.id).filter(Phase.project_id == project_id).order_by(Phase.id.desc()).first()
    if not max_phase:
        return "01"
    try:
        next_val = int(max_phase[0]) + 1
        return f"{next_val:02d}"
    except:
        return "01"

@router.get("/", summary="List all Projects")
def list_projects(db: Session = Depends(get_db)) -> Any:
    projects = db.query(Project).options(joinedload(Project.phases)).all()
    result = []
    for p in projects:
        # Construct Nested Phases Object (Dictionary keyed by phase_id)
        phases_map = {}
        for ph in p.phases:
            phases_map[ph.id] = {
                "id": ph.id,
                "phase_id": ph.id,
                "name": ph.name,
                "description": ph.description,
                "allocated_funds": ph.allocated_funds,
                "remaining_balance": ph.remaining_balance,
                "received_amount": ph.received_amount,
                "is_received": ph.is_received,
                "received_from": ph.received_from,
                "received_to": ph.received_to,
                "payment_mode": ph.payment_mode,
                "reference": ph.reference,
                "is_settled": ph.is_settled
            }
            
        result.append({
            "id": str(p.id),
            "logical_id": p.id,
            "name": p.name,
            "description": p.description,
            "total_funds": p.total_funds,
            "remaining_balance": p.remaining_balance,
            "logo_url": p.logo_url,
            "phases": phases_map # RESTORED NESTED OBJECT
        })
    return result

@router.post("/", status_code=201, summary="Create a Project")
def create_project(project_in: ProjectCreate, db: Session = Depends(get_db)) -> Any:
    if len(project_in.name.strip()) < 6:
        raise HTTPException(status_code=400, detail="Project name must be at least 6 characters long.")
    
    logical_id = generate_next_logical_id(db)
    new_project = Project(
        id=logical_id,
        name=project_in.name.strip(),
        description=project_in.description,
        total_funds=project_in.total_funds,
        remaining_balance=project_in.total_funds,
        logo_url=project_in.logo_url
    )
    db.add(new_project)
    db.commit()
    return {"id": str(logical_id), "logical_id": logical_id, "message": "Project created successfully"}

@router.delete("/{project_id}", summary="Delete a Project")
def delete_project(project_id: int, db: Session = Depends(get_db)) -> Any:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"message": "Project deleted"}

@router.put("/{project_id}", summary="Update a Project")
def update_project(project_id: int, project_update: ProjectUpdate, db: Session = Depends(get_db)) -> Any:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project_update.name: project.name = project_update.name.strip()
    if project_update.description is not None: project.description = project_update.description
    if project_update.logo_url is not None: project.logo_url = project_update.logo_url
    
    if project_update.total_funds is not None:
        delta = project_update.total_funds - project.total_funds
        project.total_funds = project_update.total_funds
        project.remaining_balance += delta
    
    db.commit()
    return {"message": "Project updated"}

# ─── Phase CRUD ─────────────────────────────────────────────────────────────

@router.get("/{project_id}/phases", summary="List Phases for a Project")
def list_phases(project_id: int, db: Session = Depends(get_db)) -> Any:
    phases = db.query(Phase).filter(Phase.project_id == project_id).all()
    return [{
        "id": p.id,
        "phase_id": p.id,
        "name": p.name,
        "description": p.description,
        "allocated_funds": p.allocated_funds,
        "remaining_balance": p.remaining_balance,
        "received_amount": p.received_amount,
        "is_received": p.is_received,
        "received_from": p.received_from,
        "received_to": p.received_to,
        "payment_mode": p.payment_mode,
        "reference": p.reference,
        "is_settled": p.is_settled
    } for p in phases]

@router.post("/{project_id}/phases", status_code=201, summary="Add a Phase")
def create_phase(project_id: int, phase_in: PhaseCreate, db: Session = Depends(get_db)) -> Any:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    
    existing = db.query(Phase).filter(Phase.project_id == project_id, Phase.name == phase_in.name).first()
    if existing: raise HTTPException(status_code=400, detail=f"Phase '{phase_in.name}' already exists.")
    
    phase_id_code = generate_next_phase_id(db, project_id)
    new_phase = Phase(
        id=phase_id_code,
        project_id=project_id,
        name=phase_in.name,
        description=phase_in.description,
        allocated_funds=phase_in.allocated_funds,
        remaining_balance=phase_in.allocated_funds,
        received_amount=phase_in.received_amount,
        is_received=phase_in.is_received or phase_in.received_amount > 0,
        received_from=phase_in.received_from,
        received_to=phase_in.received_to,
        payment_mode=phase_in.payment_mode,
        reference=phase_in.reference,
        is_settled=phase_in.is_settled
    )
    db.add(new_phase)
    db.commit()
    return {"id": phase_id_code, "phase_id": phase_id_code, "name": phase_in.name, "message": "Phase created"}

@router.delete("/{project_id}/phases/{phase_id}", summary="Delete a Phase")
def delete_phase(project_id: int, phase_id: str, db: Session = Depends(get_db)) -> Any:
    phase = db.query(Phase).filter(Phase.id == phase_id, Phase.project_id == project_id).first()
    if not phase: raise HTTPException(status_code=404, detail="Phase not found")
    db.delete(phase)
    db.commit()
    return {"message": "Phase deleted"}

@router.put("/{project_id}/phases/{phase_id}", summary="Update a Phase")
def update_phase(project_id: int, phase_id: str, phase_update: PhaseUpdate, db: Session = Depends(get_db)) -> Any:
    phase = db.query(Phase).filter(Phase.id == phase_id, Phase.project_id == project_id).first()
    if not phase: raise HTTPException(status_code=404, detail="Phase not found")
    
    if phase_update.name: phase.name = phase_update.name
    if phase_update.description is not None: phase.description = phase_update.description
    if phase_update.is_received is not None: phase.is_received = phase_update.is_received
    if phase_update.received_amount is not None: 
        phase.received_amount = phase_update.received_amount
        if phase_update.is_received is None: phase.is_received = phase_update.received_amount > 0
    if phase_update.received_from is not None: phase.received_from = phase_update.received_from
    if phase_update.received_to is not None: phase.received_to = phase_update.received_to
    if phase_update.payment_mode is not None: phase.payment_mode = phase_update.payment_mode
    if phase_update.reference is not None: phase.reference = phase_update.reference
    
    if phase_update.allocated_funds is not None:
        delta = phase_update.allocated_funds - phase.allocated_funds
        phase.allocated_funds = phase_update.allocated_funds
        phase.remaining_balance += delta
    
    if phase_update.is_settled is not None:
        was_settled = phase.is_settled
        phase.is_settled = phase_update.is_settled
        # TRANSITION TO SETTLED logic (already implemented in previous turn)
        if not was_settled and phase_update.is_settled:
            current_rem = phase.remaining_balance
            if current_rem != 0:
                from app.services.accounting import create_transaction_service
                from app.schemas.accounting import TransactionCreate
                from datetime import datetime
                amt = abs(current_rem)
                cat_nm = "Settlement Surplus" if current_rem > 0 else "Settlement Deficit"
                cat_id = 5999 if current_rem > 0 else 4999
                tx_in = TransactionCreate(
                    project_name=phase.project.name, project_id=project_id,
                    category_name=cat_nm, category_id=cat_id, amount=amt,
                    from_name="Phase Account" if current_rem > 0 else "Project Reserve",
                    to_name="Project Reserve" if current_rem > 0 else "Phase Account",
                    from_date=datetime.now().isoformat(), to_date=datetime.now().isoformat(),
                    from_payment_mode="Internal", to_payment_mode="Internal",
                    description=f"Automatic settlement for '{phase.name}'.",
                    phase_name=phase.name, phase_id=phase_id
                )
                create_transaction_service(db, tx_in)
        elif was_settled and not phase_update.is_settled:
            from app.services.accounting import delete_transaction_service
            settlement_tx = db.query(Transaction).filter(
                Transaction.project_id == project_id, Transaction.phase_id == phase_id,
                Transaction.category_id.in_([4999, 5999]), Transaction.is_deleted == False
            ).first()
            if settlement_tx: delete_transaction_service(db, settlement_tx.id)
                
    db.commit()
    return {"message": "Phase updated"}

