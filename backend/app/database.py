"""
Database Engine & Session Management for Gartika Urban Intelligence.

Configures the SQLAlchemy ORM engine, connection pooling, and provides the
get_db dependency generator for FastAPI route handlers.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import settings

# For SQLite, ensure multiple threads can share connections cleanly
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

# Create central database engine
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args
)

# Session factory for generating scoped database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative Base for SQLAlchemy data models
Base = declarative_base()

def get_db():
    """
    FastAPI dependency that yields an isolated database session per request
    and guarantees proper closure and cleanup upon completion.
    
    Yields:
        Session: Active SQLAlchemy database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
