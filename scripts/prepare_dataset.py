"""
Dataset Preparation & Roboflow Downloader for Gartika Urban Intelligence.

Helper script to fetch open benchmark road defect datasets (e.g. Roboflow, RDD)
or format custom camera captures into YOLO format for training.
"""

import sys
import os
import argparse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

def download_roboflow_dataset(api_key: str, workspace: str, project: str, version: int):
    """
    Download labeled road defect dataset from Roboflow Universe using official Python SDK.
    """
    try:
        from roboflow import Roboflow
    except ImportError:
        print("[ERROR] Roboflow package not installed. Run: pip install roboflow")
        return

    print(f"[DOWNLOAD] Connecting to Roboflow Universe ({workspace}/{project}/v{version})...")
    rf = Roboflow(api_key=api_key)
    proj = rf.workspace(workspace).project(project)
    dataset = proj.version(version).download("yolov8", location=str(BASE_DIR / "data" / "datasets" / "road_defects"))
    print(f"\n✓ SUCCESS: Dataset downloaded to {dataset.location}")
    print("Now run: python3 ai/train.py --data data/datasets/road_defects/data.yaml --epochs 30")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gartika Dataset Preparation Tool")
    parser.add_argument("--roboflow-key", type=str, help="Roboflow API Key")
    parser.add_argument("--workspace", type=str, default="road-damage-detection", help="Workspace name")
    parser.add_argument("--project", type=str, default="pothole-detection", help="Project name")
    parser.add_argument("--version", type=int, default=1, help="Dataset version number")

    args = parser.parse_args()
    if args.roboflow_key:
        download_roboflow_dataset(args.roboflow_key, args.workspace, args.project, args.version)
    else:
        print("Usage:")
        print("  python3 scripts/prepare_dataset.py --roboflow-key <YOUR_KEY> --workspace <WORKSPACE> --project <PROJECT> --version 1")
        print("\nOr manually place your images and YOLO .txt labels into:")
        print("  - data/datasets/road_defects/images/train/")
        print("  - data/datasets/road_defects/labels/train/")
        print("  - data/datasets/road_defects/images/val/")
        print("  - data/datasets/road_defects/labels/val/")
