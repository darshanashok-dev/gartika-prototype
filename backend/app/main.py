"""
Main FastAPI Application Entrypoint for Gartika Urban Intelligence.

Sets up application lifecycle (startup banner, DB migration), registers REST API routes,
configures CORS middleware, mounts static assets (evidence, mobile app, dashboard),
and establishes the real-time WebSocket event streaming gateway.
"""

import sys
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse

from backend.app.config import settings
from backend.app.database import engine, Base
from backend.app.websocket import manager
from backend.app.routes import events, buses, work_orders, telemetry, stats, stream

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("gartika.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager.
    
    Executes database schema migrations on startup, logs system connection endpoints,
    and handles graceful teardown on shutdown.
    """
    # Initialize database tables
    Base.metadata.create_all(bind=engine)
    logger.info("[DB] Database initialized successfully.")
    
    scheme = "https" if (settings.USE_HTTPS and settings.SSL_CERT_PATH.exists() and settings.SSL_KEY_PATH.exists()) else "http"
    print("\n" + "=" * 45)
    print("        GARTIKA PROTOTYPE")
    print("  AI-Powered Urban Intelligence")
    print("=" * 45)
    print(f"\nBackend API & Swagger Docs:")
    print(f"  {scheme}://localhost:{settings.BACKEND_PORT}")
    print(f"  {scheme}://localhost:{settings.BACKEND_PORT}/docs")
    print(f"\nDashboard:")
    print(f"  {scheme}://localhost:{settings.BACKEND_PORT}")
    print(f"\nMobile Edge Unit (Open on Smartphone):")
    print(f"  {scheme}://{settings.LOCAL_IP}:{settings.BACKEND_PORT}/mobile")
    print(f"\nMode: {'DEMO' if settings.DEMO_MODE else 'LIVE'}")
    print(f"Bus ID: {settings.GARTIKA_BUS_ID}")
    print(f"Protocol: {scheme.upper()} (Live Camera: {'ENABLED' if scheme == 'https' else 'HTTP mode'})")
    print("=" * 45 + "\n")
    
    yield
    logger.info("[MAIN] Shutting down Gartika platform.")

# Initialize FastAPI App instance
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Gartika: AI-Powered Mobile Urban Intelligence Platform",
    lifespan=lifespan
)

# CORS middleware for mobile devices and external frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(stats.router)
app.include_router(events.router)
app.include_router(buses.router)
app.include_router(work_orders.router)
app.include_router(telemetry.router)
app.include_router(stream.router)

# Mount evidence folder for serving saved defect images
app.mount("/evidence", StaticFiles(directory=str(settings.EVIDENCE_DIR)), name="evidence")

# Mount mobile web interface
app.mount("/mobile", StaticFiles(directory=str(settings.MOBILE_DIR), html=True), name="mobile")

# Real-time WebSocket endpoint
@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for bidirectional real-time communication with dashboards.
    Accepts connections, listens for ping-pongs, and handles graceful disconnection.
    """
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo or handle incoming client ping/messages
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"[WS] Exception in client websocket: {e}")
        manager.disconnect(websocket)

# Check if dashboard dist exists, else fallback to dynamic docs
if settings.DASHBOARD_DIST.exists():
    @app.api_route("/styles.css", methods=["GET", "HEAD"], include_in_schema=False)
    def get_root_styles():
        """Serve root stylesheet for the web dashboard."""
        return FileResponse(settings.DASHBOARD_DIST / "styles.css", media_type="text/css")

    @app.api_route("/app.js", methods=["GET", "HEAD"], include_in_schema=False)
    def get_root_app_js():
        """Serve root client JavaScript application for the web dashboard."""
        return FileResponse(settings.DASHBOARD_DIST / "app.js", media_type="application/javascript")

    app.mount("/dashboard", StaticFiles(directory=str(settings.DASHBOARD_DIST), html=True), name="dashboard")
    
    @app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
    def root():
        """Serve root landing page (command center dashboard)."""
        return FileResponse(settings.DASHBOARD_DIST / "index.html")
else:
    @app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
    def root():
        """Fallback to Swagger API documentation if dashboard is not built."""
        return RedirectResponse(url="/docs")

if __name__ == "__main__":
    import uvicorn
    ssl_cert = str(settings.SSL_CERT_PATH) if (settings.USE_HTTPS and settings.SSL_CERT_PATH.exists()) else None
    ssl_key = str(settings.SSL_KEY_PATH) if (settings.USE_HTTPS and settings.SSL_KEY_PATH.exists()) else None

    uvicorn.run(
        "backend.app.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=False,
        ssl_certfile=ssl_cert,
        ssl_keyfile=ssl_key
    )
