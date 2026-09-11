#!/usr/bin/env python3
"""
evaluate_metrics.py - Gartika AI & Sensor Fusion Performance Evaluation Script.

Evaluates precision, recall, F1 score, mean Average Precision (mAP),
per-class metrics, small/medium object recall, and latency across actual validation
and test datasets using real YOLOv8 model inference.
"""

import sys
import os
import json
import time
import argparse
from pathlib import Path
from typing import Dict, List, Any
import cv2
import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

MODEL_PATH = BASE_DIR / "models" / "gartika_road_defect.pt"
DATA_YAML = BASE_DIR / "dataset" / "data.yaml"

def run_real_evaluation(conf_threshold: float = 0.45) -> Dict[str, Any]:
    """
    Compute rigorous perception and sensor fusion metrics directly from real model inference.
    """
    from ultralytics import YOLO
    
    if not MODEL_PATH.exists():
        print(f"[ERROR] Model not found at {MODEL_PATH}", file=sys.stderr)
        sys.exit(1)

    model = YOLO(str(MODEL_PATH))
    
    # 1. Ultralytics validation run
    val_res = model.val(data=str(DATA_YAML), split="val", plots=False, verbose=False)
    test_res = model.val(data=str(DATA_YAML), split="test", plots=False, verbose=False)
    
    val_p = float(val_res.results_dict.get("metrics/precision(B)", 0.0))
    val_r = float(val_res.results_dict.get("metrics/recall(B)", 0.0))
    val_map50 = float(val_res.results_dict.get("metrics/mAP50(B)", 0.0))
    val_map50_95 = float(val_res.results_dict.get("metrics/mAP50-95(B)", 0.0))
    val_f1 = float(2 * val_p * val_r / (val_p + val_r)) if (val_p + val_r) > 0 else 0.0

    test_p = float(test_res.results_dict.get("metrics/precision(B)", 0.0))
    test_r = float(test_res.results_dict.get("metrics/recall(B)", 0.0))
    test_map50 = float(test_res.results_dict.get("metrics/mAP50(B)", 0.0))
    test_map50_95 = float(test_res.results_dict.get("metrics/mAP50-95(B)", 0.0))
    test_f1 = float(2 * test_p * test_r / (test_p + test_r)) if (test_p + test_r) > 0 else 0.0

    # 2. Benchmark latency and small/medium object recall on test set
    test_imgs = sorted((BASE_DIR / "dataset" / "images" / "test").glob("*.jpg"))
    latencies = []
    tp, fp, fn = 0, 0, 0
    size_tp = {"small": 0, "medium": 0, "large": 0}
    size_total = {"small": 0, "medium": 0, "large": 0}

    for img_p in test_imgs:
        lbl_p = (BASE_DIR / "dataset" / "labels" / "test" / f"{img_p.stem}.txt")
        gt_boxes = []
        if lbl_p.exists():
            for line in lbl_p.read_text().splitlines():
                if line.strip():
                    c, x, y, w, h = map(float, line.split())
                    gt_boxes.append((int(c), x, y, w, h))
                    area = w * h
                    if area < 0.01: size_total["small"] += 1
                    elif area < 0.10: size_total["medium"] += 1
                    else: size_total["large"] += 1
        
        img = cv2.imread(str(img_p))
        ih, iw = img.shape[:2]
        
        t0 = time.time()
        res = model.predict(img, conf=conf_threshold, verbose=False)[0]
        latencies.append((time.time() - t0) * 1000.0)
        
        pred_boxes = []
        for box in res.boxes:
            c = int(box.cls[0].item())
            bx1, by1, bx2, by2 = box.xyxy[0].cpu().numpy()
            bw = (bx2 - bx1) / iw
            bh = (by2 - by1) / ih
            bx = (bx1 + bx2) / (2 * iw)
            by = (by1 + by2) / (2 * ih)
            pred_boxes.append((c, bx, by, bw, bh))

        matched_gt = set()
        for p in pred_boxes:
            pc, px, py, pw, ph = p
            best_iou, best_idx = 0.0, -1
            for g_idx, g in enumerate(gt_boxes):
                if g_idx in matched_gt: continue
                gc, gx, gy, gw, gh = g
                if pc != gc: continue
                xA = max(px - pw/2, gx - gw/2)
                yA = max(py - ph/2, gy - gh/2)
                xB = min(px + pw/2, gx + gw/2)
                yB = min(py + ph/2, gy + gh/2)
                inter = max(0, xB - xA) * max(0, yB - yA)
                union = pw*ph + gw*gh - inter
                iou = inter / max(1e-5, union)
                if iou > best_iou:
                    best_iou, best_idx = iou, g_idx

            if best_iou >= 0.45:
                tp += 1
                matched_gt.add(best_idx)
                gc, gx, gy, gw, gh = gt_boxes[best_idx]
                area = gw * gh
                if area < 0.01: size_tp["small"] += 1
                elif area < 0.10: size_tp["medium"] += 1
                else: size_tp["large"] += 1
            else:
                fp += 1

        fn += len(gt_boxes) - len(matched_gt)

    avg_latency = float(np.mean(latencies)) if latencies else 0.0
    small_recall = size_tp["small"] / max(1, size_total["small"])
    med_recall = size_tp["medium"] / max(1, size_total["medium"])

    return {
        "model": str(MODEL_PATH.name),
        "confidence_threshold": conf_threshold,
        "validation_metrics": {
            "precision": round(val_p, 4),
            "recall": round(val_r, 4),
            "f1_score": round(val_f1, 4),
            "mAP50": round(val_map50, 4),
            "mAP50_95": round(val_map50_95, 4)
        },
        "test_metrics": {
            "precision": round(test_p, 4),
            "recall": round(test_r, 4),
            "f1_score": round(test_f1, 4),
            "mAP50": round(test_map50, 4),
            "mAP50_95": round(test_map50_95, 4),
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "small_defect_recall": round(small_recall, 4),
            "medium_defect_recall": round(med_recall, 4)
        },
        "benchmarks": {
            "avg_inference_latency_ms": round(avg_latency, 2),
            "fps": round(1000.0 / max(0.1, avg_latency), 1)
        }
    }

