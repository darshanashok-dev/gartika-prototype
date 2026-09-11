# Gartika Operational Troubleshooting Manual

### 1. Backend Fails to Start
- **Symptom**: `python3 -m backend.app.main` exits with error.
- **Cause**: Port 8000 in use, or database locked by zombie process.
- **Fix**:
  ```bash
  fuser -k 8000/tcp
  rm -f gartika.db
  python3 -m backend.app.main
  ```

### 2. Camera Preview Shows Blank on Mobile Phone
- **Symptom**: Mobile browser shows black viewport.
- **Cause**: Browser requires HTTPS or `localhost` to grant `getUserMedia` camera permission on remote IPs.
- **Fix**: Use the built-in photo upload fallback button (*"Snap & Upload Defect Photo"*), or launch the server with SSL certificates enabled:
  ```bash
  export USE_HTTPS=true
  python3 -m backend.app.main
  ```

### 3. No Potholes Detected During Video Simulation
- **Symptom**: Video streams but 0 defects appear on dashboard.
- **Cause**: Confidence threshold too strict or video has low road contrast.
- **Fix**: Check `CONFIDENCE_THRESHOLD=0.45` in `.env` or run with synthetic test generator:
  ```bash
  python3 scripts/generate_synthetic_video.py --output data/videos/test.mp4
  ```

### 4. WebSocket Status Shows "RECONNECTING"
- **Symptom**: Live status dot on top bar is grey/reconnecting.
- **Cause**: Reverse proxy or firewall blocking WebSocket upgrade header.
- **Fix**: Verify `/ws/events` endpoint is reachable via `curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8000/ws/events`.
