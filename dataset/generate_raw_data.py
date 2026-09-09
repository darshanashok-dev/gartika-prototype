"""
Benchmark Road Defect Dataset Generator for Gartika AI Pipeline Testing.

Generates realistic road surface scenes (asphalt textures, lighting variations, shadows,
perspective road lanes, potholes of varying depths/shapes, longitudinal/transverse cracks,
and negative hard samples like manholes, shadows, and painted road markings) with sequence IDs.
"""

import os
import cv2
import numpy as np
import random
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "dataset" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

def generate_road_texture(w=640, h=640, base_color=(70, 70, 75), roughness=25):
    """Generate realistic asphalt base with aggregate noise and perspective road gradient."""
    # Base asphalt color
    b, g, r = base_color
    road = np.zeros((h, w, 3), dtype=np.uint8)
    road[:, :, 0] = np.clip(np.random.normal(b, roughness, (h, w)), 30, 180).astype(np.uint8)
    road[:, :, 1] = np.clip(np.random.normal(g, roughness, (h, w)), 30, 180).astype(np.uint8)
    road[:, :, 2] = np.clip(np.random.normal(r, roughness, (h, w)), 30, 180).astype(np.uint8)

    # Add road perspective brightness gradient (sky horizon brighter, foreground darker)
    gradient = np.linspace(0.8, 1.15, h).reshape(h, 1, 1)
    road = np.clip(road * gradient, 0, 255).astype(np.uint8)
    
    # Asphalt grain texture
    noise = np.random.randint(-15, 15, (h, w), dtype=np.int16)
    road = np.clip(road.astype(np.int16) + noise[:, :, None], 0, 255).astype(np.uint8)
    return road

def draw_lane_markings(img):
    """Draw white/yellow lane markings in road perspective."""
    h, w = img.shape[:2]
    # Center dashed white line
    for y in range(int(h * 0.4), h, 70):
        thickness = int(2 + (y / h) * 6)
        cv2.line(img, (int(w * 0.5), y), (int(w * 0.5), y + 35), (220, 220, 220), thickness)

def draw_shadow(img):
    """Draw strong diagonal tree/building shadow for negative sample hard-mining."""
    h, w = img.shape[:2]
    overlay = img.copy()
    pts = np.array([[0, int(h * 0.3)], [int(w * 0.7), int(h * 0.2)], [int(w * 0.9), h], [0, h]], np.int32)
    cv2.fillPoly(overlay, [pts], (25, 25, 30))
    cv2.addWeighted(overlay, 0.45, img, 0.55, 0, img)

def draw_manhole(img, center_x, center_y, radius):
    """Draw metallic manhole cover (negative sample: circular but NOT a pothole)."""
    cv2.circle(img, (center_x, center_y), radius, (55, 55, 60), -1)
    cv2.circle(img, (center_x, center_y), radius, (90, 90, 95), 3)
    cv2.circle(img, (center_x, center_y), int(radius * 0.6), (75, 75, 80), 2)
    # Cross hatch
    for dx in range(-radius + 5, radius - 5, 8):
        cv2.line(img, (center_x + dx, center_y - int(radius*0.7)), (center_x + dx, center_y + int(radius*0.7)), (40, 40, 45), 1)

def draw_pothole(img, center_x, center_y, rx, ry, angle=0):
    """Draw realistic dark pothole depression with textured inner crater and jagged rim."""
    h, w = img.shape[:2]
    # Generate jagged ellipse contour
    num_pts = 24
    pts = []
    for i in range(num_pts):
        theta = (2 * np.pi * i) / num_pts
        r_noise = random.uniform(0.82, 1.18)
        px = int(center_x + rx * r_noise * np.cos(theta))
        py = int(center_y + ry * r_noise * np.sin(theta))
        pts.append([px, py])
    pts = np.array(pts, dtype=np.int32)

    # Dark crater shadow
    cv2.fillPoly(img, [pts], (20, 22, 25))
    # Inner deep pit
    inner_pts = (pts * 0.65 + np.array([center_x * 0.35, center_y * 0.35])).astype(np.int32)
    cv2.fillPoly(img, [inner_pts], (10, 12, 15))
    # Outer rough edge
    cv2.polylines(img, [pts], True, (45, 48, 52), 2)

    # Return normalized YOLO bounding box [class_id, x_center, y_center, width, height]
    x_min, y_min = np.min(pts, axis=0)
    x_max, y_max = np.max(pts, axis=0)
    
    # Clip to image boundaries
    x_min = max(0, x_min)
    y_min = max(0, y_min)
    x_max = min(w - 1, x_max)
    y_max = min(h - 1, y_max)
    
    bw = (x_max - x_min) / w
    bh = (y_max - y_min) / h
    bx = (x_min + x_max) / (2.0 * w)
    by = (y_min + y_max) / (2.0 * h)

    return 0, bx, by, bw, bh # 0: pothole

