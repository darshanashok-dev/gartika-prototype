"""
YOLOv8 Road Defect & Pothole Model Training Pipeline for Gartika Urban Intelligence.

This module provides a complete end-to-end training and fine-tuning pipeline
for custom road defect identification (Potholes, Cracks, Manholes, Surface Hazards)
using Ultralytics YOLOv8 transfer learning.
"""

import sys
import os
import argparse
import logging
from pathlib import Path

# Add project root to path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("gartika.ai.train")

def create_dataset_template(dataset_dir: Path):
    """
    Initialize a standard YOLO format dataset directory structure and data.yaml template.
    
    Directory Structure:
        dataset_dir/
          ├── data.yaml
          ├── images/
          │    ├── train/
          │    └── val/
          └── labels/
               ├── train/
               └── val/
               
    Args:
        dataset_dir: Root path for the dataset.
    """
    train_img = dataset_dir / "images" / "train"
    val_img = dataset_dir / "images" / "val"
    train_lbl = dataset_dir / "labels" / "train"
    val_lbl = dataset_dir / "labels" / "val"

    for d in [train_img, val_img, train_lbl, val_lbl]:
        d.mkdir(parents=True, exist_ok=True)

    yaml_path = dataset_dir / "data.yaml"
    if not yaml_path.exists():
        yaml_content = f"""# Gartika Road Defect Identification Dataset Configuration
path: {dataset_dir.resolve()}
train: images/train
val: images/val

# Road Defect Classes
names:
  0: pothole
  1: longitudinal_crack
  2: alligator_crack
  3: manhole
"""
        with open(yaml_path, "w") as f:
            f.write(yaml_content)
        logger.info(f"[DATASET] Created dataset template at {yaml_path}")
    else:
        logger.info(f"[DATASET] Dataset configuration already exists at {yaml_path}")

def train_road_model(
    data_yaml: str,
    base_model: str = "yolov8n.pt",
    epochs: int = 30,
    imgsz: int = 640,
    batch_size: int = 8,
    device: str = "cpu",
    output_model_path: str = "ai/models/pothole_yolov8.pt"
):
    """
    Fine-tune YOLOv8 on custom road defect dataset.
    
    Args:
        data_yaml: Path to data.yaml dataset definition file.
        base_model: Pretrained YOLOv8 checkpoint (e.g. 'yolov8n.pt', 'yolov8s.pt').
        epochs: Number of training epochs.
        imgsz: Training image input resolution (e.g. 640).
        batch_size: Mini-batch size.
        device: Compute device ('cpu', '0', '0,1', 'cuda').
        output_model_path: Path to copy the best trained weights.
    """
    from ultralytics import YOLO

    data_path = Path(data_yaml)
    if not data_path.exists():
        logger.error(f"[ERROR] Dataset configuration file not found at: {data_yaml}")
        print("\nTip: Run with --init-dataset to create the directory template.")
        return False

    logger.info("=" * 55)
    logger.info("   GARTIKA AI — ROAD DEFECT MODEL TRAINING")
    logger.info("=" * 55)
    logger.info(f"Base Checkpoint : {base_model}")
    logger.info(f"Dataset YAML    : {data_yaml}")
    logger.info(f"Epochs          : {epochs}")
    logger.info(f"Image Resolution: {imgsz}x{imgsz}")
    logger.info(f"Batch Size      : {batch_size}")
    logger.info(f"Compute Device  : {device}")
    logger.info("=" * 55)

    # 1. Load pretrained model
    logger.info(f"[AI] Initializing base model {base_model}...")
    model = YOLO(base_model)

    # 2. Train model
    logger.info("[AI] Starting training loop...")
    results = model.train(
        data=str(data_path.resolve()),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch_size,
        device=device,
        project=str(BASE_DIR / "runs" / "defect_train"),
        name="road_model",
        exist_ok=True,
        plots=True
    )

    # 3. Locate best model weights and export to ai/models/
    runs_dir = BASE_DIR / "runs" / "defect_train" / "road_model" / "weights" / "best.pt"
    out_path = BASE_DIR / output_model_path
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if runs_dir.exists():
        import shutil
        shutil.copy(runs_dir, out_path)
        logger.info(f"[SUCCESS] Trained model saved to: {out_path}")
        print("\n" + "=" * 55)
        print(f"✓ Training Complete!")
        print(f"✓ Best Model Weights: {out_path}")
        print("✓ Gartika inference pipeline will automatically use this model.")
        print("=" * 55 + "\n")
        return True
    else:
        logger.warning(f"[WARNING] Could not find best.pt at {runs_dir}")
        return False

def main():
    """
    Command-line interface for model training and dataset setup.
    """
    parser = argparse.ArgumentParser(description="Gartika YOLOv8 Model Training Pipeline")
    parser.add_argument("--data", type=str, default="data/datasets/road_defects/data.yaml", help="Path to data.yaml")
    parser.add_argument("--base", type=str, default="yolov8n.pt", help="Base model weights (default: yolov8n.pt)")
    parser.add_argument("--epochs", type=int, default=25, help="Number of training epochs (default: 25)")
    parser.add_argument("--imgsz", type=int, default=640, help="Image resolution size (default: 640)")
    parser.add_argument("--batch", type=int, default=8, help="Batch size (default: 8)")
    parser.add_argument("--device", type=str, default="cpu", help="Compute device ('cpu' or '0' for GPU)")
    parser.add_argument("--init-dataset", action="store_true", help="Initialize standard dataset folder structure")
    parser.add_argument("--output", type=str, default="ai/models/pothole_yolov8.pt", help="Target model output path")

    args = parser.parse_args()

    dataset_dir = BASE_DIR / "data" / "datasets" / "road_defects"

    if args.init_dataset or not (BASE_DIR / args.data).exists():
        create_dataset_template(dataset_dir)
        if args.init_dataset:
            print(f"\n[INFO] Dataset structure created in {dataset_dir}")
            print("1. Place training images in: data/datasets/road_defects/images/train/")
            print("2. Place training labels in: data/datasets/road_defects/labels/train/")
            print("3. Place validation images in: data/datasets/road_defects/images/val/")
            print("4. Place validation labels in: data/datasets/road_defects/labels/val/")
            print("5. Run: python3 ai/train.py --epochs 30\n")
            return

    train_road_model(
        data_yaml=args.data,
        base_model=args.base,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch_size=args.batch,
        device=args.device,
        output_model_path=args.output
    )

if __name__ == "__main__":
    main()
