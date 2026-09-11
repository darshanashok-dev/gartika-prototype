#!/usr/bin/env python3
"""
run_demo.py - Deterministic Multi-Bus Sensor Fusion and Repair Verification Demo.

Executes the full 8-step simulation story:
1. BUS-101 traverses Route 335E and detects a potential road hazard (Visual + IMU shock) -> Defect created as UNVERIFIED/SUSPECTED.
2. BUS-208 passes the same spatial coordinate 15 minutes later and detects the pothole -> Upgraded to VERIFIED.
3. Municipal Work Order automatically dispatched for Civic Rapid Response.
4. Work Order transitions to IN_PROGRESS.
5. Road maintenance contractor marks repair as COMPLETED.
6. BUS-101 passes the repair site on return route and detects smooth asphalt (no defect, minimal IMU vibration) -> Defect status updated to CLOSED / REPAIRED.
7. Verification status confirmed in database and stats reported.
8. Live verification summary output.
"""

import sys
import time
import argparse
import numpy as np
import cv2
from pathlib import Path
from datetime import datetime, timezone

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend.app.database import engine, Base, SessionLocal
from backend.app.models.bus import Bus
from backend.app.models.defect import RoadDefect, Observation
from backend.app.models.event import Event
from backend.app.models.work_order import WorkOrder
from backend.app.models.telemetry import Telemetry
from backend.app.fusion.engine import fusion_engine
from backend.app.fusion.models import ImuReading

def create_synthetic_frame():
    """Create a mock BGR frame with asphalt and pothole overlay for demo evidence."""
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    img[0:190, :] = (175, 155, 130)  # sky/horizon
    img[190:, :] = (60, 60, 65)       # asphalt
    # Yellow lane marking
    cv2.line(img, (320, 190), (280, 480), (0, 215, 255), 4)
    # Pothole crater
    cv2.ellipse(img, (370, 340), (50, 22), 0, 0, 360, (25, 25, 28), -1)
    _, buf = cv2.imencode('.jpg', img)
    return buf.tobytes()

def log_step(step_num: int, title: str, details: str):
    print("\n" + "=" * 76)
    print(f"  STEP {step_num}: {title}")
    print("=" * 76)
    print(details)

