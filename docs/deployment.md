# Gartika Deployment Guide (Docker, Bare-Metal, Edge)

## 1. Local Development Quickstart

```bash
# 1. Clone repository
git clone https://github.com/darshanashok-dev/gartika-prototype.git
cd gartika-prototype

# 2. Setup Virtual Environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Configure Environment Variables
cp .env.example .env

# 4. Launch Backend Application
python3 -m backend.app.main
```

---

## 2. Docker & Compose Deployment

```bash
# Build and launch with Docker Compose
docker compose up --build -d

# Check container status
docker compose ps

# View real-time logs
docker compose logs -f backend
```

---

## 3. Edge Smartphone Setup (Buses as Sensors)

1. Connect the smartphone running Chrome/Safari to the same local network / VPN as the backend server.
2. Open `https://<SERVER-IP>:8000/mobile` or `http://<SERVER-IP>:8000/mobile`.
3. Grant Camera, Accelerometer (DeviceMotion), and Geolocation permissions.
4. Mount phone securely on the windshield facing the forward roadway.
5. Ingested telemetry will stream directly to the central fusion engine.
