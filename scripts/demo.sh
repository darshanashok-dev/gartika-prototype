#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "============================================================"
echo "          GARTIKA URBAN SENSING PLATFORM (SIH 2026)"
echo "                   ONE-COMMAND DEMO STARTUP"
echo "============================================================"

# 1. Environment & Dependencies Check
echo "[1/4] Checking Python environment & packages..."
python3 -c "import fastapi, sqlalchemy, cv2, uvicorn; print('  ✓ Core packages verified.')"

# 2. Reset and Initialize Clean DB
echo "[2/4] Resetting demo database..."
python3 scripts/reset_demo.py

# 3. Seed Deterministic Demo Scenarios
echo "[3/5] Seeding initial fleet and transit corridors..."
python3 scripts/seed_demo_data.py || true

# 4. Build Frontend Distribution if needed
if [ ! -d "dashboard/dist" ]; then
    echo "[4/5] Building React Dashboard bundle..."
    (cd dashboard && npm run build)
else
    echo "[4/5] React Dashboard bundle verified in dashboard/dist."
fi

# 5. Launch Backend Application Server
echo "[5/5] Starting Gartika FastAPI & Real-time WebSocket Hub..."
echo ""
echo "============================================================"
echo "                   GARTIKA SYSTEM READY"
echo "============================================================"
echo "  ► Command Center Dashboard : http://localhost:8000/"
echo "  ► Mobile Sensing Terminal  : http://localhost:8000/mobile"
echo "  ► Swagger REST API Docs    : http://localhost:8000/docs"
echo "============================================================"
echo ""

export DEMO_MODE=true
python3 -m backend.app.main