def run_simulation(fast_mode: bool = False):
    delay = 0.4 if fast_mode else 1.8
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Reset tables for clean demo run
        print("\n[INIT] Resetting demo database state...")
        db.query(Observation).delete()
        db.query(RoadDefect).delete()
        db.query(WorkOrder).delete()
        db.query(Event).delete()
        db.query(Telemetry).delete()
        db.query(Bus).delete()
        db.commit()

        # Target Coordinates for Pothole: Trinity Circle, MG Road, Bengaluru
        DEFECT_LAT = 12.97380
        DEFECT_LON = 77.61890

        # Register Buses
        bus1 = Bus(bus_id="BUS-101", name="BMTC Electric Line 335E", status="ONLINE", latitude=DEFECT_LAT - 0.005, longitude=DEFECT_LON - 0.005, speed=34.0, route_name="Majestic - Whitefield", source_type="DEMO_SIMULATION", last_seen=datetime.now(timezone.utc))
        bus2 = Bus(bus_id="BUS-208", name="BMTC Feeder Line 201G", status="ONLINE", latitude=DEFECT_LAT - 0.010, longitude=DEFECT_LON - 0.010, speed=28.5, route_name="KBS - Domlur", source_type="DEMO_SIMULATION", last_seen=datetime.now(timezone.utc))
        db.add_all([bus1, bus2])
        db.commit()

        frame_bytes = create_synthetic_frame()

        # Step 1: BUS-101 initial detection
        log_step(1, "BUS-101 Traverses MG Road & Detects Road Impact + Visual Defect",
                 f"Bus BUS-101 approaches coordinates ({DEFECT_LAT:.5f}, {DEFECT_LON:.5f}).\n"
                 f"Edge sensors detect an accelerometer vertical spike (accel_z = 15.2 m/s²) aligned with visual crater detection.")
        
        # Ingest IMU shock into BUS-101 buffer
        fusion_engine.process_imu_telemetry(
            bus_id="BUS-101",
            ax=0.4,
            ay=-0.2,
            az=15.2,
            lat=DEFECT_LAT,
            lon=DEFECT_LON,
            speed=32.0,
            db=db
        )

        # Ingest Camera frame with visual defect candidate
        visual_defects_bus1 = [
            {
                "event_type": "POTHOLE",
                "confidence": 0.88,
                "bbox": [140, 220, 310, 360],
                "source": "yolo"
            }
        ]
        
        events_1 = fusion_engine.process_frame(
            bus_id="BUS-101",
            frame_bytes=frame_bytes,
            visual_defects=visual_defects_bus1,
            db=db,
            gps_override=(DEFECT_LAT, DEFECT_LON)
        )
        time.sleep(delay)

        defect = db.query(RoadDefect).first()
        print(f"\n[FUSION ENGINE OUTPUT - STEP 1]")
        print(f"  * Generated Events:     {len(events_1)}")
        print(f"  * Defect ID:            {defect.defect_id if defect else 'None'}")
        print(f"  * Defect Type:          {defect.defect_type if defect else 'None'}")
        print(f"  * Verification Status:  {defect.status if defect else 'None'}")
        print(f"  * Verifying Buses:      {defect.verifying_buses if defect else 'None'}")
        print(f"  * Unique Bus Count:     {defect.unique_bus_count if defect else 'None'}")

        # Step 2: BUS-208 corroborating pass
        log_step(2, "BUS-208 Passes the Same Coordinate (Multi-Bus Corroboration)",
                 f"15 minutes later, BUS-208 approaches ({DEFECT_LAT:.5f}, {DEFECT_LON:.5f}).\n"
                 f"Edge sensors detect the pothole. Spatial deduplication (Haversine < 15m) links observation\n"
                 f"and upgrades defect verification level to VERIFIED.")
        
        # Ingest IMU shock from BUS-208
        fusion_engine.process_imu_telemetry(
            bus_id="BUS-208",
            ax=0.3,
            ay=-0.1,
            az=14.8,
            lat=DEFECT_LAT + 0.00003, # 3 meters away
            lon=DEFECT_LON - 0.00002,
            speed=29.0,
            db=db
        )

        visual_defects_bus2 = [
            {
                "event_type": "POTHOLE",
                "confidence": 0.92,
                "bbox": [135, 215, 305, 355],
                "source": "yolo"
            }
        ]
        
        events_2 = fusion_engine.process_frame(
            bus_id="BUS-208",
            frame_bytes=frame_bytes,
            visual_defects=visual_defects_bus2,
            db=db,
            gps_override=(DEFECT_LAT + 0.00003, DEFECT_LON - 0.00002)
        )
        db.refresh(defect)
        time.sleep(delay)

        print(f"\n[MULTI-BUS CORROBORATION RESULT - STEP 2]")
        print(f"  * Defect ID:            {defect.defect_id}")
        print(f"  * Upgraded Status:      {defect.status}")
        print(f"  * Observation Count:    {defect.observation_count}")
        print(f"  * Distinct Bus Fleet:   {defect.verifying_buses}")
        print(f"  * Unique Bus Count:     {defect.unique_bus_count}")

        # Step 3: Work Order Dispatch
        log_step(3, "Automated Dispatch of Municipal Road Repair Work Order",
                 f"Because verification status reached '{defect.status}' and severity is HIGH,\n"
                 f"a civic repair ticket is dispatched to Urban Rapid Response Team.")
        
        wo = WorkOrder(
            work_order_id=f"WO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-001",
            event_id=defect.defect_id,
            defect_id=defect.defect_id,
            title=f"Repair Verified Pothole #{defect.defect_id[:8]}",
            description=f"Multi-bus verified crater detected at Trinity Circle by {defect.verifying_buses}.",
            priority="CRITICAL",
            status="ASSIGNED",
            assigned_to="BBMP East Zone Rapid Repair Wing Alpha-3",
            latitude=defect.latitude,
            longitude=defect.longitude,
            assigned_at=datetime.now(timezone.utc)
        )
        db.add(wo)
        defect.work_order_id = wo.work_order_id
        db.commit()
        db.refresh(wo)
        db.refresh(defect)
        time.sleep(delay)

        print(f"  * Work Order ID:        {wo.work_order_id}")
        print(f"  * Status:               {wo.status}")
        print(f"  * Assigned To:          {wo.assigned_to}")

        # Step 4: Maintenance Work Starts
        log_step(4, "Field Crew Begins Asphalt Repair Operations",
                 f"Contractor team arrives on site and begins asphalt milling, cold patch compaction, and sealing.")
        wo.status = "IN_PROGRESS"
        wo.started_at = datetime.now(timezone.utc)
        defect.status = "IN_PROGRESS"
        db.commit()
        time.sleep(delay)
        print(f"  * Work Order Status:    {wo.status}")
        print(f"  * Defect Status:        {defect.status}")

        # Step 5: Contractor Marks Completed
        log_step(5, "Contractor Marks Repair as Completed (Awaiting Sensor Verification)",
                 f"Physical compaction completed. Work Order is flagged as COMPLETED, putting the defect into PENDING_VERIFICATION.")
        wo.status = "COMPLETED"
        wo.completed_at = datetime.now(timezone.utc)
        defect.status = "REPAIRED"
        defect.repair_status = "PENDING_VERIFICATION"
        db.commit()
        time.sleep(delay)
        print(f"  * Work Order Status:    {wo.status}")
        print(f"  * Defect Repair Status: {defect.repair_status}")

        # Step 6: Closed-Loop Post-Repair Verification Pass
        log_step(6, "Closed-Loop Repair Verification: BUS-101 Traverses Repaired Site",
                 f"BUS-101 returns along the route and traverses coordinate ({DEFECT_LAT:.5f}, {DEFECT_LON:.5f}).\n"
                 f"Sensors report flat road profile (no visual crater, smooth IMU readings: accel_z = 9.81 m/s²).")
        
        smooth_imu = ImuReading(timestamp=time.time(), ax=0.01, ay=0.01, az=9.81)
        
        # Execute repair verification check via engine
        fusion_engine.check_repair_verification(
            bus_id="BUS-101",
            lat=DEFECT_LAT + 0.00001,
            lon=DEFECT_LON + 0.00001,
            has_visual_defect=False,
            aligned_imu=smooth_imu,
            db=db
        )
        
        db.refresh(defect)
        db.refresh(wo)
        time.sleep(delay)

        print(f"\n[CLOSED-LOOP VERIFICATION RESULT - STEP 6]")
        print(f"  * Defect Status:        {defect.status}")
        print(f"  * Defect Repair Status: {defect.repair_status}")
        print(f"  * Verified By Bus:      {defect.repair_verified_by_bus_id}")
        print(f"  * Work Order Status:    {wo.status}")

        # Step 7 & 8: Summary Report
        log_step(7, "End-to-End Audit & Observability Verification",
                 f"Querying system observability metrics across multi-bus fusion and defect lifecycle.")
        
        all_defects = db.query(RoadDefect).all()
        all_obs = db.query(Observation).all()
        all_wos = db.query(WorkOrder).all()

        log_step(8, "Gartika Autonomous Urban Intelligence Simulation Succeeded",
                 f"Multi-Bus Sensing -> Sensor Fusion Engine -> Multi-Vehicle Corroboration\n"
                 f"-> Automated Work Order Dispatch -> Closed-Loop Sensor Repair Audit.\n\n"
                 f"Total Persistent Defects: {len(all_defects)}\n"
                 f"Total Sensor Observations: {len(all_obs)}\n"
                 f"Total Work Orders Closed: {len(all_wos)}")
        
        print("\n" + "=" * 76)
        print("                 DEMO SIMULATION COMPLETED SUCCESSFULLY!                ")
        print("=" * 76 + "\n")

    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Gartika deterministic multi-bus demo simulation.")
    parser.add_argument("--fast", action="store_true", help="Run simulation with minimal delays")
    args = parser.parse_args()
    run_simulation(fast_mode=args.fast)
