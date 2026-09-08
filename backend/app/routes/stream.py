import logging
import base64
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from backend.app.config import settings

router = APIRouter(prefix="/stream", tags=["stream"])
logger = logging.getLogger("gartika.stream")

# Store the latest frame in memory for dashboard preview if streaming from phone
latest_frame_bytes: bytes = b""

@router.post("/frame")
async def upload_frame(
    bus_id: str = Form("BUS-101"),
    frame: UploadFile = File(...)
):
    """Receive live frame from smartphone camera stream."""
    global latest_frame_bytes
    try:
        latest_frame_bytes = await frame.read()
        return {"status": "ok", "size": len(latest_frame_bytes)}
    except Exception as e:
        logger.error(f"Error handling frame: {e}")
        raise HTTPException(status_code=500, detail=str(e))
