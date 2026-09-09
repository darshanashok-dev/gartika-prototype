"""
Gartika Dataset Validator.

Performs rigorous structural, numerical, and format validation on YOLO-formatted
road defect datasets before starting training. Detects out-of-bounds coordinates,
unnormalized values, corrupted image headers, duplicate annotations, and invalid class indices.
"""

import sys
import logging
from pathlib import Path
import cv2
import yaml

BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_DIR = BASE_DIR / "dataset"
DATA_YAML = DATASET_DIR / "data.yaml"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("gartika.training.validate")

def validate_dataset(data_yaml_path: Path = DATA_YAML) -> bool:
    """
    Validate dataset configuration, image integrity, and label format across train/val/test splits.
    """
    logger.info("=" * 60)
    logger.info("       GARTIKA AI — DATASET VALIDATION AUDITOR")
    logger.info("=" * 60)

    if not data_yaml_path.exists():
        logger.error(f"[ERROR] data.yaml not found at {data_yaml_path}")
        return False

    with open(data_yaml_path, "r") as f:
        config = yaml.safe_load(f)

    nc = config.get("nc", 4)
    names = config.get("names", {})
    logger.info(f"Dataset root: {config.get('path', DATASET_DIR)}")
    logger.info(f"Number of classes: {nc}")
    logger.info(f"Class names: {names}")

    splits = ["train", "val", "test"]
    total_images_checked = 0
    total_labels_checked = 0
    total_boxes_checked = 0
    
    issues = {
        "corrupted_images": [],
        "missing_label_files": [],
        "invalid_label_format": [],
        "out_of_bounds_coords": [],
        "unnormalized_coords": [],
        "invalid_class_ids": [],
        "zero_area_boxes": [],
        "duplicate_boxes": []
    }

    for split in splits:
        img_dir = DATASET_DIR / "images" / split
        lbl_dir = DATASET_DIR / "labels" / split

        if not img_dir.exists():
            logger.warning(f"Split image directory {img_dir} does not exist.")
            continue

        images = list(img_dir.glob("*.*"))
        logger.info(f"Auditing '{split}' split ({len(images)} images)...")

        for img_path in images:
            total_images_checked += 1
            # 1. Check image readability and dimensions
            img = cv2.imread(str(img_path))
            if img is None:
                issues["corrupted_images"].append(f"{split}/{img_path.name}")
                continue

            h, w = img.shape[:2]
            if h <= 0 or w <= 0:
                issues["corrupted_images"].append(f"{split}/{img_path.name} (zero dimensions)")
                continue

            # 2. Check corresponding label file
            lbl_path = lbl_dir / f"{img_path.stem}.txt"
            if not lbl_path.exists():
                issues["missing_label_files"].append(f"{split}/{img_path.stem}.txt")
                continue

            total_labels_checked += 1
            with open(lbl_path, "r") as f:
                lines = [l.strip() for l in f if l.strip()]

            seen_boxes = set()
            for line_idx, line in enumerate(lines, 1):
                total_boxes_checked += 1
                parts = line.split()
                if len(parts) != 5:
                    issues["invalid_label_format"].append(f"{lbl_path.name}:L{line_idx} (expected 5 fields, got {len(parts)})")
                    continue

                try:
                    cls_id = int(parts[0])
                    bx = float(parts[1])
                    by = float(parts[2])
                    bw = float(parts[3])
                    bh = float(parts[4])
                except ValueError:
                    issues["invalid_label_format"].append(f"{lbl_path.name}:L{line_idx} (non-numeric values)")
                    continue

                # Validate class ID
                if cls_id < 0 or cls_id >= nc:
                    issues["invalid_class_ids"].append(f"{lbl_path.name}:L{line_idx} (class ID {cls_id} not in 0..{nc-1})")

                # Validate normalized range [0.0, 1.0]
                if any(v < 0.0 or v > 1.0 for v in [bx, by, bw, bh]):
                    issues["unnormalized_coords"].append(f"{lbl_path.name}:L{line_idx} (coords not normalized in 0..1)")

                # Validate bounding box boundaries
                x1 = bx - bw / 2.0
                y1 = by - bh / 2.0
                x2 = bx + bw / 2.0
                y2 = by + bh / 2.0
                if x1 < -0.05 or y1 < -0.05 or x2 > 1.05 or y2 > 1.05:
                    issues["out_of_bounds_coords"].append(f"{lbl_path.name}:L{line_idx} ([{x1:.2f}, {y1:.2f}, {x2:.2f}, {y2:.2f}])")

                # Validate box area
                if bw <= 0.001 or bh <= 0.001:
                    issues["zero_area_boxes"].append(f"{lbl_path.name}:L{line_idx} (w={bw}, h={bh})")

                # Check duplicate box annotations
                box_tuple = (cls_id, round(bx, 4), round(by, 4), round(bw, 4), round(bh, 4))
                if box_tuple in seen_boxes:
                    issues["duplicate_boxes"].append(f"{lbl_path.name}:L{line_idx} (duplicate annotation)")
                seen_boxes.add(box_tuple)

    # Output audit summary
    print("\n" + "=" * 55)
    print("           DATASET AUDIT REPORT")
    print("=" * 55)
    print(f"Total Images Validated  : {total_images_checked}")
    print(f"Total Labels Validated  : {total_labels_checked}")
    print(f"Total BBoxes Checked    : {total_boxes_checked}")
    print("-" * 55)

    has_errors = False
    for category, err_list in issues.items():
        if err_list:
            print(f"✗ {category.replace('_', ' ').title()}: {len(err_list)}")
            for item in err_list[:5]:
                print(f"    - {item}")
            if len(err_list) > 5:
                print(f"    ... and {len(err_list)-5} more")
            has_errors = True
        else:
            print(f"✓ {category.replace('_', ' ').title()}: 0 issues")

    print("=" * 55)
    if has_errors:
        logger.error("[AUDIT FAILED] Identified invalid annotations in dataset.")
        return False
    else:
        logger.info("[AUDIT PASSED] Dataset is 100% compliant with YOLO standards!")
        return True

if __name__ == "__main__":
    success = validate_dataset()
    sys.exit(0 if success else 1)
