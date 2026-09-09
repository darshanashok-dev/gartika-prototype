import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response
from fastapi.responses import Response

router = APIRouter(prefix="/stream", tags=["stream"])
logger = logging.getLogger("gartika.stream")

# Store the latest frame in memory for dashboard live preview
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
        return {"status": "ok", "bus_id": bus_id, "size": len(latest_frame_bytes)}
    except Exception as e:
        logger.error(f"Error handling frame: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/latest-frame")
def get_latest_frame():
    """Retrieve the most recent frame as JPEG for dashboard live viewing."""
    global latest_frame_bytes
    if not latest_frame_bytes:
        raise HTTPException(status_code=404, detail="No active stream frame available")
    return Response(content=latest_frame_bytes, media_type="image/jpeg")

