"""
Gartika Dataset Preparation & Leakage-Free Sequence Splitter.

Splits raw annotated road images into Train (70%), Validation (20%), and Test (10%) sets.
Crucially implements sequence-aware grouping: frames belonging to the same source video/patrol
run are kept within the same split partition to prevent synthetic correlation data leakage.
"""

import os
import sys
import shutil
import random
import json
import logging
from pathlib import Path
from collections import defaultdict
import cv2

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "dataset" / "raw"
DATASET_DIR = BASE_DIR / "dataset"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("gartika.training.prepare")

# Class ID to name mapping
CLASS_MAP = {
    0: "pothole",
    1: "road_crack",
    2: "waterlogging",
    3: "damaged_road"
}

def get_sequence_id(filename: str) -> str:
    """
    Extract sequence / video identifier from filename.
    e.g. 'seq01_frame05.jpg' -> 'seq01', 'camA_0023.png' -> 'camA'.
    If no prefix separator is found, treats the file as an independent unit.
    """
    stem = Path(filename).stem
    if "_" in stem:
        return stem.split("_")[0]
    return stem

def prepare_and_split_dataset(
    raw_dir: Path = RAW_DIR,
    dataset_dir: Path = DATASET_DIR,
    train_ratio: float = 0.70,
    val_ratio: float = 0.20,
    test_ratio: float = 0.10,
    seed: int = 42
):
    """
    Validate, sequence-group, and partition raw road images and YOLO annotations.
    """
    random.seed(seed)
    logger.info("=" * 60)
    logger.info("   GARTIKA AI — DATASET PREPARATION & PARTITIONING")
    logger.info("=" * 60)
    logger.info(f"Raw Directory    : {raw_dir}")
    logger.info(f"Target Directory : {dataset_dir}")
    logger.info(f"Split Ratios     : Train={int(train_ratio*100)}% | Val={int(val_ratio*100)}% | Test={int(test_ratio*100)}%")
    logger.info(f"Random Seed      : {seed} (Reproducible)")
    logger.info("=" * 60)

    # 1. Discover all image files
    valid_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    raw_images = [f for f in raw_dir.iterdir() if f.is_file() and f.suffix.lower() in valid_extensions]
    
    if not raw_images:
        logger.error(f"No image files found in {raw_dir}!")
        return False

    # 2. Group frames by sequence to avoid data leakage
    sequences = defaultdict(list)
    corrupted_images = []
    missing_labels = []

    for img_path in sorted(raw_images):
        # Validate readability
        test_read = cv2.imread(str(img_path))
        if test_read is None:
            corrupted_images.append(str(img_path.name))
            logger.warning(f"[CORRUPT] Unreadable image skipped: {img_path.name}")
            continue

        lbl_path = img_path.with_suffix(".txt")
        if not lbl_path.exists():
            missing_labels.append(str(img_path.name))
            # Create empty annotation file for negative sample
            with open(lbl_path, "w") as f:
                pass

        seq_id = get_sequence_id(img_path.name)
        sequences[seq_id].append(img_path)

    seq_keys = list(sequences.keys())
    random.shuffle(seq_keys)

    total_sequences = len(seq_keys)
    n_train = max(1, int(total_sequences * train_ratio))
    n_val = max(1, int(total_sequences * val_ratio))
    
    train_seqs = set(seq_keys[:n_train])
    val_seqs = set(seq_keys[n_train:n_train + n_val])
    test_seqs = set(seq_keys[n_train + n_val:])
    if not test_seqs and len(seq_keys) > 2:
        test_seqs = {seq_keys[-1]}
        val_seqs.discard(seq_keys[-1])

    # 3. Clean and recreate destination split directories
    for split in ["train", "val", "test"]:
        img_dir = dataset_dir / "images" / split
        lbl_dir = dataset_dir / "labels" / split
        shutil.rmtree(img_dir, ignore_errors=True)
        shutil.rmtree(lbl_dir, ignore_errors=True)
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)

    # 4. Copy files and gather statistics
    stats = {
        "total_images": len(raw_images),
        "total_sequences": total_sequences,
        "splits": {"train": 0, "val": 0, "test": 0},
        "sequence_distribution": {
            "train": list(train_seqs),
            "val": list(val_seqs),
            "test": list(test_seqs)
        },
        "total_annotations": 0,
        "annotations_per_class": {c_name: 0 for c_name in CLASS_MAP.values()},
        "images_zero_annotations": 0,
        "corrupted_images": corrupted_images,
        "missing_label_files_created": len(missing_labels)
    }

    for seq_id, img_list in sequences.items():
        if seq_id in train_seqs:
            split = "train"
        elif seq_id in val_seqs:
            split = "val"
        else:
            split = "test"

        for img_path in img_list:
            lbl_path = img_path.with_suffix(".txt")
            dest_img = dataset_dir / "images" / split / img_path.name
            dest_lbl = dataset_dir / "labels" / split / lbl_path.name

            shutil.copy2(img_path, dest_img)
            shutil.copy2(lbl_path, dest_lbl)
            stats["splits"][split] += 1

            # Parse label file
            with open(lbl_path, "r") as f:
                lines = [l.strip() for l in f if l.strip()]
            
            if not lines:
                stats["images_zero_annotations"] += 1
            else:
                for line in lines:
                    parts = line.split()
                    if parts:
                        cls_id = int(parts[0])
                        cls_name = CLASS_MAP.get(cls_id, f"class_{cls_id}")
                        stats["annotations_per_class"][cls_name] = stats["annotations_per_class"].get(cls_name, 0) + 1
                        stats["total_annotations"] += 1

    # Save stats report
    report_file = dataset_dir / "dataset_stats.json"
    with open(report_file, "w") as f:
        json.dump(stats, f, indent=2)

    logger.info("[SUCCESS] Dataset partitioned successfully without sequence leakage!")
    print("\n" + "=" * 55)
    print("           DATASET SUMMARY REPORT")
    print("=" * 55)
    print(f"Total Raw Images        : {stats['total_images']}")
    print(f"Total Sequences         : {stats['total_sequences']}")
    print(f"Training Images         : {stats['splits']['train']} ({stats['splits']['train']/stats['total_images']*100:.1f}%)")
    print(f"Validation Images       : {stats['splits']['val']} ({stats['splits']['val']/stats['total_images']*100:.1f}%)")
    print(f"Testing Images          : {stats['splits']['test']} ({stats['splits']['test']/stats['total_images']*100:.1f}%)")
    print(f"Total Annotations       : {stats['total_annotations']}")
    for c_name, count in stats["annotations_per_class"].items():
        print(f"  - {c_name.ljust(18)}: {count} bboxes")
    print(f"Negative Background Imgs: {stats['images_zero_annotations']}")
    print(f"Corrupted Files Skipped : {len(stats['corrupted_images'])}")
    print(f"Detailed JSON Report    : {report_file}")
    print("=" * 55 + "\n")
    return True

if __name__ == "__main__":
    prepare_and_split_dataset()
