import sys
import time
import argparse
import logging
import cv2
import requests
import numpy as np
from pathlib import Path
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Add project root to path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend.app.config import settings
from ai.pothole_detector import PotholeDetector
from ai.detector import VehicleDetector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("gartika.webcam_edge")

def run_webcam_edge(
    camera_index: int = 0,
    video_source: str = None,
    backend_url: str = settings.BACKEND_URL,
    bus_id: str = settings.GARTIKA_BUS_ID,
    show_window: bool = True
):
    """
    Real-time Edge Sensing Client using Laptop Webcam or USB Dashcam.
    Captures live camera frames, runs Edge AI CV inference, and streams
    live telemetry & defect frames to the Gartika Command Center.
    """
    logger.info("=" * 55)
    logger.info("   GARTIKA REAL-TIME EDGE SENSING CLIENT")
    logger.info(f"   Target Backend: {backend_url}")
    logger.info(f"   Vehicle ID:     {bus_id}")
    logger.info("=" * 55)

    # Initialize video capture source
    src = video_source if video_source else camera_index
    cap = cv2.VideoCapture(src)
    
    if not cap.isOpened():
        logger.error(f"[CAMERA] Could not open video source: {src}")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)

    # Local AI Detectors
    pothole_detector = PotholeDetector(conf_threshold=settings.CONFIDENCE_THRESHOLD)
    vehicle_detector = VehicleDetector(conf_threshold=0.35)

    # Starting coordinates (e.g. Bangalore Corridor)
    cur_lat = 12.971598
    cur_lon = 77.594562
    speed_kmh = 32.0

    logger.info("[CAMERA] Live camera stream started. Press 'q' or Ctrl+C to stop.")
    last_frame_upload_t = 0.0
    last_telemetry_upload_t = 0.0
    frame_count = 0
    fps_timer = time.time()
    fps = 0.0

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                if video_source:
                    # Loop video if file source
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                else:
                    logger.warning("[CAMERA] Failed to capture frame from webcam.")
                    time.sleep(0.1)
                    continue

            frame_count += 1
            now = time.time()

            # Calculate FPS
            if now - fps_timer >= 1.0:
                fps = frame_count / (now - fps_timer)
                frame_count = 0
                fps_timer = now

            # 1. Run local Edge AI Detection
            defects = pothole_detector.detect(frame)
            vehicles = vehicle_detector.detect(frame)

            # Draw visual bounding box overlays for local preview
            display_frame = frame.copy()
            for d in defects:
                bx1, by1, bx2, by2 = d["bbox"]
                cv2.rectangle(display_frame, (bx1, by1), (bx2, by2), (0, 0, 255), 2)
                cv2.putText(
                    display_frame,
                    f"POTHOLE ({int(d['confidence']*100)}%)",
                    (bx1, max(20, by1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (0, 0, 255),
                    2
                )

            for v in vehicles:
                bx1, by1, bx2, by2 = v["bbox"]
                cv2.rectangle(display_frame, (bx1, by1), (bx2, by2), (255, 180, 0), 2)
                cv2.putText(
                    display_frame,
                    f"{v['class_name']} ({int(v['confidence']*100)}%)",
                    (bx1, max(20, by1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.45,
                    (255, 180, 0),
                    1
                )

            # Overlay Edge HUD
            cv2.putText(display_frame, f"GARTIKA EDGE: {bus_id} | {fps:.1f} FPS", (12, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
            cv2.putText(display_frame, f"LAT: {cur_lat:.5f} | LON: {cur_lon:.5f} | SPEED: {speed_kmh:.1f} km/h", (12, 460), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

            # 2. Upload live frame to backend (every ~0.8s or immediately if defect found)
            upload_interval = 0.4 if defects else 0.8
            if now - last_frame_upload_t >= upload_interval:
                last_frame_upload_t = now
                _, jpeg_buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                try:
                    files = {"frame": ("camera.jpg", jpeg_buf.tobytes(), "image/jpeg")}
                    data = {"bus_id": bus_id}
                    requests.post(f"{backend_url}/stream/frame", data=data, files=files, timeout=0.8, verify=False)
                except Exception:
                    pass

            # 3. Stream vehicle GPS & IMU Telemetry (every 1.5s)
            if now - last_telemetry_upload_t >= 1.5:
                last_telemetry_upload_t = now
                # Slight realistic GPS progression
                cur_lat += (np.random.rand() - 0.5) * 0.0001
                cur_lon += (np.random.rand() - 0.5) * 0.0001
                
                # If defect detected, inject IMU vertical spike
                az_val = 15.8 if defects else (9.81 + (np.random.rand() - 0.5) * 0.4)
                
                tele_payload = {
                    "bus_id": bus_id,
                    "latitude": round(cur_lat, 6),
                    "longitude": round(cur_lon, 6),
                    "speed": round(speed_kmh, 1),
                    "accuracy": 3.0,
                    "ax": 0.1,
                    "ay": 0.2,
                    "az": round(az_val, 2)
                }
                try:
                    requests.post(f"{backend_url}/telemetry", json=tele_payload, timeout=0.8, verify=False)
                except Exception:
                    pass

            if show_window:
                cv2.imshow("Gartika Live Edge Sensing Unit", display_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

    except KeyboardInterrupt:
        logger.info("[CAMERA] Edge stream stopped by user.")
    finally:
        cap.release()
        if show_window:
            cv2.destroyAllWindows()
        logger.info("[CAMERA] Hardware camera released.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gartika Real-Time Edge Camera Streamer")
    parser.add_argument("--camera", type=int, default=0, help="Webcam device index (default: 0)")
    parser.add_argument("--video", type=str, default=None, help="Path to video file (optional)")
    parser.add_argument("--bus-id", type=str, default="BUS-101", help="Vehicle identifier")
    parser.add_argument("--backend", type=str, default="http://localhost:8000", help="Gartika backend URL")
    parser.add_argument("--no-window", action="store_true", help="Run in headless mode without GUI window")
    args = parser.parse_args()

    run_webcam_edge(
        camera_index=args.camera,
        video_source=args.video,
        backend_url=args.backend,
        bus_id=args.bus_id,
        show_window=not args.no_window
    )