def print_metrics_table(res: Dict[str, Any]):
    val = res["validation_metrics"]
    test = res["test_metrics"]
    bench = res["benchmarks"]

    print("=" * 76)
    print("      GARTIKA URBAN ROAD DEFECT DETECTION EVALUATION REPORT      ")
    print("=" * 76)
    print(f"Model: {res['model']} | Confidence Threshold: {res['confidence_threshold']}")
    print(f"Test Set Counts: TP={test['true_positives']} | FP={test['false_positives']} | FN={test['false_negatives']}")
    print("-" * 76)
    print(f"{'Metric':<40} | {'Validation':<15} | {'Test (Held-Out)':<15}")
    print("-" * 76)
    print(f"{'Precision':<40} | {val['precision']*100:>13.2f}% | {test['precision']*100:>13.2f}%")
    print(f"{'Recall':<40} | {val['recall']*100:>13.2f}% | {test['recall']*100:>13.2f}%")
    print(f"{'F1 Score':<40} | {val['f1_score']:>14.4f} | {test['f1_score']:>14.4f}")
    print(f"{'mAP@0.50':<40} | {val['mAP50']*100:>13.2f}% | {test['mAP50']*100:>13.2f}%")
    print(f"{'mAP@0.50:0.95':<40} | {val['mAP50_95']*100:>13.2f}% | {test['mAP50_95']*100:>13.2f}%")
    print("-" * 76)
    print(f"{'Small Defect Recall (<0.01 area)':<40} | {'-':<15} | {test['small_defect_recall']*100:>13.2f}%")
    print(f"{'Medium Defect Recall (0.01-0.10 area)':<40} | {'-':<15} | {test['medium_defect_recall']*100:>13.2f}%")
    print(f"{'Average CPU Inference Latency':<40} | {'-':<15} | {bench['avg_inference_latency_ms']:>10.2f} ms")
    print(f"{'Processing Throughput':<40} | {'-':<15} | {bench['fps']:>11.1f} FPS")
    print("=" * 76)

def main():
    parser = argparse.ArgumentParser(description="Evaluate Gartika AI Detection Metrics.")
    parser.add_argument("--conf", type=float, default=0.45, help="Confidence threshold")
    parser.add_argument("--json", action="store_true", help="Output metrics as JSON")
    args = parser.parse_args()

    results = run_real_evaluation(conf_threshold=args.conf)
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print_metrics_table(results)

if __name__ == "__main__":
    main()

