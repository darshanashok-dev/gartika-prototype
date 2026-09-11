#!/usr/bin/env python3
"""
Gartika Demo Reset Script.

Safely resets the local SQLite database, removes stale demo evidence images,
and re-initializes clean schema tables for a fresh demonstration run.
"""

import sys
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from backend.app.config import settings
from backend.app.database import engine, Base

def reset_demo_state():
    print("=" * 60)
    print("        GARTIKA DEMO STATE RESET")
    print("=" * 60)
    
    # 1. Reset SQLite Database
    db_file = BASE_DIR / "gartika.db"
    if db_file.exists():
        print(f"[*] Removing existing database: {db_file}")
        db_file.unlink()
    
    # 2. Re-create clean database tables
    print("[*] Rebuilding database schema tables...")
    Base.metadata.create_all(bind=engine)
    print("[+] Database initialized successfully.")

    # 3. Clean temporary evidence images
    if settings.EVIDENCE_DIR.exists():
        print(f"[*] Cleaning temporary evidence directory: {settings.EVIDENCE_DIR}")
        for item in settings.EVIDENCE_DIR.glob("*.*"):
            if item.is_file() and item.name != ".gitkeep":
                try:
                    item.unlink()
                except Exception:
                    pass

    # Ensure required directories exist
    settings.EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    settings.VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    settings.DEMO_DIR.mkdir(parents=True, exist_ok=True)

    print("\n[+] Demo environment successfully reset to clean state.")
    print("=" * 60)

if __name__ == "__main__":
    reset_demo_state()
