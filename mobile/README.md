# Gartika Mobile Edge Sensing Terminal

The **Gartika Mobile Edge Sensing Terminal** turns smartphones mounted on transit buses into autonomous road-sensing units.

## Key Capabilities

1. **Camera Feed:** Forward windshield roadway capture with preview (15 FPS), AI frame extraction (0.5–1.0 FPS), and manual high-res photo capture.
2. **GPS Geolocation:** Continuous high-accuracy position monitoring, speed calculation, heading estimation, and stale-lock detection.
3. **IMU Accelerometer:** 50 Hz 3-axis motion sensing with calibrated baseline gravity calculation, vibration tracking, and instant vertical shock detection.
4. **Offline Resilience:** IndexedDB event queue with monotonic sequence persistence, exponential backoff retry, and concurrency flush lock.
5. **Real-time Synchronization:** WebSocket connection for bidirectional event notification and REST ingestion with automatic LAN IP pairing.

## Running on a Mobile Device

1. Connect your smartphone to the same Wi-Fi network as the Gartika host server.
2. Open the Gartika operations dashboard at `http://<host-ip>:8000/`.
3. Click **"Pair Mobile"** in the top navigation bar or sidebar to display the pairing QR code.
4. Scan the QR code with your phone camera to open `http://<host-ip>:8000/mobile`.
5. Enter the **Bus ID** (e.g., `BUS-101`) and tap **Start Live Sensing**.
6. Mount the smartphone firmly on the front windshield facing the road.

## Browser Sensor Permissions

- **Camera:** Requires permission on first launch. If using HTTP over LAN, Chrome for Android allows camera access via `chrome://flags/#unsafely-treat-insecure-origin-as-secure` with the host IP.
- **Motion & Orientation:** iOS Safari requires explicit user touch interaction to trigger `DeviceMotionEvent.requestPermission()`.
- **Location:** Requires "Allow while using app" with Precise Location enabled.
