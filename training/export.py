"""
Gartika Model Export Tool.

Exports trained PyTorch YOLOv8 weights (.pt) to deployment-ready formats,
including ONNX (.onnx) with dynamic shape support for edge AI inference accelerators.
"""

import sys
import logging
from pathlib import Path
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "gartika_road_defect.pt"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("gartika.training.export")

def export_model(weights_path: Path = MODEL_PATH, formats=["onnx"]):
    """
    Export trained model weights to ONNX format.
    """
    if not weights_path.exists():
        logger.error(f"Weights file not found at {weights_path}")
        return False

    logger.info("=" * 60)
    logger.info("       GARTIKA AI — MODEL EXPORT PIPELINE")
    logger.info("=" * 60)
    logger.info(f"Source Weights: {weights_path}")
    logger.info(f"Target Formats: {formats}")
    logger.info("=" * 60)

    model = YOLO(str(weights_path))

    for fmt in formats:
        try:
            logger.info(f"[EXPORT] Exporting to {fmt.upper()}...")
            out_file = model.export(format=fmt, imgsz=640, dynamic=True)
            logger.info(f"[SUCCESS] Exported {fmt.upper()} to: {out_file}")
        except Exception as e:
            logger.warning(f"[WARNING] Export to {fmt} failed: {e}")

    return True

if __name__ == "__main__":
    export_model()
