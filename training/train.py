"""
Gartika YOLOv8 Road Defect Model Training Pipeline.

Trains custom YOLOv8 object detection models (YOLOv8n / YOLOv8s) on the Gartika
road surface dataset with road-specific data augmentation (simulating moving bus vibrations,
perspective shifts, sunlight variations, and wet reflections).
"""

import sys
import os
import argparse
import logging
import shutil
from pathlib import Path
import torch

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_YAML = BASE_DIR / "dataset" / "data.yaml"
OUTPUT_MODEL = BASE_DIR / "models" / "gartika_road_defect.pt"
RESULTS_DIR = BASE_DIR / "results" / "training"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("gartika.training.train")

def detect_best_device() -> str:
    """
    Automatically detect the best available compute hardware.
    Returns: 'cuda:0', 'mps', or 'cpu'.
    """
    if torch.cuda.is_available():
        device_name = torch.cuda.get_device_name(0)
        logger.info(f"[HARDWARE] NVIDIA CUDA GPU detected: {device_name}")
        return "0"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        logger.info("[HARDWARE] Apple Silicon MPS accelerator detected.")
        return "mps"
    else:
        logger.info("[HARDWARE] No GPU detected. Running on multi-threaded CPU.")
        return "cpu"

def train_model(
    data_yaml: str = str(DATA_YAML),
    model_variant: str = "yolov8n.pt",
    epochs: int = 30,
    imgsz: int = 640,
    batch_size: int = 8,
    lr0: float = 0.01,
    device: str = None,
    patience: int = 15
):
    """
    Execute YOLOv8 transfer learning with road-specific augmentation hyperparameters.
    """
    from ultralytics import YOLO

    if device is None:
        device = detect_best_device()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_MODEL.parent.mkdir(parents=True, exist_ok=True)

    logger.info("=" * 60)
    logger.info("   GARTIKA AI — ROAD DEFECT MODEL TRAINING PIPELINE")
    logger.info("=" * 60)
    logger.info(f"Model Variant   : {model_variant} (Ultra-lightweight edge architecture)")
    logger.info(f"Dataset Config  : {data_yaml}")
    logger.info(f"Input Resolution: {imgsz}x{imgsz}")
    logger.info(f"Epochs          : {epochs}")
    logger.info(f"Batch Size      : {batch_size}")
    logger.info(f"Initial LR      : {lr0}")
    logger.info(f"Compute Device  : {device}")
    logger.info(f"Target Output   : {OUTPUT_MODEL}")
    logger.info("=" * 60)

    # Load pretrained base checkpoint
    logger.info(f"[AI] Initializing base weights: {model_variant}...")
    model = YOLO(model_variant)

    # Road-tailored data augmentation strategy
    train_args = {
        "data": str(Path(data_yaml).resolve()),
        "epochs": epochs,
        "imgsz": imgsz,
        "batch": batch_size,
        "lr0": lr0,
        "patience": patience,
        "device": device,
        "project": str(BASE_DIR / "runs" / "road_train"),
        "name": "gartika_defect_run",
        "exist_ok": True,
        "plots": True,
        "save": True,
        "save_period": -1,
        # Realistic Road Augmentation:
        "hsv_h": 0.015,     # Subtle color shifts
        "hsv_s": 0.35,      # Saturation variance (dry vs wet asphalt)
        "hsv_v": 0.40,      # Daylight/overcast brightness shifts
        "degrees": 4.0,     # Mild bus cabin pitch/roll tilt
        "translate": 0.08,  # Minor camera displacement on windshield
        "scale": 0.20,      # Distance variations from pothole
        "fliplr": 0.50,     # Road lanes are horizontally symmetric
        "flipud": 0.0,      # Roads never appear upside down (disabled)
        "mosaic": 0.50,     # Multi-hazard composite scenes
        "mixup": 0.05       # Subtle texture mixing
    }

    logger.info("[AI] Launching training execution loop...")
    results = model.train(**train_args)

    # Copy best model weights to models/gartika_road_defect.pt
    run_best = BASE_DIR / "runs" / "road_train" / "gartika_defect_run" / "weights" / "best.pt"
    run_last = BASE_DIR / "runs" / "road_train" / "gartika_defect_run" / "weights" / "last.pt"

    if run_best.exists():
        shutil.copy2(run_best, OUTPUT_MODEL)
        logger.info(f"[SUCCESS] Best model exported to: {OUTPUT_MODEL}")
    elif run_last.exists():
        shutil.copy2(run_last, OUTPUT_MODEL)
        logger.info(f"[SUCCESS] Final model exported to: {OUTPUT_MODEL}")

    # Copy training plots to results/training/
    run_dir = BASE_DIR / "runs" / "road_train" / "gartika_defect_run"
    for plot_file in ["results.png", "confusion_matrix.png", "F1_curve.png", "PR_curve.png"]:
        src = run_dir / plot_file
        if src.exists():
            shutil.copy2(src, RESULTS_DIR / plot_file)

    print("\n" + "=" * 55)
    print("         TRAINING COMPLETED SUCCESSFULLY")
    print("=" * 55)
    print(f"✓ Trained Model Weights : {OUTPUT_MODEL}")
    print(f"✓ Training Artifacts   : {RESULTS_DIR}")
    print("=" * 55 + "\n")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gartika Road Defect Training Script")
    parser.add_argument("--data", type=str, default=str(DATA_YAML), help="Path to data.yaml")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="YOLOv8 variant (yolov8n.pt, yolov8s.pt)")
    parser.add_argument("--epochs", type=int, default=20, help="Training epochs")
    parser.add_argument("--imgsz", type=int, default=640, help="Image resolution")
    parser.add_argument("--batch", type=int, default=8, help="Batch size")
    parser.add_argument("--lr", type=float, default=0.01, help="Initial learning rate")
    parser.add_argument("--device", type=str, default=None, help="Compute device ('cpu', '0', 'mps')")

    args = parser.parse_args()
    train_model(
        data_yaml=args.data,
        model_variant=args.model,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch_size=args.batch,
        lr0=args.lr,
        device=args.device
    )
