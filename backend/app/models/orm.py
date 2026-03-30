from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Boolean, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
import datetime
from app.core.config import settings

Base = declarative_base()

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True) # Logical ID
    name = Column(String, unique=True, index=True)
    description = Column(Text, default="")
    total_funds = Column(Float, default=0.0)
    remaining_balance = Column(Float, default=0.0)
    logo_url = Column(String, default="")
    
    phases = relationship("Phase", back_populates="project", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="project")

class Phase(Base):
    __tablename__ = "phases"
    id = Column(String, primary_key=True, index=True) # Logical ID
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String)
    description = Column(Text, default="")
    allocated_funds = Column(Float, default=0.0)
    remaining_balance = Column(Float, default=0.0)
    received_amount = Column(Float, default=0.0)
    is_received = Column(Boolean, default=False)
    received_from = Column(String, default="")
    received_to = Column(String, default="")
    payment_mode = Column(String, default="")
    reference = Column(String, default="")
    is_settled = Column(Boolean, default=False)
    
    project = relationship("Project", back_populates="phases")
    transactions = relationship("Transaction", back_populates="phase")

class Category(Base):
    __tablename__ = "categories"
    code = Column(Integer, primary_key=True, index=True) # 1001, 5001, etc.
    name = Column(String, unique=True)
    account_type = Column(String) # Asset, Expense, etc.

    transactions = relationship("Transaction", back_populates="category")

    @classmethod
    def get(cls, session, code):
        return session.query(cls).filter(cls.code == code).first()

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(String, primary_key=True, index=True) # Unique ID (UUID-based)
    project_id = Column(Integer, ForeignKey("projects.id"))
    phase_id = Column(String, ForeignKey("phases.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.code"))
    
    amount = Column(Float, nullable=False)
    transaction_date = Column(String) # YYYY-MM-DD
    description = Column(Text)
    
    from_name = Column(String)
    from_date = Column(String)
    from_payment_mode = Column(String)
    from_reference = Column(String)
    
    to_name = Column(String)
    to_date = Column(String)
    to_payment_mode = Column(String)
    to_reference = Column(String)
    
    receipt_url = Column(String, nullable=True)
    material_image_url = Column(String, nullable=True)
    account_type = Column(String) # Cached for speed
    
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="transactions")
    phase = relationship("Phase", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    ledger_entries = relationship("LedgerEntry", back_populates="transaction", cascade="all, delete-orphan")

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String, ForeignKey("transactions.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    account_id = Column(Integer) # Logical ID (Category Code or 1001/1002)
    account_name = Column(String)
    entry_type = Column(String) # Debit/Credit
    amount = Column(Float)
    
    transaction = relationship("Transaction", back_populates="ledger_entries")

# Engine and Session setup
engine = create_engine(settings.SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
