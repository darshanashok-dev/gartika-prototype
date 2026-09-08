import sys
import os
import time
import cv2
import numpy as np
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend.app.database import engine, Base, SessionLocal
from backend.app.models.bus import Bus
from backend.app.models.event import Event
from backend.app.models.work_order import WorkOrder
from backend.app.models.telemetry import Telemetry
from backend.app.config import settings

def create_sample_evidence_image(filename: str, label: str):
    """Generate sample annotated evidence frame with privacy blur."""
    settings.EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    img_path = settings.EVIDENCE_DIR / filename
    if img_path.exists():
        return f"/evidence/{filename}"

    h, w = 480, 720
    img = np.zeros((h, w, 3), dtype=np.uint8)
    
    # Asphalt road
    img[0:int(h*0.4), :] = (180, 160, 130) # city background
    img[int(h*0.4):, :] = (65, 65, 70) # road asphalt
    
    # Yellow dashed divider
    cv2.line(img, (w//2, int(h*0.4)), (w//2 - 40, h), (0, 215, 255), 4)
    
    # Pothole bounding box and crater
    px, py = w//2 + 50, int(h*0.7)
    cv2.ellipse(img, (px, py), (55, 25), 0, 0, 360, (20, 20, 22), -1)
    cv2.ellipse(img, (px+2, py-2), (58, 27), 0, 0, 180, (90, 90, 100), 2)
    
    # Red detection box
    bx1, by1, bx2, by2 = px - 75, py - 40, px + 75, py + 40
    cv2.rectangle(img, (bx1, by1), (bx2, by2), (0, 0, 255), 3)
    
    # Label
    cv2.rectangle(img, (bx1, by1 - 28), (bx1 + 250, by1), (0, 0, 220), -1)
    cv2.putText(img, f"GARTIKA AI: {label}", (bx1 + 6, by1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
    
    # Watermark
    cv2.putText(img, f"GARTIKA EDGE UNIT BUS-101 | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}", (15, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)
    
    cv2.imwrite(str(img_path), img)
    return f"/evidence/{filename}"

def seed():
    print("[SEED] Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    print("[SEED] Clearing old demo records...")
    db.query(WorkOrder).delete()
    db.query(Event).delete()
    db.query(Telemetry).delete()
    db.query(Bus).delete()
    db.commit()

    print("[SEED] Seeding active bus sensing unit...")
    bus = Bus(
        bus_id="BUS-101",
        name="BMTC Urban Sense (Electric)",
        status="ONLINE",
        latitude=12.971598,
        longitude=77.594562,
        speed=32.4,
        route_name="Route 335E (Majestic - Whitefield)",
        source_type="DEMO_VIDEO",
        last_seen=datetime.now(timezone.utc)
    )
    db.add(bus)
    db.commit()

    ev1 = create_sample_evidence_image("demo_pothole_1.jpg", "POTHOLE (91%)")
    ev2 = create_sample_evidence_image("demo_pothole_2.jpg", "ROAD CRACK (87%)")

    print("[SEED] Seeding road defect & traffic events...")
    now = datetime.now(timezone.utc)
    
    events_data = [
        Event(
            event_id="EVT-POTH-001",
            bus_id="BUS-101",
            event_type="POTHOLE",
            confidence=0.912,
            latitude=12.972854,
            longitude=77.601243,
            timestamp=now - timedelta(minutes=14),
            severity="HIGH",
            evidence_path=ev1,
            status="WORK_ORDER_CREATED",
            vibration_level="HIGH",
            location_name="Trinity Circle South Approach Road"
        ),
        Event(
            event_id="EVT-POTH-002",
            bus_id="BUS-101",
            event_type="ROAD_DEFECT",
            confidence=0.864,
            latitude=12.975412,
            longitude=77.615234,
            timestamp=now - timedelta(minutes=9),
            severity="MEDIUM",
            evidence_path=ev2,
            status="NEW",
            vibration_level="NORMAL",
            location_name="Halasuru Lake Road Near Bus Stop"
        ),
        Event(
            event_id="EVT-POTH-003",
            bus_id="BUS-101",
            event_type="POTHOLE",
            confidence=0.948,
            latitude=12.978120,
            longitude=77.632410,
            timestamp=now - timedelta(minutes=4),
            severity="CRITICAL",
            evidence_path=ev1,
            status="NEW",
            vibration_level="HIGH",
            location_name="100ft Road Indiranagar Junction"
        ),
        Event(
            event_id="EVT-TRF-001",
            bus_id="BUS-101",
            event_type="VEHICLE_COUNT",
            confidence=0.925,
            latitude=12.971598,
            longitude=77.594562,
            timestamp=now - timedelta(minutes=2),
            severity="MEDIUM",
            status="NEW",
            vehicle_class="CAR",
            count=18,
            location_name="MG Road Metro Corridor"
        )
    ]

    for e in events_data:
        db.add(e)
    db.commit()

    print("[SEED] Seeding maintenance work orders...")
    work_orders_data = [
        WorkOrder(
            work_order_id="WO-101",
            event_id="EVT-POTH-001",
            title="Asphalt Patching & Pothole Repair",
            description="Automated maintenance dispatch generated by Gartika AI Edge Sensor. Visual Confidence: 91.2%, IMU Z-Shock: HIGH",
            priority="HIGH",
            status="ASSIGNED",
            created_at=now - timedelta(minutes=12),
            assigned_to="BBMP Ward 112 Rapid Road Repair Cell",
            location_name="Trinity Circle South Approach Road",
            latitude=12.972854,
            longitude=77.601243,
            source_bus_id="BUS-101"
        )
    ]

    for wo in work_orders_data:
        db.add(wo)
    db.commit()

    print("[SEED] Seeding telemetry...")
    for i in range(10):
        t = Telemetry(
            bus_id="BUS-101",
            latitude=12.971598 + i * 0.0006,
            longitude=77.594562 + i * 0.0035,
            accuracy=3.5,
            speed=31.5 + i * 0.4,
            ax=0.15,
            ay=-0.12,
            az=9.81,
            timestamp=now - timedelta(seconds=(10 - i) * 3)
        )
        db.add(t)
    db.commit()

    db.close()
    print("\n✓ SUCCESS: Demo database seeded with realistic bus, events, work orders, and telemetry!")

if __name__ == "__main__":
    seed()
