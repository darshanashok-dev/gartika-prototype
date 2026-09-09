"""
Real-Time WebSocket Connection Manager for Gartika Urban Intelligence.

Manages active client WebSocket connections and provides concurrent broadcasting
of telemetry streams, new defect alerts, and work order lifecycle updates.
"""

import asyncio
import json
import logging
from typing import List
from fastapi import WebSocket

logger = logging.getLogger("gartika.ws")

class ConnectionManager:
    """
    Tracks and broadcasts events to all live connected dashboard clients.
    
    Attributes:
        active_connections (list): List of currently connected WebSocket client instances.
    """
    def __init__(self):
        """
        Initialize the WebSocket connection registry.
        """
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """
        Accept an incoming WebSocket connection, register it, and send a welcome payload.
        
        Args:
            websocket: Incoming FastAPI WebSocket instance.
        """
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"[WS] Client connected. Total clients: {len(self.active_connections)}")
        # Send initial connection acknowledgement
        try:
            await websocket.send_json({"type": "CONNECTION_ESTABLISHED", "message": "Connected to Gartika Event Stream"})
        except Exception:
            pass

    def disconnect(self, websocket: WebSocket):
        """
        Remove a closed or terminated WebSocket from the active list.
        
        Args:
            websocket: FastAPI WebSocket instance to unregister.
        """
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"[WS] Client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """
        Broadcast a JSON payload concurrently to all connected WebSocket clients.
        
        Automatically purges dead or disconnected client sockets.
        
        Args:
            message: Dictionary payload to serialize and transmit.
        """
        if not self.active_connections:
            return

        dead_connections = []

        async def send_to_client(ws: WebSocket):
            """Helper function to send JSON to an individual socket client."""
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.debug(f"[WS] Failed to send message to client: {e}")
                dead_connections.append(ws)

        # Dispatch sends concurrently to all subscribers
        await asyncio.gather(*(send_to_client(ws) for ws in self.active_connections), return_exceptions=True)

        # Clean up any sockets that failed during transmission
        for dead in dead_connections:
            self.disconnect(dead)

# Global singleton WebSocket connection manager
manager = ConnectionManager()
