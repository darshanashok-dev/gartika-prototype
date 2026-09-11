"""
Configuration Management Module for Gartika Urban Intelligence.

Loads environment variables, defines runtime defaults (ports, thresholds, directory paths),
and resolves local network IP addressing for mobile sensor pairing.
"""

import os
import socket
from pathlib import Path
from dotenv import load_dotenv

# Base directory of the repository root
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

def get_local_ip() -> str:
    """
    Retrieve the host computer's local LAN IP address.
    
    Creates a UDP socket connection (without transmitting packets) to query the primary
    outbound network interface. Used to generate mobile QR codes and connection URLs.
    
    Returns:
        str: Local IPv4 address (e.g., '192.168.1.15') or '127.0.0.1' fallback.
    """
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Connect to a public DNS IP (doesn't send actual packet)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

class Settings:
    """
    Global application settings and directory path configurations.
    """
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Gartika Urban Intelligence")
    VERSION: str = "1.1.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Fleet & Server
    GARTIKA_BUS_ID: str = os.getenv("GARTIKA_BUS_ID", "BUS-101")
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")
    DASHBOARD_PORT: int = int(os.getenv("DASHBOARD_PORT", "3000"))
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")
    
    # CORS Configuration
    CORS_ORIGINS_RAW: str = os.getenv("CORS_ORIGINS", "*")
    @property
    def cors_origins(self) -> list:
        if self.CORS_ORIGINS_RAW.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS_RAW.split(",") if origin.strip()]

    # AI & Sensor Fusion
    CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.45"))
    MODEL_PATH: Path = BASE_DIR / os.getenv("MODEL_PATH", "models/gartika_road_defect.pt")
    ONNX_MODEL_PATH: Path = BASE_DIR / os.getenv("ONNX_MODEL_PATH", "models/gartika_road_defect.onnx")
    FUSION_TEMPORAL_WINDOW_MS: int = int(os.getenv("FUSION_TEMPORAL_WINDOW_MS", "500"))
    SPATIAL_DEDUP_METERS: float = float(os.getenv("SPATIAL_DEDUP_METERS", "15.0"))
    SPATIAL_DEDUP_WINDOW_SECONDS: int = int(os.getenv("SPATIAL_DEDUP_WINDOW_SECONDS", "300"))
    
    # IMU Configurable Thresholds & Filtering
    IMU_VERTICAL_SHOCK_THRESHOLD: float = float(os.getenv("IMU_VERTICAL_SHOCK_THRESHOLD", "3.2"))
    IMU_ABSOLUTE_Z_THRESHOLD: float = float(os.getenv("IMU_ABSOLUTE_Z_THRESHOLD", "13.5"))
    IMU_FRAME_ALIGNMENT_WINDOW_MS: int = int(os.getenv("IMU_FRAME_ALIGNMENT_WINDOW_MS", "800"))
    IMU_NOISE_FLOOR: float = float(os.getenv("IMU_NOISE_FLOOR", "0.25"))
    IMU_COOLDOWN_SECONDS: float = float(os.getenv("IMU_COOLDOWN_SECONDS", "4.0"))
    REPAIR_VERIFICATION_CLEAN_COUNT: int = int(os.getenv("REPAIR_VERIFICATION_CLEAN_COUNT", "2"))
    
    # Security & Auth
    DEVICE_AUTH_ENABLED: bool = os.getenv("DEVICE_AUTH_ENABLED", "false").lower() in ("true", "1", "yes")
    DEVICE_API_KEY: str = os.getenv("DEVICE_API_KEY", "gartika_dev_device_token_secret")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "gartika_jwt_secret_change_in_production")
    WS_AUTH_REQUIRED: bool = os.getenv("WS_AUTH_REQUIRED", "false").lower() in ("true", "1", "yes")

    # Database Configuration (SQLite / PostgreSQL / PostGIS)
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'gartika.db'}")
    
    # Filesystem & Media Storage Paths
    BASE_DIR: Path = BASE_DIR
    STORAGE_TYPE: str = os.getenv("STORAGE_TYPE", "local")
    EVIDENCE_DIR: Path = BASE_DIR / os.getenv("EVIDENCE_DIR", "data/evidence")
    VIDEOS_DIR: Path = BASE_DIR / os.getenv("VIDEOS_DIR", "data/videos")
    DEMO_DIR: Path = BASE_DIR / "data/demo"

    MOBILE_DIR: Path = BASE_DIR / "mobile"
    DASHBOARD_DIR: Path = BASE_DIR / "dashboard"
    DASHBOARD_DIST: Path = BASE_DIR / "dashboard/dist"
    
    LOCAL_IP: str = get_local_ip()
    SSL_CERT_PATH: Path = BASE_DIR / os.getenv("SSL_CERT_PATH", "cert.pem")
    SSL_KEY_PATH: Path = BASE_DIR / os.getenv("SSL_KEY_PATH", "key.pem")
    USE_HTTPS: bool = os.getenv("USE_HTTPS", "false").lower() in ("true", "1", "yes")

settings = Settings()

# Ensure required media directories exist on startup
settings.EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
settings.VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
settings.DEMO_DIR.mkdir(parents=True, exist_ok=True)

