"""
Sensor Fusion Engine for Gartika Urban Intelligence.

Implements unified multi-modal sensor fusion:
1. Aligns asynchronous camera frames and IMU samples via temporal windowing.
2. Combines computer vision candidates with IMU mechanical impact shocks.
3. Implements spatial deduplication (Haversine distance) to aggregate observations into persistent RoadDefects.
4. Elevates multi-bus verification confidence across fleet vehicles.
5. Executes closed-loop post-repair validation when vehicles traverse previously repaired sites.
"""

import math
import time
import json
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Tuple, Any
import cv2
import numpy as np
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models.defect import RoadDefect, Observation
from backend.app.models.event import Event
from backend.app.models.work_order import WorkOrder
from backend.app.models.bus import Bus
from backend.app.fusion.models import (
    ImuReading, GpsReading, FrameReading, VisualCandidate,
    ImpactCandidate, SensorSnapshot, FusionResult
)
from backend.app.fusion.buffer import buffer_manager
from backend.app.fusion.privacy import privacy_filter

logger = logging.getLogger("gartika.fusion.engine")

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance in meters between two GPS coordinates using the Haversine formula.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

class SensorFusionEngine:
    """
    Core Sensor Fusion Engine for Gartika.
    """
    def __init__(
        self,
        temporal_window_ms: int = settings.FUSION_TEMPORAL_WINDOW_MS,
        spatial_dedup_meters: float = settings.SPATIAL_DEDUP_METERS
    ):
        self.temporal_window_ms = temporal_window_ms
        self.spatial_dedup_meters = spatial_dedup_meters

    def process_frame(
        self,
        bus_id: str,
        frame_bytes: bytes,
        visual_defects: List[Dict],
        db: Session,
        gps_override: Optional[Tuple[float, float]] = None,
        sequence_number: Optional[int] = None
    ) -> List[Dict]:
        """
        Process incoming camera frame with detected visual candidates and fuse with IMU buffer.
        """
        now_ts = time.time()
        buf = buffer_manager.get_buffer(bus_id)
        
        # Buffer this frame for temporal alignment
        frame_reading = FrameReading(
            timestamp=now_ts,
            frame_bytes=frame_bytes
        )
        buf.add_frame(frame_reading)

        # Retrieve GPS
        lat, lon, speed, heading = None, None, 0.0, None
        if gps_override and gps_override[0] is not None and gps_override[1] is not None:
            lat, lon = gps_override
        elif buf.latest_gps and buf.latest_gps.is_valid:
            lat = buf.latest_gps.latitude
            lon = buf.latest_gps.longitude
            speed = buf.latest_gps.speed
            heading = buf.latest_gps.heading
        else:
            # Check DB for last known bus position
            bus_rec = db.query(Bus).filter(Bus.bus_id == bus_id).first()
            if bus_rec and bus_rec.latitude is not None and bus_rec.longitude is not None:
                lat, lon = bus_rec.latitude, bus_rec.longitude
                speed = bus_rec.speed or 0.0

        # Look for temporally-aligned IMU sample (± temporal_window_ms)
        aligned_imu = buf.get_aligned_imu(now_ts, window_ms=self.temporal_window_ms)

        # Check for closed-loop repair site check if GPS is available
        if lat is not None and lon is not None:
            self.check_repair_verification(
                bus_id=bus_id,
                lat=lat,
                lon=lon,
                has_visual_defect=bool(visual_defects),
                aligned_imu=aligned_imu,
                db=db
            )

        events_generated = []

        # If visual defects were detected, evaluate each through the fusion pipeline
        if visual_defects:
            for v_det in visual_defects:
                fusion_res = self.fuse_visual_and_imu(
                    visual_det=v_det,
                    aligned_imu=aligned_imu,
                    frame_bytes=frame_bytes,
                    bus_id=bus_id
                )
                
                # Persist or update defect & observation in database
                event_dict = self.persist_fused_event(
                    fusion_res=fusion_res,
                    bus_id=bus_id,
                    lat=lat,
                    lon=lon,
                    speed=speed,
                    heading=heading,
                    sequence_number=sequence_number,
                    db=db
                )
                if event_dict:
                    events_generated.append(event_dict)

        return events_generated

    def process_imu_telemetry(
        self,
        bus_id: str,
        lat: float,
        lon: float,
        ax: float,
        ay: float,
        az: float,
        speed: float,
        db: Session,
        heading: Optional[float] = None,
        sequence_number: Optional[int] = None,
        timestamp_sec: Optional[float] = None
    ) -> Optional[Dict]:
        """
        Ingest IMU shock telemetry, buffer it, and check for impact events.
        Does NOT blindly claim a pothole on every spike; classifies as ROAD_IMPACT or fuses with recent frame.
        """
        now_ts = timestamp_sec or time.time()
        buf = buffer_manager.get_buffer(bus_id)

        imu_reading = ImuReading(
            timestamp=now_ts,
            ax=ax, ay=ay, az=az
        )
        buf.add_imu(imu_reading, sequence_number=sequence_number)

        if lat is not None and lon is not None:
            gps_reading = GpsReading(
                timestamp=now_ts,
                latitude=lat,
                longitude=lon,
                speed=speed,
                heading=heading
            )
            buf.add_gps(gps_reading, sequence_number=sequence_number)

        # Check for vertical accelerometer shock (> 13.5 m/s² or |az - 9.81| > 3.2 m/s²)
        shock_mag = imu_reading.vertical_shock
        if shock_mag > 3.2 or az > 13.5:
            # Check for aligned camera frame from this specific bus
            aligned_frame = buf.get_aligned_frame(now_ts, window_ms=800)
            
            # Severity classification based on physical shock
            if shock_mag > 6.0 or az > 16.0:
                severity = "HIGH"
                vib_level = "HIGH"
            elif shock_mag > 4.0:
                severity = "MEDIUM"
                vib_level = "HIGH"
            else:
                severity = "LOW"
                vib_level = "MEDIUM"

            impact_cand = ImpactCandidate(
                timestamp=now_ts,
                shock_magnitude=shock_mag,
                peak_az=az,
                severity=severity
            )

            # Check if there is an aligned frame to save evidence
            evidence_path = None
            evidence_bgr = None
            if aligned_frame and aligned_frame.frame_bytes:
                nparr = np.frombuffer(aligned_frame.frame_bytes, np.uint8)
                evidence_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            fusion_res = FusionResult(
                event_type="ROAD_IMPACT",  # Non-overclaiming intermediate classification
                final_confidence=min(0.88, 0.55 + min(0.30, shock_mag * 0.05)),
                severity=severity,
                vibration_level=vib_level,
                source="imu_shock_only" if not aligned_frame else "sensor_fusion",
                evidence_frame_bgr=evidence_bgr,
                impact_candidate=impact_cand,
                is_verified_by_fusion=bool(aligned_frame)
            )

            return self.persist_fused_event(
                fusion_res=fusion_res,
                bus_id=bus_id,
                lat=lat,
                lon=lon,
                speed=speed,
                heading=heading,
                sequence_number=sequence_number,
                db=db
            )

        return None

    def fuse_visual_and_imu(
        self,
        visual_det: Dict,
        aligned_imu: Optional[ImuReading],
        frame_bytes: bytes,
        bus_id: str
    ) -> FusionResult:
        """
        Combine visual candidate with temporally-aligned IMU reading.
        """
        v_type = visual_det.get("event_type", visual_det.get("class", "POTHOLE")).upper()
        raw_conf = visual_det.get("confidence", 0.60)
        source = visual_det.get("source", "yolo" if raw_conf > 0.65 else "opencv_heuristic")
        bbox = visual_det.get("bbox", [])
        area = visual_det.get("area", 0)

        # Decode image for evidence annotation
        nparr = np.frombuffer(frame_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        v_cand = VisualCandidate(
            defect_type=v_type,
            bbox=bbox,
            source=source,
            confidence=raw_conf,
            area=area
        )

        # Check IMU shock corroboration
        imu_boost = 0.0
        vibration_level = "NORMAL"
        impact_cand = None
        is_verified = False

        if aligned_imu:
            shock = aligned_imu.vertical_shock
            if shock > 3.0 or aligned_imu.az > 13.5:
                vibration_level = "HIGH"
                imu_boost = 0.15
                is_verified = True
                impact_cand = ImpactCandidate(
                    timestamp=aligned_imu.timestamp,
                    shock_magnitude=shock,
                    peak_az=aligned_imu.az,
                    severity="HIGH" if shock > 5.0 else "MEDIUM"
                )
            elif shock > 1.5:
                vibration_level = "MEDIUM"
                imu_boost = 0.08
                is_verified = True
                impact_cand = ImpactCandidate(
                    timestamp=aligned_imu.timestamp,
                    shock_magnitude=shock,
                    peak_az=aligned_imu.az,
                    severity="LOW"
                )

        # Determine final event type & calibrated score
        if v_type == "POTHOLE" and vibration_level == "HIGH":
            final_type = "POTHOLE"
        elif v_type == "SPEED_BREAKER" and vibration_level in ("MEDIUM", "HIGH"):
            final_type = "SPEED_BREAKER"
        elif v_type == "POTHOLE" and vibration_level == "NORMAL":
            final_type = "POTHOLE"
        else:
            final_type = v_type

        final_conf = min(0.99, round(raw_conf + imu_boost, 3))
        
        # Severity assignment based on area, confidence, and shock
        if area > 18000 or final_conf > 0.88 or vibration_level == "HIGH":
            severity = "HIGH"
        elif area > 6000 or final_conf > 0.75:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        return FusionResult(
            event_type=final_type,
            final_confidence=final_conf,
            severity=severity,
            vibration_level=vibration_level,
            source="sensor_fusion" if aligned_imu else source,
            evidence_frame_bgr=img_bgr,
            bbox=bbox,
            visual_candidate=v_cand,
            impact_candidate=impact_cand,
            is_verified_by_fusion=is_verified
        )

    def persist_fused_event(
        self,
        fusion_res: FusionResult,
        bus_id: str,
        lat: Optional[float],
        lon: Optional[float],
        speed: Optional[float],
        heading: Optional[float],
        sequence_number: Optional[int],
        db: Session
    ) -> Optional[Dict]:
        """
        Deduplicate against persistent RoadDefect database entities, save evidence,
        and generate synchronized Event and Observation records.
        """
        now = datetime.now(timezone.utc)
        now_ts = int(time.time())

        # Save annotated & privacy-filtered evidence image if visual frame exists
        evidence_path = None
        if fusion_res.evidence_frame_bgr is not None:
            evidence_path = self.save_annotated_evidence(
                image_bgr=fusion_res.evidence_frame_bgr,
                bbox=fusion_res.bbox,
                event_type=fusion_res.event_type,
                confidence=fusion_res.final_confidence,
                bus_id=bus_id
            )

        # 1. Spatial Deduplication Check (if GPS is valid)
        existing_defect: Optional[RoadDefect] = None
        if lat is not None and lon is not None:
            # Query nearby defects of matching category
            candidates = db.query(RoadDefect).filter(
                RoadDefect.defect_type == fusion_res.event_type,
                RoadDefect.status.notin_(["CLOSED", "REPAIR_VERIFIED"])
            ).all()

            for d in candidates:
                dist = haversine_distance(lat, lon, d.latitude, d.longitude)
                if dist <= self.spatial_dedup_meters:
                    existing_defect = d
                    break

        if existing_defect:
            # Merge observation into existing persistent RoadDefect
            existing_defect.last_seen = now
            existing_defect.observation_count += 1
            if evidence_path:
                existing_defect.latest_evidence_path = evidence_path
            
            # Update best confidence
            if fusion_res.final_confidence > existing_defect.best_confidence:
                existing_defect.best_confidence = fusion_res.final_confidence

            # Track unique buses
            try:
                buses_list = json.loads(existing_defect.verifying_buses or "[]")
            except Exception:
                buses_list = []
            if bus_id not in buses_list:
                buses_list.append(bus_id)
                existing_defect.unique_bus_count = len(buses_list)
                existing_defect.verifying_buses = json.dumps(buses_list)

            # Multi-bus verification status progression
            if existing_defect.unique_bus_count >= 2:
                if existing_defect.status in ["UNVERIFIED", "SUSPECTED"]:
                    existing_defect.status = "VERIFIED"
                elif existing_defect.unique_bus_count >= 3 and existing_defect.status == "VERIFIED":
                    existing_defect.status = "HIGH_CONFIDENCE"
            elif fusion_res.is_verified_by_fusion and existing_defect.status == "UNVERIFIED":
                existing_defect.status = "VERIFIED"

            defect_id = existing_defect.defect_id
            db_defect = existing_defect
        else:
            # Create new persistent RoadDefect entity
            code = uuid.uuid4().hex[:6].upper()
            defect_id = f"DEF-{fusion_res.event_type[:4]}-{code}"
            
            # Initial verification state
            if fusion_res.is_verified_by_fusion:
                init_status = "VERIFIED"
            elif fusion_res.source == "opencv_heuristic":
                init_status = "UNVERIFIED"
            else:
                init_status = "SUSPECTED"

            loc_name = f"Road Section ({lat:.4f}, {lon:.4f})" if (lat and lon) else "Urban Road Corridor"
            db_defect = RoadDefect(
                defect_id=defect_id,
                defect_type=fusion_res.event_type,
                latitude=lat if lat is not None else 12.9716,
                longitude=lon if lon is not None else 77.5946,
                severity=fusion_res.severity,
                status=init_status,
                first_seen=now,
                last_seen=now,
                observation_count=1,
                unique_bus_count=1,
                verifying_buses=json.dumps([bus_id]),
                best_confidence=fusion_res.final_confidence,
                latest_evidence_path=evidence_path,
                location_name=loc_name
            )
            db.add(db_defect)

        # 2. Record Observation entry
        obs_code = uuid.uuid4().hex[:6].upper()
        obs_id = f"OBS-{obs_code}"
        db_obs = Observation(
            observation_id=obs_id,
            defect_id=defect_id,
            bus_id=bus_id,
            timestamp=now,
            latitude=lat if lat is not None else 12.9716,
            longitude=lon if lon is not None else 77.5946,
            speed=speed,
            heading=heading,
            source=fusion_res.source,
            visual_confidence=fusion_res.visual_candidate.confidence if fusion_res.visual_candidate else None,
            heuristic_score=fusion_res.visual_candidate.heuristic_score if fusion_res.visual_candidate else None,
            imu_shock_magnitude=fusion_res.impact_candidate.shock_magnitude if fusion_res.impact_candidate else None,
            vibration_level=fusion_res.vibration_level,
            evidence_path=evidence_path,
            sequence_number=sequence_number
        )
        db.add(db_obs)

        # 3. Create backward-compatible Event record for existing frontend APIs and WebSockets
        evt_code = uuid.uuid4().hex[:6].upper()
        evt_id = f"EVT-{fusion_res.event_type[:4]}-{evt_code}"
        db_event = Event(
            event_id=evt_id,
            bus_id=bus_id,
            event_type=fusion_res.event_type,
            confidence=fusion_res.final_confidence,
            latitude=lat,
            longitude=lon,
            timestamp=now,
            severity=fusion_res.severity,
            evidence_path=evidence_path,
            status=db_defect.status,
            vibration_level=fusion_res.vibration_level,
            location_name=db_defect.location_name,
            defect_id=defect_id,
            sequence_number=sequence_number
        )
        db.add(db_event)

        # Update Bus position in registry
        bus_rec = db.query(Bus).filter(Bus.bus_id == bus_id).first()
        if bus_rec:
            if lat is not None: bus_rec.latitude = lat
            if lon is not None: bus_rec.longitude = lon
            if speed is not None: bus_rec.speed = speed
            bus_rec.last_seen = now
            bus_rec.status = "ONLINE"
        else:
            new_bus = Bus(
                bus_id=bus_id,
                name=f"Bus Unit {bus_id}",
                latitude=lat,
                longitude=lon,
                speed=speed or 0.0,
                last_seen=now,
                status="ONLINE"
            )
            db.add(new_bus)

        db.commit()
        db.refresh(db_event)
        db.refresh(db_defect)

        logger.info(
            f"[FUSION] {fusion_res.event_type} on {bus_id} -> Defect: {defect_id} "
            f"(Status: {db_defect.status}, Obs: {db_defect.observation_count}, Unique Buses: {db_defect.unique_bus_count})"
        )

        return {
            "id": db_event.id,
            "event_id": db_event.event_id,
            "defect_id": defect_id,
            "bus_id": db_event.bus_id,
            "event_type": db_event.event_type,
            "confidence": db_event.confidence,
            "latitude": db_event.latitude,
            "longitude": db_event.longitude,
            "severity": db_event.severity,
            "evidence_image_url": db_event.evidence_path,
            "status": db_defect.status,
            "observation_count": db_defect.observation_count,
            "unique_bus_count": db_defect.unique_bus_count,
            "vibration_level": db_event.vibration_level,
            "timestamp": db_event.timestamp.isoformat()
        }

    def check_repair_verification(
        self,
        bus_id: str,
        lat: float,
        lon: float,
        has_visual_defect: bool,
        aligned_imu: Optional[ImuReading],
        db: Session
    ):
        """
        Closed-Loop Repair Verification.
        When a vehicle passes within 15m of a defect previously marked REPAIRED:
        - If NO defect is detected & IMU is smooth -> mark REPAIR_VERIFIED & CLOSED.
        - If defect/impact persists -> mark REPAIR_FAILED / ISSUE_PERSISTS.
        """
        repaired_defects = db.query(RoadDefect).filter(
            RoadDefect.repair_status.in_(["REPAIRED", "PENDING_VERIFICATION"]),
            RoadDefect.status.in_(["REPAIRED", "IN_PROGRESS"])
        ).all()

        now = datetime.now(timezone.utc)
        has_shock = (aligned_imu and (aligned_imu.vertical_shock > 3.0 or aligned_imu.az > 13.5))

        for defect in repaired_defects:
            dist = haversine_distance(lat, lon, defect.latitude, defect.longitude)
            if dist <= self.spatial_dedup_meters:
                if not has_visual_defect and not has_shock:
                    # Repair successfully validated!
                    defect.status = "CLOSED"
                    defect.repair_status = "REPAIR_VERIFIED"
                    defect.repair_verified_at = now
                    defect.repair_verified_by_bus_id = bus_id
                    
                    # Update associated work order
                    if defect.work_order_id:
                        wo = db.query(WorkOrder).filter(WorkOrder.work_order_id == defect.work_order_id).first()
                        if wo:
                            wo.status = "RESOLVED"
                            wo.completed_at = now

                    # Add observation check record
                    obs = Observation(
                        observation_id=f"OBS-REP-{uuid.uuid4().hex[:5].upper()}",
                        defect_id=defect.defect_id,
                        bus_id=bus_id,
                        timestamp=now,
                        latitude=lat,
                        longitude=lon,
                        source="closed_loop_repair_verification",
                        is_repair_check=True,
                        repair_check_result="CONFIRMED_REPAIRED"
                    )
                    db.add(obs)
                    db.commit()
                    logger.info(f"[REPAIR VERIFIED] Defect {defect.defect_id} confirmed repaired by {bus_id} at {lat:.5f}, {lon:.5f}")

                elif has_visual_defect or has_shock:
                    # Repair failed / issue persists
                    defect.status = "REPAIR_FAILED"
                    defect.repair_status = "REPAIR_FAILED"
                    obs = Observation(
                        observation_id=f"OBS-REP-{uuid.uuid4().hex[:5].upper()}",
                        defect_id=defect.defect_id,
                        bus_id=bus_id,
                        timestamp=now,
                        latitude=lat,
                        longitude=lon,
                        source="closed_loop_repair_verification",
                        is_repair_check=True,
                        repair_check_result="DEFECT_PERSISTS"
                    )
                    db.add(obs)
                    db.commit()
                    logger.warning(f"[REPAIR FAILED] Defect {defect.defect_id} still persists after repair! Verified by {bus_id}")

    def save_annotated_evidence(
        self,
        image_bgr: np.ndarray,
        bbox: Optional[List[int]],
        event_type: str,
        confidence: float,
        bus_id: str
    ) -> str:
        """
        Anonymize, annotate, and save JPEG evidence frame.
        """
        annotated = privacy_filter.anonymize_frame(image_bgr)
        h, w = annotated.shape[:2]

        if bbox and len(bbox) == 4:
            bx1, by1, bx2, by2 = bbox
            cv2.rectangle(annotated, (bx1, by1), (bx2, by2), (0, 0, 255), 2)
            label = f"{event_type} ({int(confidence * 100)}%)"
            cv2.putText(
                annotated,
                label,
                (bx1, max(18, by1 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 0, 255),
                2
            )

        # Watermark
        ts_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        watermark = f"GARTIKA SENSOR FUSION | {bus_id} | {ts_str}"
        cv2.putText(annotated, watermark, (15, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)

        filename = f"EVT_{event_type}_{int(time.time())}_{uuid.uuid4().hex[:4]}.jpg"
        save_path = settings.EVIDENCE_DIR / filename
        settings.EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(save_path), annotated)
        return f"/evidence/{filename}"

# Global engine singleton
fusion_engine = SensorFusionEngine()
