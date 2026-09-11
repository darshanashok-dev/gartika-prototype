# Gartika Demo Execution Runbook (Smart India Hackathon 2026)

This runbook provides a deterministic, repeatable 5-minute live demonstration flow.

---

## 1. Quick Launch (One-Command Startup)

```bash
# 1. Reset any previous demo state
./scripts/reset_demo.sh

# 2. Launch platform in DEMO mode
./scripts/demo.sh
```

- **Dashboard UI**: `http://localhost:8000/` or `http://localhost:3000/`
- **Mobile Sensing Terminal**: `http://<YOUR-IP>:8000/mobile`
- **API Swagger Documentation**: `http://localhost:8000/docs`

---

## 2. Demonstration Flow (5-Minute Script)

### Minute 1: System Overview & Architecture
1. Open the dashboard at `http://localhost:8000/`.
2. Point to the top KPIs: **Active Buses**, **Detected Defects**, **Multi-Bus Corroboration Rate** (89–94%), **Open Work Orders**.
3. Point to the **Multi-Modal Sensor Intelligence Panel**, explaining the 4-layer fusion: Camera AI + IMU vertical shock ($|a_z - 9.81| > 3.2	ext{ m/s}^2$) + GPS lock + Multi-bus agreement.

### Minute 2: Mobile Sensing & Live Ingestion
1. Open the smartphone mobile interface (`/mobile`) or launch the simulator in another terminal:
   ```bash
   python3 scripts/simulate_route.py --bus-id BUS-101 --speed 35.0
   ```
2. Demonstrate real-time telemetry streaming into the dashboard via WebSockets:
   - Speed, coordinates, and IMU baseline appear on the dashboard HUD.
   - Live activity stream updates instantaneously.

### Minute 3: Defect Detection & Spatial Deduplication
1. Trigger a road defect event with IMU shock:
   ```bash
   python3 scripts/run_demo.py --step detect
   ```
2. On the dashboard:
   - Defect marker appears on the Live GIS Map.
   - Click the defect to open the **Detail Drawer**.
   - Point to the **Confidence Breakdown**: `model_confidence` (0.88), `imu_score` (0.92), `fusion_score` (0.94), and anonymized cropped photo evidence.

### Minute 4: Multi-Bus Corroboration
1. Send a second distinct bus (`BUS-104`) traversing the same road segment:
   ```bash
   python3 scripts/run_demo.py --step corroborate
   ```
2. Show that `unique_bus_count` increases to 2, and status transitions from `SENSOR_FUSED` to `MULTI_BUS_VERIFIED`!

### Minute 5: Closed-Loop Repair Dispatch & Verification
1. Click **"Dispatch Work Order"** on the defect drawer to generate `WO-1042`.
2. Simulate municipal contractor patching the road and marking status `PENDING_VERIFICATION`.
3. Simulate fleet buses traversing the repaired coordinates with smooth IMU ($a_z = 9.81	ext{ m/s}^2$):
   ```bash
   python3 scripts/run_demo.py --step repair-verify
   ```
4. Show that after 2 consecutive clean passes, status transitions to `REPAIR_VERIFIED` & `CLOSED`, and `WO-1042` transitions to `RESOLVED`!
