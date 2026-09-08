import sys
import unittest
import numpy as np
import cv2
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from ai.detector import VehicleDetector
from ai.tracker import ByteTracker, calculate_iou
from ai.pothole_detector import PotholeDetector
from ai.event_generator import EventGenerator, haversine_distance
from ai.video_processor import VideoProcessor, create_synthetic_road_video

class TestAiPipeline(unittest.TestCase):
    def setUp(self):
        self.detector = VehicleDetector(conf_threshold=0.3)
        self.tracker = ByteTracker(max_lost_frames=10, iou_threshold=0.2)
        self.pothole_detector = PotholeDetector(conf_threshold=0.4)
        self.event_gen = EventGenerator(cooldown_seconds=2.0, distance_threshold_meters=15.0)

    def test_01_iou_calculation(self):
        box1 = [10, 10, 50, 50]
        box2 = [10, 10, 50, 50]
        iou_exact = calculate_iou(box1, box2)
        self.assertAlmostEqual(iou_exact, 1.0, places=2)

        box3 = [100, 100, 150, 150]
        iou_none = calculate_iou(box1, box3)
        self.assertEqual(iou_none, 0.0)

    def test_02_tracker_persistence(self):
        dets_frame1 = [
            {"bbox": [50, 50, 120, 120], "class_name": "car", "confidence": 0.9},
            {"bbox": [200, 100, 260, 180], "class_name": "bus", "confidence": 0.85}
        ]
        tracks1 = self.tracker.update(dets_frame1)
        self.assertEqual(len(tracks1), 2)
        id1 = tracks1[0]["track_id"]
        id2 = tracks1[1]["track_id"]

        # Slight movement in frame 2
        dets_frame2 = [
            {"bbox": [55, 53, 125, 123], "class_name": "car", "confidence": 0.91},
            {"bbox": [203, 104, 264, 185], "class_name": "bus", "confidence": 0.88}
        ]
        tracks2 = self.tracker.update(dets_frame2)
        self.assertEqual(len(tracks2), 2)
        # Track IDs should remain persistent
        self.assertEqual(tracks2[0]["track_id"], id1)
        self.assertEqual(tracks2[1]["track_id"], id2)

    def test_03_pothole_detector_and_imu_fusion(self):
        # Create test frame with dark depression in road region
        frame = np.ones((480, 640, 3), dtype=np.uint8) * 120
        # Road region
        frame[240:, :] = 70
        # Draw dark pothole in road
        cv2.ellipse(frame, (320, 360), (45, 20), 0, 0, 360, (15, 15, 15), -1)

        # Baseline visual detection
        defects_base = self.pothole_detector.detect(frame)
        self.assertTrue(len(defects_base) >= 1)
        base_conf = defects_base[0]["confidence"]

        # With High IMU Vibration Fusion
        imu_bump = {"ax": 1.2, "ay": 0.8, "az": 14.5} # shock
        defects_fused = self.pothole_detector.detect(frame, imu_data=imu_bump)
        self.assertTrue(len(defects_fused) >= 1)
        fused_conf = defects_fused[0]["confidence"]

        # Verify confidence boost from sensor fusion
        self.assertGreater(fused_conf, base_conf)
        self.assertEqual(defects_fused[0]["vibration_level"], "HIGH")

    def test_04_event_generator_deduplication(self):
        defect = {
            "event_type": "POTHOLE",
            "confidence": 0.92,
            "severity": "HIGH",
            "bbox": [100, 200, 200, 280]
        }
        test_frame = np.zeros((480, 640, 3), dtype=np.uint8)

        # First detection event should succeed
        evt1 = self.event_gen.create_pothole_event(
            defect=defect,
            frame=test_frame,
            bus_id="BUS-101",
            lat=12.9716,
            lon=77.5946
        )
        self.assertIsNotNone(evt1)
        self.assertIn("EVT-POTH", evt1["event_id"])

        # Immediate second detection at same location (distance < 20m, time < 2s) should be suppressed
        evt2 = self.event_gen.create_pothole_event(
            defect=defect,
            frame=test_frame,
            bus_id="BUS-101",
            lat=12.971602,
            lon=77.594601
        )
        self.assertIsNone(evt2)

    def test_05_haversine_distance(self):
        # Distance between Bangalore MG Road and Trinity Circle (~800m)
        d = haversine_distance(12.971598, 77.594562, 12.972854, 77.601243)
        self.assertTrue(500 < d < 1200)

    def test_06_synthetic_video_creation(self):
        test_video_path = "/tmp/test_road.mp4"
        create_synthetic_road_video(test_video_path, duration_sec=1, fps=10)
        self.assertTrue(Path(test_video_path).exists())
        self.assertGreater(Path(test_video_path).stat().st_size, 1000)

if __name__ == "__main__":
    unittest.main()
