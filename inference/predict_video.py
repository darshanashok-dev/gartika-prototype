"""
Gartika Road Defect Video Stream Inference CLI Tool.

Processes bus-mounted / dashcam road MP4 video streams frame-by-frame,
applies custom YOLOv8 defect detection, overlays HUD telemetry and FPS counters,
performs event-level temporal deduplication, and writes the annotated output video.
"""

import sys
import time
import argparse
import cv2
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from inference.detector import RoadDefectDetector

PRED_DIR = BASE_DIR / "results" / "predictions"
PRED_DIR.mkdir(parents=True, exist_ok=True)

def process_video(
    video_path: str,
    model_path: str = "models/gartika_road_defect.pt",
    conf_threshold: float = 0.45,
    output_path: str = None
):
    video_file = Path(video_path)
    if not video_file.exists():
        print(f"[ERROR] Video file not found: {video_file}")
        sys.exit(1)

    detector = RoadDefectDetector(model_path=model_path, conf_threshold=conf_threshold)

    cap = cv2.VideoCapture(str(video_file))
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video stream: {video_file}")
        sys.exit(1)

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps_in = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    if output_path is None:
        output_path = PRED_DIR / f"annotated_{video_file.name}"
    else:
        output_path = Path(output_path)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(output_path), fourcc, fps_in, (width, height))

    print("\n" + "=" * 55)
    print("      GARTIKA ROAD DEFECT VIDEO INGESTION")
    print("=" * 55)
    print(f"Source Video  : {video_file.name} ({width}x{height} @ {fps_in:.1f} FPS)")
    print(f"Total Frames  : {total_frames}")
    print(f"Model Checkpt : {model_path}")
    print(f"Output Target : {output_path}")
    print("=" * 55)

    frame_count = 0
    unique_events_created = 0
    start_time = time.time()

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        t0 = time.time()
        
        # 1. Run visual defect detection
        detections = detector.predict_frame(frame)
        t_infer = time.time() - t0
        fps_curr = 1.0 / max(0.001, t_infer)

        # 2. Draw HUD and bounding boxes
        for d in detections:
            cls_name = d["class"].upper()
            conf = d["confidence"]
            bbox = d["bbox"]
            x1, y1, x2, y2 = bbox

            # Temporal deduplication check
            event_id = detector.deduplicator.should_create_event(bbox, cls_name, time.time())
            if event_id:
                unique_events_created += 1
                gartika_evt = detector.format_gartika_event(d, bus_id="BUS-101")
                print(f"  [ACTIONABLE EVENT] Frame {frame_count:04d} -> {gartika_evt['event_id']} ({cls_name} {conf:.2f})")

            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
            label = f"{cls_name} ({int(conf*100)}%)"
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
            cv2.rectangle(frame, (x1, max(0, y1 - 22)), (x1 + lw + 6, max(0, y1)), (0, 0, 255), -1)
            cv2.putText(frame, label, (x1 + 3, max(15, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

        # Top status HUD banner
        cv2.rectangle(frame, (10, 10), (320, 50), (15, 15, 20), -1)
        cv2.putText(frame, f"GARTIKA AI | FPS: {fps_curr:.1f} | Frame: {frame_count}", (18, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (0, 255, 180), 1)

        out.write(frame)

        if frame_count % 15 == 0 or detections:
            det_summary = f"{detections[0]['class'].upper()}: {detections[0]['confidence']:.2f}" if detections else "CLEAR"
            print(f"Frame {frame_count:04d}/{total_frames:04d} | Defect: {det_summary.ljust(18)} | FPS: {fps_curr:.1f}")

    cap.release()
    out.release()
    total_time = time.time() - start_time

    print("\n" + "=" * 55)
    print("           VIDEO INGESTION COMPLETED")
    print("=" * 55)
    print(f"Processed Frames       : {frame_count}")
    print(f"Total Processing Time  : {total_time:.2f}s (Avg {frame_count/max(0.1, total_time):.1f} FPS)")
    print(f"Unique Events Triggered: {unique_events_created} (Deduplicated)")
    print(f"Output Video Saved To  : {output_path}")
    print("=" * 55 + "\n")

def main():
    parser = argparse.ArgumentParser(description="Gartika Video Defect Inference Tool")
    parser.add_argument("--video", type=str, required=True, help="Path to input road video file (.mp4, .avi)")
    parser.add_argument("--model", type=str, default="models/gartika_road_defect.pt", help="Path to model weights")
    parser.add_argument("--conf", type=float, default=0.45, help="Confidence threshold")
    parser.add_argument("--output", type=str, default=None, help="Custom output video path")

    args = parser.parse_args()
    process_video(args.video, args.model, args.conf, args.output)

if __name__ == "__main__":
    main()
