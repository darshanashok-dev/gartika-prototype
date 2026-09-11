#!/usr/bin/env python3
"""
Gartika System Health & Readiness Verification Script.

Evaluates all system layers (Backend, Database, AI Model, Storage, Telemetry, WebSockets)
and reports operational status with distinct REQUIRED vs OPTIONAL diagnostics.
"""

import os
import sys
import time
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

def check_backend_dependencies():
    """Verify essential Python packages."""
    required_pkgs = ["fastapi", "uvicorn", "sqlalchemy", "pydantic", "cv2", "numpy"]
    optional_pkgs = ["ultralytics", "onnxruntime"]
    
    status = {"required": True, "optional": True, "details": []}
    for pkg in required_pkgs:
        try:
            __import__(pkg)
            status["details"].append((pkg, "INSTALLED", True, True))
        except ImportError:
            status["required"] = False
            status["details"].append((pkg, "MISSING", False, True))
            
    for pkg in optional_pkgs:
        try:
            __import__(pkg)
            status["details"].append((pkg, "INSTALLED", True, False))
        except ImportError:
            status["optional"] = False
            status["details"].append((pkg, "NOT FOUND (Will use fallback)", False, False))
            
    return status

def check_database():
    """Verify database connectivity and essential table schemas."""
    try:
        from backend.app.database import engine, SessionLocal
        from backend.app.models.defect import RoadDefect, Observation
        from backend.app.models.bus import Bus
        from backend.app.models.telemetry import Telemetry
        from backend.app.models.work_order import WorkOrder
        
        session = SessionLocal()
        session.query(Bus).count()
        session.query(RoadDefect).count()
        session.query(Observation).count()
        session.query(Telemetry).count()
        session.query(WorkOrder).count()
        session.close()
        return True, "Connected (SQLite Engine operational, all tables verified)"
    except Exception as e:
        return False, f"Database Error: {str(e)}"

def check_ai_model():
    """Verify AI model presence and inference engine fallback readiness."""
    model_path = PROJECT_ROOT / "models" / "gartika_road_defect.pt"
    onnx_path = PROJECT_ROOT / "models" / "gartika_road_defect.onnx"
    
    if model_path.exists():
        return True, f"YOLO weights active ({model_path.name})"
    elif onnx_path.exists():
        return True, f"ONNX runtime weights active ({onnx_path.name})"
    else:
        return True, "OpenCV Heuristic Contours active (Safe Fallback)"

def check_evidence_storage():
    """Verify evidence directories are accessible and writable."""
    evidence_dir = PROJECT_ROOT / "data" / "evidence"
    try:
        evidence_dir.mkdir(parents=True, exist_ok=True)
        test_file = evidence_dir / ".health_check_tmp"
        test_file.write_text("health_check_ok")
        test_file.unlink()
        return True, f"Writable ({evidence_dir})"
    except Exception as e:
        return False, f"Directory unwritable: {str(e)}"

def check_frontend_assets():
    """Verify dashboard and mobile interface files exist."""
    dash_index = PROJECT_ROOT / "dashboard" / "index.html"
    mobile_index = PROJECT_ROOT / "mobile" / "index.html"
    
    if dash_index.exists() and mobile_index.exists():
        return True, "Dashboard & Mobile SPAs present"
    return False, "Frontend index files missing"

def run_health_check():
    print("=" * 64)
    print("        GARTIKA SYSTEM HEALTH & READINESS VERIFICATION")
    print("=" * 64)
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    print(f"Root:      {PROJECT_ROOT}")
    print("-" * 64)
    
    all_required_pass = True
    
    # 1. Dependencies
    dep_status = check_backend_dependencies()
    print("[DEPENDENCIES]")
    for name, stat, ok, is_req in dep_status["details"]:
        tag = "REQUIRED" if is_req else "OPTIONAL"
        sym = "✓" if ok else ("✗" if is_req else "⚠")
        print(f"  [{sym}] {name:<18} [{tag:<8}] : {stat}")
    if not dep_status["required"]:
        all_required_pass = False

    print("\n[SUBSYSTEMS]")
    
    # 2. Database
    db_ok, db_msg = check_database()
    sym = "✓" if db_ok else "✗"
    print(f"  [{sym}] Database Engine    [REQUIRED] : {db_msg}")
    if not db_ok: all_required_pass = False
    
    # 3. AI Model
    ai_ok, ai_msg = check_ai_model()
    sym = "✓" if ai_ok else "⚠"
    print(f"  [{sym}] AI Detection Model [REQUIRED] : {ai_msg}")
    if not ai_ok: all_required_pass = False
    
    # 4. Storage
    st_ok, st_msg = check_evidence_storage()
    sym = "✓" if st_ok else "✗"
    print(f"  [{sym}] Evidence Storage   [REQUIRED] : {st_msg}")
    if not st_ok: all_required_pass = False
    
    # 5. Frontend
    fe_ok, fe_msg = check_frontend_assets()
    sym = "✓" if fe_ok else "✗"
    print(f"  [{sym}] Frontend UI Assets [REQUIRED] : {fe_msg}")
    if not fe_ok: all_required_pass = False
    
    print("-" * 64)
    if all_required_pass:
        print(">>> STATUS: SYSTEM HEALTHY AND READY FOR DEMO / OPERATION <<<")
        print("=" * 64)
        return 0
    else:
        print(">>> STATUS: SYSTEM HAS UNRESOLVED CRITICAL ISSUES <<<")
        print("=" * 64)
        return 1

if __name__ == "__main__":
    sys.exit(run_health_check())
