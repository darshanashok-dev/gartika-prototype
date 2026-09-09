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
    # Initialize database tables
    Base.metadata.create_all(bind=engine)
    logger.info("[DB] Database initialized successfully.")
    
    print("\n" + "=" * 45)
    print("        GARTIKA PROTOTYPE")
    print("  AI-Powered Urban Intelligence")
    print("=" * 45)
    print(f"\nBackend API & Swagger Docs:")
    print(f"  http://localhost:{settings.BACKEND_PORT}")
    print(f"  http://localhost:{settings.BACKEND_PORT}/docs")
    print(f"\nDashboard:")
    print(f"  http://localhost:{settings.BACKEND_PORT} or http://localhost:{settings.DASHBOARD_PORT}")
    print(f"\nMobile Edge Unit (Open on Smartphone):")
    print(f"  http://{settings.LOCAL_IP}:{settings.BACKEND_PORT}/mobile")
    print(f"\nMode: {'DEMO' if settings.DEMO_MODE else 'LIVE'}")
    print(f"Bus ID: {settings.GARTIKA_BUS_ID}")
    print("=" * 45 + "\n")
    
    yield
    logger.info("[MAIN] Shutting down Gartika platform.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Gartika: AI-Powered Mobile Urban Intelligence Platform",
    lifespan=lifespan
)

# CORS middleware for mobile and frontend access
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

# Mount evidence folder
app.mount("/evidence", StaticFiles(directory=str(settings.EVIDENCE_DIR)), name="evidence")

# Mount mobile web interface
app.mount("/mobile", StaticFiles(directory=str(settings.MOBILE_DIR), html=True), name="mobile")

# Real-time WebSocket endpoint
@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
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

# Check if dashboard dist exists, else fallback to dynamic page
if settings.DASHBOARD_DIST.exists():
    @app.api_route("/styles.css", methods=["GET", "HEAD"], include_in_schema=False)
    def get_root_styles():
        return FileResponse(settings.DASHBOARD_DIST / "styles.css", media_type="text/css")

    @app.api_route("/app.js", methods=["GET", "HEAD"], include_in_schema=False)
    def get_root_app_js():
        return FileResponse(settings.DASHBOARD_DIST / "app.js", media_type="application/javascript")

    app.mount("/dashboard", StaticFiles(directory=str(settings.DASHBOARD_DIST), html=True), name="dashboard")
    
    @app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
    def root():
        return FileResponse(settings.DASHBOARD_DIST / "index.html")
else:
    @app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
    def root():
        return RedirectResponse(url="/docs")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.app.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=False
    )
