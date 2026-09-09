#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "================================================="
echo "   STARTING GARTIKA URBAN INTELLIGENCE DEMO"
echo "================================================="

# Step 1: Seed initial demonstration data
python3 scripts/seed_demo_data.py

# Step 2: Ensure demo road video exists
if [ ! -f "data/videos/road_demo.mp4" ]; then
    echo "[AI] Preparing demonstration road video..."
    python3 -c "from ai.video_processor import create_synthetic_road_video; create_synthetic_road_video('data/videos/road_demo.mp4', duration_sec=15)"
fi

# Step 3: Copy dashboard dist files
mkdir -p dashboard/dist
cp dashboard/index.html dashboard/styles.css dashboard/app.js dashboard/dist/ 2>/dev/null || true

LOCAL_IP=$(python3 -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); (s.connect(('8.8.8.8', 80)), print(s.getsockname()[0]), s.close()) if True else None" 2>/dev/null || echo "127.0.0.1")

# Determine protocol
if [ -f "cert.pem" ] && [ -f "key.pem" ]; then
    PROTO="https"
else
    PROTO="http"
fi

echo ""
echo "====================================="
echo "        GARTIKA PROTOTYPE"
echo "====================================="
echo ""
echo "Backend & GIS Dashboard:"
echo "${PROTO}://localhost:8000"
echo ""
echo "Mobile Edge Unit (Open on Smartphone):"
echo "${PROTO}://${LOCAL_IP}:8000/mobile"
echo ""
echo "Mode:"
echo "DEMO / LIVE"
echo ""
echo "Bus:"
echo "BUS-101"
echo "====================================="
echo ""

# Trap to kill background processes on exit
cleanup() {
    echo ""
    echo "[SHUTDOWN] Stopping Gartika services..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start FastAPI backend
echo "[1/2] Launching Backend Server..."
python3 -m backend.app.main &
BACKEND_PID=$!

sleep 2

# Start AI Ingestion Engine in demo mode
echo "[2/2] Launching AI Processing Engine on Demo Video..."
python3 ai/video_processor.py --source demo --bus-id BUS-101 --backend-url ${PROTO}://localhost:8000 &
AI_PID=$!

echo ""
echo "✓ All Gartika services running! Press Ctrl+C to stop."
echo ""

wait $BACKEND_PID $AI_PID
