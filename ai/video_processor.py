"""
End-to-End AI Video Processing Pipeline for Gartika Urban Intelligence.

This module coordinates the complete edge processing lifecycle:
1. Video Capture (from recorded demo video, synthetic simulation, or live webcam).
2. Vehicle Detection & Multi-Object Tracking (ByteTrack).
3. Road Surface Defect & Pothole Detection.
4. Privacy blurring and structured event generation.
5. Ingestion to Backend REST API & Live Command Center.
"""

import os
import sys
import time
import argparse
import requests
import cv2
import numpy as np
import logging
from pathlib import Path
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend.app.config import settings
from ai.detector import VehicleDetector
from ai.tracker import ByteTracker
from ai.pothole_detector import PotholeDetector
from ai.event_generator import EventGenerator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("gartika.ai.processor")

def create_synthetic_road_video(output_path: str, duration_sec: int = 15, fps: int = 25):
    """
    Generate a high-quality simulated urban road video with vehicles and potholes.
    
    Renders perspective road asphalt, dashed lane markings, moving cars, buses,
    and road potholes so demo mode functions out-of-the-box without requiring
    large external video downloads.
    
    Args:
        output_path: Filepath where the generated MP4 video will be written.
        duration_sec: Video length in seconds (default: 15).
        fps: Frame rate for the output video (default: 25).
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    width, height = 854, 480
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    total_frames = duration_sec * fps
    
    logger.info(f"[AI] Generating {duration_sec}s demo road video at {output_path}...")
    
    for frame_idx in range(total_frames):
        # Create base road perspective canvas
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Sky and urban background
        frame[0:int(height*0.42), :] = (180, 150, 110) # Horizon / urban haze
        # Distant buildings skyline
        for bx in range(0, width, 80):
            bh = int(30 + 40 * np.sin(bx * 0.05) ** 2)
            cv2.rectangle(frame, (bx, int(height*0.42) - bh), (bx + 70, int(height*0.42)), (120, 110, 100), -1)
            
        # Road asphalt (dark gray)
        frame[int(height*0.42):height, :] = (65, 65, 70)
        
        # Road lane markings (perspective lines)
        road_top_y = int(height * 0.42)
        center_x = width // 2
        
        # Left and right road curbs
        cv2.line(frame, (center_x - 100, road_top_y), (0, height), (90, 90, 100), 4)
        cv2.line(frame, (center_x + 100, road_top_y), (width, height), (90, 90, 100), 4)
        
        # Center dashed yellow divider line moving towards camera
        dash_offset = (frame_idx * 14) % 80
        for y in range(road_top_y + dash_offset, height + 80, 80):
            scale = (y - road_top_y) / (height - road_top_y + 1e-5)
            x = int(center_x + (scale - 0.5) * 10)
            dash_len = int(20 + 40 * scale)
            dash_w = max(2, int(6 * scale))
            cv2.line(frame, (x, y), (x, y + dash_len), (0, 215, 255), dash_w)
            
        # Moving Car #1 (in left lane)
        car1_prog = ((frame_idx * 6) % (total_frames * 2)) / (total_frames * 2)
        if 0.1 < car1_prog < 0.9:
            c1_y = int(road_top_y + (height - road_top_y) * car1_prog)
            c1_scale = (c1_y - road_top_y) / (height - road_top_y)
            c1_w = int(60 + 140 * c1_scale)
            c1_h = int(35 + 85 * c1_scale)
            c1_x = int(center_x - 120 * c1_scale - c1_w // 2)
            # Draw car body
            cv2.rectangle(frame, (c1_x, c1_y - c1_h), (c1_x + c1_w, c1_y), (180, 30, 30), -1)
            cv2.rectangle(frame, (c1_x + int(c1_w*0.15), c1_y - c1_h - int(c1_h*0.4)), (c1_x + int(c1_w*0.85), c1_y - int(c1_h*0.3)), (200, 200, 220), -1) # windshield
            cv2.circle(frame, (c1_x + int(c1_w*0.2), c1_y), int(10*c1_scale + 2), (20, 20, 20), -1)
            cv2.circle(frame, (c1_x + int(c1_w*0.8), c1_y), int(10*c1_scale + 2), (20, 20, 20), -1)

        # Moving Bus / Truck (in right lane)
        bus_prog = (((frame_idx + 80) * 4) % (total_frames * 2)) / (total_frames * 2)
        if 0.15 < bus_prog < 0.85:
            b_y = int(road_top_y + (height - road_top_y) * bus_prog)
            b_scale = (b_y - road_top_y) / (height - road_top_y)
            b_w = int(80 + 170 * b_scale)
            b_h = int(60 + 120 * b_scale)
            b_x = int(center_x + 130 * b_scale - b_w // 2)
            # Draw bus body (green BMTC electric style)
            cv2.rectangle(frame, (b_x, b_y - b_h), (b_x + b_w, b_y), (40, 160, 60), -1)
            # Bus windows
            cv2.rectangle(frame, (b_x + 8, b_y - b_h + 10), (b_x + b_w - 8, b_y - int(b_h*0.4)), (220, 220, 240), -1)
            cv2.circle(frame, (b_x + int(b_w*0.25), b_y), int(12*b_scale + 3), (20, 20, 20), -1)
            cv2.circle(frame, (b_x + int(b_w*0.75), b_y), int(12*b_scale + 3), (20, 20, 20), -1)

        # Road Pothole (appears periodically in center-right of lane)
        pothole_cycle = frame_idx % 150
        if 40 <= pothole_cycle <= 110:
            p_prog = (pothole_cycle - 40) / 70.0
            p_y = int(road_top_y + (height - road_top_y) * (0.3 + 0.6 * p_prog))
            p_scale = (p_y - road_top_y) / (height - road_top_y)
            p_rx = int(18 + 45 * p_scale)
            p_ry = int(8 + 22 * p_scale)
            p_x = int(center_x + 50 * p_scale)
            
            # Draw dark irregular crater / pothole
            cv2.ellipse(frame, (p_x, p_y), (p_rx, p_ry), 5, 0, 360, (20, 20, 22), -1)
            cv2.ellipse(frame, (p_x, p_y), (p_rx - 4, p_ry - 3), 5, 0, 360, (10, 10, 12), -1)
            cv2.ellipse(frame, (p_x + 2, p_y - 2), (p_rx + 2, p_ry + 1), 5, 0, 180, (95, 95, 105), 2) # lip highlight
            
        out.write(frame)
        
    out.release()
    logger.info("[AI] Demo road video generation complete.")

class VideoProcessor:
    """
    Main orchestrator that processes video streams, runs AI models, and posts telemetry.
    
    Attributes:
        source (str): Video source ('demo', video path, or webcam index).
        bus_id (str): Vehicle identifier.
        backend_url (str): Base URL of backend REST API.
        headless (bool): If True, suppresses OpenCV GUI preview windows.
        loop (bool): If True, loops video indefinitely for live demonstration.
    """
    def __init__(
        self,
        source: str = "demo",
        bus_id: str = "BUS-101",
        backend_url: str = settings.BACKEND_URL,
        headless: bool = True,
        loop: bool = True
    ):
        """
        Initialize the VideoProcessor pipeline.
        
        Args:
            source: Source path, 'demo', or camera index.
            bus_id: Unique bus identifier string.
            backend_url: Target URL for reporting events.
            headless: Whether to disable desktop display windows.
            loop: Whether to loop video inputs.
        """
        self.source = source
        self.bus_id = bus_id
        self.backend_url = backend_url.rstrip("/")
        self.headless = headless
        self.loop = loop
        
        # Instantiate component engines
        self.detector = VehicleDetector(conf_threshold=settings.CONFIDENCE_THRESHOLD)
        self.tracker = ByteTracker()
        self.pothole_detector = PotholeDetector()
        self.event_gen = EventGenerator()
        
        # Route waypoints (Bangalore MG Road to Indiranagar corridor)
        self.route_coords = [
            (12.971598, 77.594562), # MG Road Metro
            (12.972854, 77.601243), # Trinity Circle
            (12.975412, 77.615234), # Halasuru Lake
            (12.978120, 77.632410), # 100ft Road Indiranagar
            (12.981045, 77.641200)  # CMH Road
        ]
        self.current_coord_idx = 0

    def get_current_gps(self) -> tuple:
        """
        Simulate progressive GPS telemetry along transit route waypoints.
        
        Returns:
            tuple: (latitude, longitude) with subtle realistic sensor jitter.
        """
        p1 = self.route_coords[self.current_coord_idx]
        p2 = self.route_coords[(self.current_coord_idx + 1) % len(self.route_coords)]
        
        # Jitter slightly for realistic sensor dynamics
        jitter_lat = (np.random.rand() - 0.5) * 0.0001
        jitter_lon = (np.random.rand() - 0.5) * 0.0001
        
        lat = round(p1[0] + jitter_lat, 6)
        lon = round(p1[1] + jitter_lon, 6)
        return lat, lon

    def post_event(self, event_data: dict):
        """
        Submit generated event to backend REST API.
        
        Args:
            event_data: Dictionary containing event payload.
        """
        try:
            url = f"{self.backend_url}/events"
            resp = requests.post(url, json=event_data, timeout=3.0, verify=False)
            if resp.status_code == 201:
                logger.info(f"[POST SUCCESS] Event {event_data.get('event_id')} ingested into platform.")
            else:
                logger.warning(f"[POST FAILED] Status {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"[NETWORK] Could not transmit event to backend: {e}")

    def post_telemetry(self, lat: float, lon: float, speed: float = 32.5):
        """
        Send periodic bus GPS and IMU accelerometer telemetry ping.
        
        Args:
            lat: Current latitude.
            lon: Current longitude.
            speed: Bus velocity in km/h.
        """
        try:
            url = f"{self.backend_url}/telemetry"
            payload = {
                "bus_id": self.bus_id,
                "latitude": lat,
                "longitude": lon,
                "accuracy": 4.5,
                "speed": speed,
                "ax": round(float(np.random.normal(0.0, 0.3)), 3),
                "ay": round(float(np.random.normal(0.0, 0.4)), 3),
                "az": round(float(np.random.normal(9.81, 0.2)), 3)
            }
            requests.post(url, json=payload, timeout=2.0, verify=False)
        except Exception:
            pass

    def run(self):
        """
        Execute the main video analysis loop.
        
        Reads frames sequentially, executes vehicle detection and tracking, detects
        potholes, generates structured events, submits them to the backend API, and
        optionally displays an annotated debug window.
        """
        video_path = self.source
        if self.source == "demo":
            demo_video_file = str(settings.VIDEOS_DIR / "road_demo.mp4")
            if not os.path.exists(demo_video_file):
                create_synthetic_road_video(demo_video_file)
            video_path = demo_video_file
        elif self.source.isdigit():
            video_path = int(self.source)

        logger.info(f"[AI] Starting Video Processing Pipeline on source: {video_path}")
        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            logger.error(f"[AI] Could not open video source {video_path}")
            return

        frame_count = 0
        last_telemetry_time = 0
        last_traffic_event_time = 0

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    if self.loop and isinstance(video_path, str):
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        self.current_coord_idx = (self.current_coord_idx + 1) % len(self.route_coords)
                        continue
                    else:
                        break

                frame_count += 1
                curr_time = time.time()
                lat, lon = self.get_current_gps()

                # Step 1: Vehicle Detection
                detections = self.detector.detect(frame)
                
                # Step 2: ByteTrack Multi-Object Tracking
                tracked_objects = self.tracker.update(detections)

                # Step 3: Road Defect & Pothole Detection
                potholes = self.pothole_detector.detect(frame)

                # Step 4: Event Generation for Potholes
                for pothole in potholes:
                    event = self.event_gen.create_pothole_event(
                        defect=pothole,
                        frame=frame,
                        bus_id=self.bus_id,
                        lat=lat,
                        lon=lon,
                        detections=detections
                    )
                    if event:
                        self.post_event(event)

                # Periodic Traffic Density Event (every 10 seconds)
                if curr_time - last_traffic_event_time > 10.0 and len(tracked_objects) > 0:
                    traffic_evt = self.event_gen.create_vehicle_count_event(
                        tracked_vehicles=tracked_objects,
                        bus_id=self.bus_id,
                        lat=lat,
                        lon=lon
                    )
                    if traffic_evt:
                        self.post_event(traffic_evt)
                    last_traffic_event_time = curr_time

                # Periodic Telemetry Ping (every 2 seconds)
                if curr_time - last_telemetry_time > 2.0:
                    self.post_telemetry(lat, lon, speed=28.0 + 5.0 * np.sin(frame_count * 0.1))
                    last_telemetry_time = curr_time

                # Annotate Frame for display or live monitor
                if not self.headless:
                    # Draw vehicles
                    for obj in tracked_objects:
                        x1, y1, x2, y2 = obj['bbox']
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        label = f"{obj['class_name'].upper()} #{obj['track_id']} {obj['confidence']:.2f}"
                        cv2.putText(frame, label, (x1, max(15, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                    # Draw potholes
                    for p in potholes:
                        x1, y1, x2, y2 = p['bbox']
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                        label = f"POTHOLE {int(p['confidence']*100)}%"
                        cv2.putText(frame, label, (x1, max(15, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)

                    cv2.imshow("Gartika AI Engine", frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break

                # Pace video playback to approx 25 fps
                time.sleep(0.035)

        except KeyboardInterrupt:
            logger.info("[AI] Video processing interrupted by user.")
        finally:
            cap.release()
            if not self.headless:
                cv2.destroyAllWindows()
            logger.info("[AI] Video processor finished.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gartika AI Video Processing Engine")
    parser.add_argument("--source", type=str, default="demo", help="Path to video file, 'demo', or camera index (e.g. 0)")
    parser.add_argument("--bus-id", type=str, default="BUS-101", help="Identifier of the sensing bus")
    parser.add_argument("--backend-url", type=str, default="http://localhost:8000", help="Backend API base URL")
    parser.add_argument("--display", action="store_true", help="Display visual inference window")
    args = parser.parse_args()

    processor = VideoProcessor(
        source=args.source,
        bus_id=args.bus_id,
        backend_url=args.backend_url,
        headless=not args.display
    )
    processor.run()
