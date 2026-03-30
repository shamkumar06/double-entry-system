from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from app.models.orm import Project, Phase, Category, Transaction, LedgerEntry
from app.schemas.accounting import TransactionCreate
import logging
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

def create_transaction_service(db: Session, transaction: TransactionCreate, tx_id: str = None):
    if not tx_id:
        tx_id = str(uuid.uuid4())[:18] # Short UUID for consistent key length
        
    # 1. Fetch Category for Account Type
    category = db.query(Category).filter(Category.code == transaction.category_id).first()
    account_type = category.account_type if category else "Expense"
    
    # Hardcoded overrides for settlements
    if transaction.category_name == "Settlement Deficit": account_type = "Revenue"
    if transaction.category_name == "Settlement Surplus": account_type = "Expense"

    # 2. Prepare Transaction Record
    db_tx = Transaction(
        id=tx_id,
        project_id=transaction.project_id,
        phase_id=transaction.phase_id,
        category_id=transaction.category_id,
        amount=transaction.amount,
        transaction_date=transaction.from_date.split('T')[0] if 'T' in transaction.from_date else transaction.from_date,
        description=transaction.description,
        from_name=transaction.from_name,
        from_date=transaction.from_date,
        from_payment_mode=transaction.from_payment_mode,
        from_reference=transaction.from_reference or "",
        to_name=transaction.to_name,
        to_date=transaction.to_date,
        to_payment_mode=transaction.to_payment_mode,
        to_reference=transaction.to_reference or "",
        receipt_url=transaction.receipt_url,
        material_image_url=transaction.material_image_url,
        account_type=account_type
    )
    db.add(db_tx)

    # 3. Create Ledger Entries (Debit & Credit)
    offset_account = "Cash"
    offset_id = 1001 
    
    if account_type in ["Revenue", "Liability", "Equity"]:
        # INFLOW
        debit_entry = LedgerEntry(transaction_id=tx_id, project_id=transaction.project_id, account_id=offset_id, account_name=offset_account, entry_type="Debit", amount=transaction.amount)
        credit_entry = LedgerEntry(transaction_id=tx_id, project_id=transaction.project_id, account_id=transaction.category_id, account_name=transaction.category_name, entry_type="Credit", amount=transaction.amount)
        balance_change = transaction.amount
    else:
        # OUTFLOW
        debit_entry = LedgerEntry(transaction_id=tx_id, project_id=transaction.project_id, account_id=transaction.category_id, account_name=transaction.category_name, entry_type="Debit", amount=transaction.amount)
        credit_entry = LedgerEntry(transaction_id=tx_id, project_id=transaction.project_id, account_id=offset_id, account_name=offset_account, entry_type="Credit", amount=transaction.amount)
        balance_change = -transaction.amount

    db.add(debit_entry)
    db.add(credit_entry)

    # 4. Update Balances
    project = db.query(Project).filter(Project.id == transaction.project_id).first()
    if project:
        project.remaining_balance += balance_change
        
        if transaction.phase_id:
            phase = db.query(Phase).filter(Phase.id == transaction.phase_id, Phase.project_id == project.id).first()
            if phase:
                phase.remaining_balance += balance_change

    db.commit()
    return tx_id

def get_journal(db: Session, project_id: int, phase_id: str = None):
    # Optimized Join Query to avoid N+1 Category lookups
    query = db.query(Transaction).options(joinedload(Transaction.category)).filter(
        Transaction.project_id == project_id, 
        Transaction.is_deleted == False
    )
    
    if phase_id:
        p_ids = [pid.strip() for pid in str(phase_id).split(',')]
        query = query.filter(Transaction.phase_id.in_(p_ids))
    
    transactions = query.order_by(desc(Transaction.transaction_date)).all()
    
    # Map to Dict for UI compatibility
    result = []
    for tx in transactions:
        tx_dict = {column.name: getattr(tx, column.name) for column in tx.__table__.columns}
        # Efficient name resolution from joined object
        if tx.category:
            tx_dict["category_name"] = tx.category.name
        else:
            tx_dict["category_name"] = "Unknown"
        result.append(tx_dict)
    return result

