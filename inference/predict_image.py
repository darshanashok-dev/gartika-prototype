"""
Gartika Image Prediction CLI Tool.

Loads fine-tuned road defect model, runs inference on target road image,
draws styled bounding boxes and confidence banners, prints findings to stdout,
and saves the output to results/predictions/.
"""

import sys
import argparse
import cv2
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from inference.detector import RoadDefectDetector

PRED_DIR = BASE_DIR / "results" / "predictions"
PRED_DIR.mkdir(parents=True, exist_ok=True)

def main():
    parser = argparse.ArgumentParser(description="Gartika Road Defect Image Inference Tool")
    parser.add_argument("--image", type=str, required=True, help="Path to input road image (.jpg, .png)")
    parser.add_argument("--model", type=str, default="models/gartika_road_defect.pt", help="Path to model weights")
    parser.add_argument("--conf", type=float, default=0.45, help="Confidence threshold")
    parser.add_argument("--output", type=str, default=None, help="Custom output image path")

    args = parser.parse_args()
    img_path = Path(args.image)
    if not img_path.exists():
        print(f"[ERROR] Image file not found: {img_path}")
        sys.exit(1)

    detector = RoadDefectDetector(model_path=args.model, conf_threshold=args.conf)
    
    img = cv2.imread(str(img_path))
    detections = detector.predict(img)

    print("\n" + "=" * 45)
    print("      GARTIKA ROAD DEFECT INFERENCE")
    print("=" * 45)
    print(f"Source Image : {img_path.name}")
    print(f"Detections   : {len(detections)}")
    print("-" * 45)

    for d in detections:
        cls_name = d["class"].upper()
        conf = d["confidence"]
        bbox = d["bbox"]
        print(f"{cls_name} {conf:.2f}  BBox: {bbox}")

        # Draw box and label banner
        x1, y1, x2, y2 = bbox
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 0, 255), 2)
        label = f"{cls_name} ({int(conf*100)}%)"
        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
        cv2.rectangle(img, (x1, max(0, y1 - 22)), (x1 + lw + 6, max(0, y1)), (0, 0, 255), -1)
        cv2.putText(img, label, (x1 + 3, max(15, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

    out_path = Path(args.output) if args.output else PRED_DIR / f"pred_{img_path.name}"
    cv2.imwrite(str(out_path), img)
    print("=" * 45)
    print(f"✓ Annotated image saved to: {out_path}\n")

if __name__ == "__main__":
    main()
