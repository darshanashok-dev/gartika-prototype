import asyncio
import json
import logging
from typing import List
from fastapi import WebSocket

logger = logging.getLogger("gartika.ws")

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"[WS] Client connected. Total clients: {len(self.active_connections)}")
        # Send initial connection acknowledgement
        try:
            await websocket.send_json({"type": "CONNECTION_ESTABLISHED", "message": "Connected to Gartika Event Stream"})
        except Exception:
            pass

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"[WS] Client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast JSON message concurrently to all connected clients."""
        if not self.active_connections:
            return

        dead_connections = []

        async def send_to_client(ws: WebSocket):
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.debug(f"[WS] Failed to send message to client: {e}")
                dead_connections.append(ws)

        await asyncio.gather(*(send_to_client(ws) for ws in self.active_connections), return_exceptions=True)

        for dead in dead_connections:
            self.disconnect(dead)

manager = ConnectionManager()