def draw_crack(img, start_x, start_y, length=120):
    """Draw jagged road crack."""
    h, w = img.shape[:2]
    curr_x, curr_y = start_x, start_y
    pts = [[curr_x, curr_y]]
    for _ in range(int(length / 15)):
        curr_x += random.randint(-12, 12)
        curr_y += random.randint(10, 25)
        pts.append([max(0, min(w-1, curr_x)), max(0, min(h-1, curr_y))])
    
    pts_arr = np.array(pts, dtype=np.int32)
    for i in range(len(pts) - 1):
        cv2.line(img, tuple(pts[i]), tuple(pts[i+1]), (18, 20, 22), random.randint(2, 4))

    x_min, y_min = np.min(pts_arr, axis=0)
    x_max, y_max = np.max(pts_arr, axis=0)
    bw = max(0.04, (x_max - x_min + 10) / w)
    bh = max(0.04, (y_max - y_min + 10) / h)
    bx = (x_min + x_max) / (2.0 * w)
    by = (y_min + y_max) / (2.0 * h)
    return 1, bx, by, bw, bh # 1: road_crack

def generate_dataset(num_sequences=15, frames_per_seq=10):
    """
    Generate diverse road dataset with sequence-grouped frames.
    Total: 15 sequences * 10 frames = 150 images.
    """
    print(f"[DATASET GENERATOR] Generating {num_sequences * frames_per_seq} annotated road scene frames...")
    random.seed(42)
    np.random.seed(42)

    count = 0
    for seq_id in range(1, num_sequences + 1):
        # Each sequence has common environmental conditions (time of day, road type)
        base_brightness = random.randint(55, 95)
        roughness = random.randint(15, 30)
        has_shadows = (seq_id % 3 == 0)
        has_manhole = (seq_id % 4 == 0)
        
        # Consistent pothole location in this road segment with slight camera movement
        pothole_base_x = random.randint(160, 480)
        pothole_base_y = random.randint(300, 520)
        pothole_rx = random.randint(28, 65)
        pothole_ry = random.randint(18, 42)

        for frame_idx in range(1, frames_per_seq + 1):
            img = generate_road_texture(640, 640, base_color=(base_brightness, base_brightness, base_brightness + 5), roughness=roughness)
            draw_lane_markings(img)
            
            if has_shadows:
                draw_shadow(img)

            labels = []
            
            # Sequence type distribution:
            # Seq 1-9: Potholes
            # Seq 10-12: Road Cracks
            # Seq 13-15: Negative Hard Backgrounds (Shadows, Clean Road, Manhole)
            
            if seq_id <= 9:
                # Slight perspective shift as bus approaches pothole
                shift_y = int((frame_idx - 1) * 8)
                shift_x = int(np.sin(frame_idx) * 6)
                scale = 1.0 + (frame_idx * 0.04)
                
                px = pothole_base_x + shift_x
                py = min(580, pothole_base_y + shift_y)
                rx = int(pothole_rx * scale)
                ry = int(pothole_ry * scale)
                
                lbl = draw_pothole(img, px, py, rx, ry)
                labels.append(lbl)
                
                # Occasionally second small pothole
                if seq_id % 2 == 0:
                    lbl2 = draw_pothole(img, max(70, px - 180), min(560, py - 40), int(rx * 0.6), int(ry * 0.6))
                    labels.append(lbl2)
                    
            elif seq_id <= 12:
                # Road crack sequence
                cx = random.randint(180, 420)
                cy = random.randint(250, 450)
                lbl = draw_crack(img, cx, cy, length=random.randint(90, 160))
                labels.append(lbl)
            else:
                # Negative background samples (manhole or clean road)
                if has_manhole:
                    draw_manhole(img, random.randint(200, 440), random.randint(320, 500), random.randint(35, 55))

            # Add mild motion blur/vibration
            if frame_idx % 3 == 0:
                ksize = random.choice([3, 5])
                kernel = np.zeros((ksize, ksize))
                kernel[int((ksize-1)/2), :] = np.ones(ksize) / ksize
                img = cv2.filter2D(img, -1, kernel)

            # File naming with sequence grouping: seq01_frame01.jpg
            img_filename = f"seq{seq_id:02d}_frame{frame_idx:02d}.jpg"
            lbl_filename = f"seq{seq_id:02d}_frame{frame_idx:02d}.txt"

            img_path = RAW_DIR / img_filename
            lbl_path = RAW_DIR / lbl_filename

            cv2.imwrite(str(img_path), img)
            
            with open(lbl_path, "w") as f:
                for l in labels:
                    f.write(f"{l[0]} {l[1]:.6f} {l[2]:.6f} {l[3]:.6f} {l[4]:.6f}\n")
            
            count += 1

    print(f"✓ Generated {count} raw images and labels in {RAW_DIR}")

if __name__ == "__main__":
    generate_dataset()