def get_ledger_page(db: Session, project_id: int, account_id: int, phase_id: str = None):
    category = db.query(Category).filter(Category.code == account_id).first()
    account_type = category.account_type if category else "Asset" if account_id in [1001, 1002] else "Expense"
    official_name = category.name if category else "Cash" if account_id == 1001 else "Bank" if account_id == 1002 else "Unknown"

    query = db.query(LedgerEntry).join(Transaction).filter(
        LedgerEntry.project_id == project_id,
        LedgerEntry.account_id == account_id,
        Transaction.is_deleted == False
    )
    
    if phase_id:
        p_ids = [pid.strip() for pid in str(phase_id).split(',')]
        query = query.filter(Transaction.phase_id.in_(p_ids))
        
    entries = query.order_by(Transaction.transaction_date).all()
    
    ledger = []
    balance = 0.0
    is_normal_debit = account_type in ["Asset", "Expense"]
    
    for entry in entries:
        tx = entry.transaction
        amt = entry.amount
        is_debit = entry.entry_type == "Debit"
        
        if is_normal_debit:
            balance += amt if is_debit else -amt
        else:
            balance += amt if not is_debit else -amt
            
        ledger.append({
            "id": entry.id,
            "transaction_id": entry.transaction_id,
            "date": tx.transaction_date,
            "entry_type": entry.entry_type,
            "amount": amt,
            "phase_name": tx.phase.name if tx.phase else "Whole Project",
            "resolved_account_name": official_name,
            "running_balance": balance
        })
    return ledger

def get_trial_balance(db: Session, project_id: int, phase_id: str = None):
    query = db.query(LedgerEntry).join(Transaction).filter(
        LedgerEntry.project_id == project_id,
        Transaction.is_deleted == False
    )
    if phase_id:
        p_ids = [pid.strip() for pid in str(phase_id).split(',')]
        query = query.filter(Transaction.phase_id.in_(p_ids))
        
    entries = query.all()
    
    account_sums = {}
    for entry in entries:
        aid = entry.account_id
        if aid not in account_sums:
            account_sums[aid] = {"debits": 0.0, "credits": 0.0, "name": entry.account_name}
        
        if entry.entry_type == "Debit":
            account_sums[aid]["debits"] += entry.amount
        else:
            account_sums[aid]["credits"] += entry.amount
            
    final_accounts = {}
    total_debits = 0.0
    total_credits = 0.0
    
    for aid, sums in account_sums.items():
        net = sums["debits"] - sums["credits"]
        if net == 0: continue
        
        cat = db.query(Category).filter(Category.code == aid).first()
        acc_type = cat.account_type if cat else "Asset" if aid in [1001, 1002] else "Expense"
        acc_name = cat.name if cat else sums["name"]
        
        final_accounts[acc_name] = {
            "debits": sums["debits"],
            "credits": sums["credits"],
            "balance": net,
            "account_type": acc_type,
            "account_id": aid
        }
        if net > 0: total_debits += net
        else: total_credits += abs(net)
        
    return {
        "accounts": final_accounts,
        "totals": {
            "total_debits": total_debits,
            "total_credits": total_credits,
            "is_balanced": round(total_debits, 2) == round(total_credits, 2)
        }
    }

def delete_transaction_service(db: Session, transaction_id: str):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id, Transaction.is_deleted == False).first()
    if not tx: raise Exception("Transaction not found")
    
    # Reverse Impact
    acc_type = tx.account_type
    reversal_change = -tx.amount if acc_type in ["Revenue", "Liability", "Equity"] else tx.amount
    
    project = db.query(Project).filter(Project.id == tx.project_id).first()
    if project:
        project.remaining_balance += reversal_change
        if tx.phase_id:
            phase = db.query(Phase).filter(Phase.id == tx.phase_id, Phase.project_id == project.id).first()
            if phase:
                phase.remaining_balance += reversal_change
                
    tx.is_deleted = True
    tx.deleted_at = datetime.utcnow()
    db.commit()
    return True

def list_deleted_service(db: Session, project_id: int):
    txs = db.query(Transaction).filter(Transaction.project_id == project_id, Transaction.is_deleted == True).all()
    return [{column.name: getattr(tx, column.name) for column in tx.__table__.columns} for tx in txs]

def restore_transaction_service(db: Session, transaction_id: str):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id, Transaction.is_deleted == True).first()
    if not tx: raise Exception("Transaction not found in Recycle Bin")
    
    # Re-apply Impact
    acc_type = tx.account_type
    impact = tx.amount if acc_type in ["Revenue", "Liability", "Equity"] else -tx.amount
    
    project = db.query(Project).filter(Project.id == tx.project_id).first()
    if project:
        project.remaining_balance += impact
        if tx.phase_id:
            phase = db.query(Phase).filter(Phase.id == tx.phase_id, Phase.project_id == project.id).first()
            if phase:
                phase.remaining_balance += impact
                
    tx.is_deleted = False
    tx.deleted_at = None
    db.commit()
    return True
