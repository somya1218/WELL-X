import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv(Path(__file__).resolve().parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and any(marker in DATABASE_URL for marker in (
    "your_", "YOUR_", "XXXX", "YOUR_PASSWORD", "PROJECT_ID", "REAL_", "user:password@host"
)):
    print("[database] Placeholder DATABASE_URL ignored; using local JSON fallback.")
    DATABASE_URL = None

engine = create_engine(DATABASE_URL, pool_pre_ping=True) if DATABASE_URL else None
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False) if engine else None
Base = declarative_base()

def get_db():
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL not set — check backend/.env")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()