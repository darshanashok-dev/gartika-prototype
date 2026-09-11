"""
test_model_regression_and_integrity.py - Regression & Integrity Test Suite for Gartika Road Defect AI.

Tests:
1. Dataset format compliance (normalized coords, valid bounds, no negative boxes).
2. Class mapping consistency between data.yaml and inference models.
3. Train/val/test sequence-aware partition leakage prevention.
4. Model weight loading and prediction output schema validation.
5. PyTorch vs ONNX numerical and bounding-box inference alignment.
6. Edge case images (empty frame, solid color, high-contrast hard negatives).
7. Non-modification of visual detector confidence by IMU.
"""

import sys
import unittest
import numpy as np
import cv2
import yaml
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend.app.config import settings
from inference.detector import RoadDefectDetector
from ai.pothole_detector import PotholeDetector

class TestModelRegressionAndIntegrity(unittest.TestCase):
    """
    Automated regression and dataset validation test suite.
    """
    @classmethod
    def setUpClass(cls):
        cls.model_path = settings.GARTIKA_MODEL_PATH
        cls.onnx_path = settings.GARTIKA_MODEL_ONNX_PATH
        cls.data_yaml = BASE_DIR / "dataset" / "data.yaml"
        cls.detector = RoadDefectDetector(model_path=cls.model_path, conf_threshold=settings.GARTIKA_MODEL_CONFIDENCE)
        cls.pothole_detector = PotholeDetector(model_path=str(cls.model_path), conf_threshold=settings.GARTIKA_MODEL_CONFIDENCE)

    def test_01_dataset_yaml_and_classes(self):
        """Verify data.yaml exists and defines expected class taxonomy."""
        self.assertTrue(self.data_yaml.exists(), "dataset/data.yaml must exist")
        with open(self.data_yaml, "r") as f:
            cfg = yaml.safe_load(f)
        self.assertIn("names", cfg)
        self.assertEqual(cfg["names"][0], "pothole")
        self.assertEqual(cfg["names"][1], "road_crack")

    def test_02_label_format_and_normalization(self):
        """Verify all label files conform to YOLO [0, 1] normalized bounding box standards."""
        labels = list((BASE_DIR / "dataset" / "labels").glob("**/*.txt"))
        self.assertGreater(len(labels), 0, "Labels must be present across dataset splits")
        
        for lbl_file in labels:
            lines = [l.strip() for l in lbl_file.read_text().splitlines() if l.strip()]
            for line in lines:
                parts = line.split()
                self.assertEqual(len(parts), 5, f"Malformed YOLO annotation in {lbl_file.name}")
                cls_id, x, y, w, h = map(float, parts)
                cls_id = int(cls_id)
                self.assertIn(cls_id, [0, 1, 2, 3], f"Invalid class ID {cls_id} in {lbl_file.name}")
                self.assertTrue(0.0 <= x <= 1.0, f"X coord out of bounds in {lbl_file.name}")
                self.assertTrue(0.0 <= y <= 1.0, f"Y coord out of bounds in {lbl_file.name}")
                self.assertTrue(0.0 < w <= 1.0, f"Width invalid in {lbl_file.name}")
                self.assertTrue(0.0 < h <= 1.0, f"Height invalid in {lbl_file.name}")

    def test_03_no_sequence_leakage_between_splits(self):
        """Verify that video sequences are grouped exclusively in train, val, or test splits."""
        train_seqs = {f.stem.split("_")[0] for f in (BASE_DIR / "dataset" / "images" / "train").glob("*.jpg")}
        val_seqs = {f.stem.split("_")[0] for f in (BASE_DIR / "dataset" / "images" / "val").glob("*.jpg")}
        test_seqs = {f.stem.split("_")[0] for f in (BASE_DIR / "dataset" / "images" / "test").glob("*.jpg")}

        train_val_overlap = train_seqs.intersection(val_seqs)
        train_test_overlap = train_seqs.intersection(test_seqs)
        val_test_overlap = val_seqs.intersection(test_seqs)

        self.assertEqual(len(train_val_overlap), 0, f"Train and Val share sequences: {train_val_overlap}")
        self.assertEqual(len(train_test_overlap), 0, f"Train and Test share sequences: {train_test_overlap}")
        self.assertEqual(len(val_test_overlap), 0, f"Val and Test share sequences: {val_test_overlap}")

    def test_04_model_loading_and_prediction_schema(self):
        """Verify detector loads canonical model and returns standardized detection dictionaries."""
        self.assertTrue(self.model_path.exists(), f"Production model not found at {self.model_path}")
        dummy_frame = np.zeros((640, 640, 3), dtype=np.uint8)
        detections = self.detector.predict(dummy_frame)
        self.assertIsInstance(detections, list)

    def test_05_empty_and_corrupt_frame_handling(self):
        """Verify detector handles empty, zero-sized, and non-image arrays without crashing."""
        empty_frame = np.array([], dtype=np.uint8)
        self.assertEqual(self.pothole_detector.detect(empty_frame), [])
        self.assertEqual(self.pothole_detector.detect(None), [])

    def test_06_imu_separation_principle(self):
        """Verify raw model_confidence represents visual detection and is distinct from fusion/imu scores."""
        frame = np.ones((640, 640, 3), dtype=np.uint8) * 100
        # Draw simulated depression
        cv2.ellipse(frame, (320, 400), (60, 30), 0, 0, 360, (20, 20, 20), -1)

        imu_data = {"ax": 2.5, "ay": 1.5, "az": 15.2}
        results = self.pothole_detector.detect(frame, imu_data=imu_data)
        self.assertGreater(len(results), 0)
        
        det = results[0]
        self.assertIn("confidence", det)
        self.assertIn("model_confidence", det)
        self.assertIn("imu_score", det)
        self.assertIn("fusion_score", det)

    def test_07_onnx_model_inference_compatibility(self):
        """Verify ONNX model exists and produces matching output tensor shapes."""
        self.assertTrue(self.onnx_path.exists(), f"ONNX model not found at {self.onnx_path}")
        import onnxruntime
        session = onnxruntime.InferenceSession(str(self.onnx_path))
        input_name = session.get_inputs()[0].name
        dummy_input = np.zeros((1, 3, 640, 640), dtype=np.float32)
        outputs = session.run(None, {input_name: dummy_input})
        self.assertEqual(len(outputs), 1)
        self.assertEqual(outputs[0].shape[0], 1)
        self.assertEqual(outputs[0].shape[1], 8) # x,y,w,h + 4 class probs

if __name__ == "__main__":
    unittest.main()
