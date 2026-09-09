"""
Live Environment Reset Script for Gartika Urban Intelligence.

Purges mock demonstration records from the database, removes synthetic evidence images,
and updates the .env configuration file to set DEMO_MODE=false for live operations.
"""

import sys
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend.app.database import engine, Base, SessionLocal
from backend.app.models.bus import Bus
from backend.app.models.event import Event
from backend.app.models.work_order import WorkOrder
from backend.app.models.telemetry import Telemetry
from backend.app.config import settings

def reset_to_live():
    """
    Purge all database tables, wipe old evidence frames, and switch system mode to LIVE.
    """
    print("[RESET] Purging all synthetic records from database...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    db.query(WorkOrder).delete()
    db.query(Event).delete()
    db.query(Telemetry).delete()
    db.query(Bus).delete()
    db.commit()
    db.close()
    print("[RESET] Database tables are now completely clean.")

    # Clean evidence folder
    evidence_dir = settings.EVIDENCE_DIR
    if evidence_dir.exists():
        count = 0
        for f in evidence_dir.glob("*.jpg"):
            try:
                f.unlink()
                count += 1
            except Exception:
                pass
        print(f"[RESET] Removed {count} old evidence frames from {evidence_dir}")

    # Update .env to DEMO_MODE=false
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        lines = []
        with open(env_file, "r") as f:
            for line in f:
                if line.startswith("DEMO_MODE="):
                    lines.append("DEMO_MODE=false\n")
                else:
                    lines.append(line)
        with open(env_file, "w") as f:
            f.writelines(lines)
        print("[RESET] Updated .env configuration: DEMO_MODE=false")

    print("[SUCCESS] Gartika is now in LIVE PRODUCTION MODE. Waiting for real camera, GPS, and IMU data.")

if __name__ == "__main__":
    reset_to_live()
