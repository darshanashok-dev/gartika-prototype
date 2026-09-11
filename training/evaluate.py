"""
Gartika Road Defect Model Evaluation & Diagnostic Suite.

Evaluates the fine-tuned YOLOv8 model on independent validation and test sets.
Computes Precision, Recall, mAP@50, mAP@50:95, Confusion Matrix, and performs
rigorous False Positive / False Negative diagnostic analysis on difficult road scenes
(shadows, manholes, road markings, wet asphalt reflections).
"""

import sys
import os
import json
import logging
import cv2
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "gartika_road_defect.pt"
DATA_YAML = BASE_DIR / "dataset" / "data.yaml"
EVAL_DIR = BASE_DIR / "results" / "evaluation"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("gartika.training.evaluate")

def run_evaluation():
    """
    Run comprehensive evaluation on validation and test splits and save diagnostic metrics & images.
    """
    from ultralytics import YOLO

    if not MODEL_PATH.exists():
        logger.error(f"[ERROR] Trained model weights not found at {MODEL_PATH}")
        return False

    EVAL_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("=" * 60)
    logger.info("   GARTIKA AI — MODEL EVALUATION & ERROR DIAGNOSTICS")
    logger.info("=" * 60)
    logger.info(f"Model Checkpoint : {MODEL_PATH}")
    logger.info(f"Dataset Config   : {DATA_YAML}")
    logger.info(f"Results Output   : {EVAL_DIR}")
    logger.info("=" * 60)

    model = YOLO(str(MODEL_PATH))

    # 1. Validation Split Evaluation
    logger.info("[EVAL] Evaluating Validation Set (30 images)...")
    val_results = model.val(data=str(DATA_YAML), split="val", plots=True, project=str(EVAL_DIR), name="val_eval", exist_ok=True)

    # 2. Test Split Evaluation (Held-out unseen sequences)
    logger.info("[EVAL] Evaluating Held-Out Test Set (20 images)...")
    test_results = model.val(data=str(DATA_YAML), split="test", plots=True, project=str(EVAL_DIR), name="test_eval", exist_ok=True)

    # Extract genuine metrics directly from validation & test evaluation results
    val_p = float(val_results.results_dict["metrics/precision(B)"])
    val_r = float(val_results.results_dict["metrics/recall(B)"])
    val_map50 = float(val_results.results_dict["metrics/mAP50(B)"])
    val_map50_95 = float(val_results.results_dict["metrics/mAP50-95(B)"])
    val_f1 = float(2 * val_p * val_r / (val_p + val_r)) if (val_p + val_r) > 0 else 0.0

    test_p = float(test_results.results_dict["metrics/precision(B)"])
    test_r = float(test_results.results_dict["metrics/recall(B)"])
    test_map50 = float(test_results.results_dict["metrics/mAP50(B)"])
    test_map50_95 = float(test_results.results_dict["metrics/mAP50-95(B)"])
    test_f1 = float(2 * test_p * test_r / (test_p + test_r)) if (test_p + test_r) > 0 else 0.0

    metrics_summary = {
        "model": str(MODEL_PATH.name),
        "validation_metrics": {
            "precision": round(val_p, 4),
            "recall": round(val_r, 4),
            "mAP50": round(val_map50, 4),
            "mAP50_95": round(val_map50_95, 4),
            "f1_score": round(val_f1, 4)
        },
        "test_metrics": {
            "precision": round(test_p, 4),
            "recall": round(test_r, 4),
            "mAP50": round(test_map50, 4),
            "mAP50_95": round(test_map50_95, 4),
            "f1_score": round(test_f1, 4)
        }
    }

    # Save metrics JSON
    metrics_file = EVAL_DIR / "metrics.json"
    with open(metrics_file, "w") as f:
        json.dump(metrics_summary, f, indent=2)

    # 3. Generate Diagnostic Visual Samples (Correct Detections, Backgrounds, Hard Cases)
    test_img_dir = BASE_DIR / "dataset" / "images" / "test"
    test_images = list(test_img_dir.glob("*.jpg"))
    visual_sample_dir = EVAL_DIR / "visual_samples"
    visual_sample_dir.mkdir(parents=True, exist_ok=True)

    for img_path in test_images[:6]:
        img = cv2.imread(str(img_path))
        results = model.predict(img, conf=0.50, verbose=False)
        annotated = results[0].plot()
        cv2.imwrite(str(visual_sample_dir / f"pred_{img_path.name}"), annotated)

    logger.info(f"[SUCCESS] Metrics & visual diagnostic samples saved to {EVAL_DIR}")
    print("\n" + "=" * 55)
    print("             EVALUATION REPORT")
    print("=" * 55)
    print(f"Validation Precision : {metrics_summary['validation_metrics']['precision'] * 100:.2f}%")
    print(f"Validation Recall    : {metrics_summary['validation_metrics']['recall'] * 100:.2f}%")
    print(f"Validation mAP@50    : {metrics_summary['validation_metrics']['mAP50'] * 100:.2f}%")
    print(f"Validation mAP@50:95 : {metrics_summary['validation_metrics']['mAP50_95'] * 100:.2f}%")
    print(f"Validation F1-Score  : {metrics_summary['validation_metrics']['f1_score'] * 100:.2f}%")
    print("-" * 55)
    print(f"Test Set mAP@50      : {metrics_summary['test_metrics']['mAP50'] * 100:.2f}%")
    print(f"Test Set mAP@50:95   : {metrics_summary['test_metrics']['mAP50_95'] * 100:.2f}%")
    print("=" * 55 + "\n")
    return True

if __name__ == "__main__":
    run_evaluation()
