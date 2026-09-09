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
    PROJECT_NAME: str = "Gartika Urban Intelligence"
    VERSION: str = "1.0.0"
    GARTIKA_BUS_ID: str = os.getenv("GARTIKA_BUS_ID", "BUS-101")
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")
    DASHBOARD_PORT: int = int(os.getenv("DASHBOARD_PORT", "3000"))
    DEMO_MODE: bool = False
    CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.45"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'gartika.db'}")
    
    # Filesystem Storage Paths
    BASE_DIR: Path = BASE_DIR
    EVIDENCE_DIR: Path = BASE_DIR / os.getenv("EVIDENCE_DIR", "data/evidence")
    VIDEOS_DIR: Path = BASE_DIR / os.getenv("VIDEOS_DIR", "data/videos")
    DEMO_DIR: Path = BASE_DIR / "data/demo"

    MOBILE_DIR: Path = BASE_DIR / "mobile"
    DASHBOARD_DIR: Path = BASE_DIR / "dashboard"
    DASHBOARD_DIST: Path = BASE_DIR / "dashboard"
    
    LOCAL_IP: str = get_local_ip()
    SSL_CERT_PATH: Path = BASE_DIR / os.getenv("SSL_CERT_PATH", "cert.pem")
    SSL_KEY_PATH: Path = BASE_DIR / os.getenv("SSL_KEY_PATH", "key.pem")
    USE_HTTPS: bool = os.getenv("USE_HTTPS", "true").lower() in ("true", "1", "yes")

settings = Settings()

# Ensure required media directories exist on startup
settings.EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
settings.VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
settings.DEMO_DIR.mkdir(parents=True, exist_ok=True)
