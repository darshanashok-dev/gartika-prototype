import sys
import unittest
import io
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import engine, Base
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

        filter_res = self.client.get("/events?event_type=POTHOLE")
        self.assertEqual(filter_res.status_code, 200)
        events = filter_res.json()
        self.assertTrue(all(e["event_type"] == "POTHOLE" for e in events))

        patch_res = self.client.patch(f"/events/{evt_id}", json={"status": "REVIEWED"})
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.json()["status"], "REVIEWED")

    def test_03_work_order_full_lifecycle(self):
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

        wo_res = self.client.post("/work-orders", json={
            "event_id": evt_id,
            "title": "Repair Surface Depression",
            "priority": "HIGH",
            "status": "OPEN",
            "assigned_to": "BBMP Quick Response Team"
        })
        self.assertEqual(wo_res.status_code, 201)
        wo_id = wo_res.json()["work_order_id"]

        up_res = self.client.patch(f"/work-orders/{wo_id}", json={"status": "RESOLVED"})
        self.assertEqual(up_res.status_code, 200)
        self.assertEqual(up_res.json()["status"], "RESOLVED")

        evt_check = self.client.get(f"/events/{evt_id}")
        self.assertEqual(evt_check.status_code, 200)
        self.assertEqual(evt_check.json()["status"], "RESOLVED")

    def test_04_websocket_connection(self):
        with self.client.websocket_connect("/ws/events") as websocket:
            init_data = websocket.receive_json()
            self.assertEqual(init_data.get("type"), "CONNECTION_ESTABLISHED")
            
            websocket.send_text("ping")
            data = websocket.receive_text()
            self.assertEqual(data, "pong")

    def test_05_stream_frame_upload_and_preview(self):
        dummy_jpeg = io.BytesIO(b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' \",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00\n\x00\n\x01\x01\x11\x00\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9')
        res = self.client.post("/stream/frame", data={"bus_id": "BUS-101"}, files={"frame": ("frame.jpg", dummy_jpeg, "image/jpeg")})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")

        preview_res = self.client.get("/stream/latest-frame")
        self.assertEqual(preview_res.status_code, 200)
        self.assertEqual(preview_res.headers["content-type"], "image/jpeg")

    def test_06_telemetry_bump_sensor_fusion(self):
        res = self.client.post("/telemetry", json={
            "bus_id": "BUS-101",
            "latitude": 12.9754,
            "longitude": 77.6152,
            "speed": 34.0,
            "az": 16.5
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["bus_id"], "BUS-101")

if __name__ == "__main__":
    unittest.main()
