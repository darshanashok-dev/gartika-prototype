#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "================================================="
echo "   STARTING GARTIKA IN STRICT LIVE MOBILE MODE"
echo "================================================="

# Step 1: Ensure database and environment are clean and set to LIVE
python3 scripts/reset_to_live.py

# Step 2: Sync dashboard dist files
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
echo "====================================================="
echo "        GARTIKA LIVE MOBILE PLATFORM"
echo "====================================================="
echo ""
echo "Command Center Dashboard:"
echo "  ${PROTO}://localhost:8000"
echo ""
echo "Mobile Edge Unit (Open in your smartphone browser):"
echo "  ${PROTO}://${LOCAL_IP}:8000/mobile"
echo ""
echo "Mode: STRICT LIVE (Zero Simulated Data)"
echo "Waiting for real camera feed, GPS location, and IMU shocks from phone."
echo "====================================================="
echo ""

# Trap to kill background backend on exit
cleanup() {
    echo ""
    echo "[SHUTDOWN] Stopping Gartika backend..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start FastAPI backend
python3 -m backend.app.main
