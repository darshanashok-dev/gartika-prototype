import sys
import unittest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import engine, Base, SessionLocal
from backend.app.models.bus import Bus
from backend.app.models.event import Event
from backend.app.models.work_order import WorkOrder

class TestApiEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def test_01_bus_registration_and_list(self):
        bus_payload = {
            "bus_id": "BUS-202",
            "name": "Electric Transit Unit 202",
            "status": "ONLINE",
            "latitude": 12.9735,
            "longitude": 77.6055,
            "route_name": "Route 500D Outer Ring Road"
        }
        res = self.client.post("/buses", json=bus_payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["bus_id"], "BUS-202")

        list_res = self.client.get("/buses")
        self.assertEqual(list_res.status_code, 200)
        bus_ids = [b["bus_id"] for b in list_res.json()]
        self.assertIn("BUS-202", bus_ids)

    def test_02_event_filtering_and_patching(self):
        # Insert test pothole
        pothole_res = self.client.post("/events", json={
            "bus_id": "BUS-101",
            "event_type": "POTHOLE",
            "confidence": 0.95,
            "latitude": 12.9780,
            "longitude": 77.6320,
            "severity": "CRITICAL",
            "location_name": "Indiranagar Test Spot"
        })
        self.assertEqual(pothole_res.status_code, 201)
        evt_id = pothole_res.json()["event_id"]

        # Filter by event_type
        filter_res = self.client.get("/events?event_type=POTHOLE")
        self.assertEqual(filter_res.status_code, 200)
        events = filter_res.json()
        self.assertTrue(all(e["event_type"] == "POTHOLE" for e in events))

        # Patch event status
        patch_res = self.client.patch(f"/events/{evt_id}", json={"status": "REVIEWED"})
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.json()["status"], "REVIEWED")

    def test_03_work_order_full_lifecycle(self):
        # Create event
        evt_res = self.client.post("/events", json={
            "bus_id": "BUS-101",
            "event_type": "ROAD_DEFECT",
            "confidence": 0.89,
            "latitude": 12.9790,
            "longitude": 77.6340,
            "severity": "HIGH",
            "location_name": "100ft Road"
        })
        evt_id = evt_res.json()["event_id"]

        # Create work order
        wo_res = self.client.post("/work-orders", json={
            "event_id": evt_id,
            "title": "Repair Surface Depression",
            "priority": "HIGH",
            "status": "OPEN",
            "assigned_to": "BBMP Quick Response Team"
        })
        self.assertEqual(wo_res.status_code, 201)
        wo_id = wo_res.json()["work_order_id"]

        # Transition status to RESOLVED
        up_res = self.client.patch(f"/work-orders/{wo_id}", json={"status": "RESOLVED"})
        self.assertEqual(up_res.status_code, 200)
        self.assertEqual(up_res.json()["status"], "RESOLVED")

        # Verify linked event is now RESOLVED as well
        evt_check = self.client.get(f"/events/{evt_id}")
        self.assertEqual(evt_check.status_code, 200)
        self.assertEqual(evt_check.json()["status"], "RESOLVED")

    def test_04_websocket_connection(self):
        with self.client.websocket_connect("/ws/events") as websocket:
            websocket.send_text("ping")
            data = websocket.receive_text()
            self.assertEqual(data, "pong")

if __name__ == "__main__":
    unittest.main()
