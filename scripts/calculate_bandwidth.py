#!/usr/bin/env python3
"""
calculate_bandwidth.py - Gartika Edge vs Cloud Bandwidth Calculation Script.

Computes theoretical and measured bandwidth requirements for:
1. Streaming raw high-definition video frames to the cloud (Baseline).
2. Streaming telemetry + compressed detection metadata + edge privacy filtered events (Gartika).

Calculates savings percentage, daily cellular data costs, and fleet scaling metrics.
"""

import argparse
import json
import os
import sys

def calculate_bandwidth(
    fleet_size: int = 10,
    hours_per_day: float = 8.0,
    fps: int = 15,
    frame_width: int = 1280,
    frame_height: int = 720,
    raw_compression_bpp: float = 0.5, # bits per pixel for compressed stream (H.264/H.265)
    telemetry_rate_hz: int = 10, # IMU + GPS telemetry per sec
    telemetry_payload_bytes: int = 250, # JSON payload size
    event_rate_per_hour: int = 12, # average defect events detected per hour
    event_payload_bytes: int = 1500, # JSON + cropped thumbnail
    cellular_cost_per_gb_inr: float = 15.0 # Average Indian cellular data cost per GB in INR
):
    """
    Computes bandwidth comparison between continuous video streaming vs Gartika edge-inference architecture.
    """
    # 1. Cloud Video Streaming Architecture (Baseline)
    # Stream bitrate (Kbps / Mbps)
    raw_stream_bps = frame_width * frame_height * raw_compression_bpp * fps
    raw_stream_kbps = raw_stream_bps / 1000.0
    raw_stream_mbps = raw_stream_kbps / 1000.0
    
    # Data volume per bus
    raw_bytes_per_sec = raw_stream_bps / 8.0
    raw_bytes_per_hour = raw_bytes_per_sec * 3600.0
    raw_gb_per_bus_day = (raw_bytes_per_hour * hours_per_day) / (1024.0 ** 3)
    raw_total_fleet_gb_monthly = raw_gb_per_bus_day * fleet_size * 30.0

    # 2. Gartika Edge-Sensing Architecture
    # Telemetry stream: 10 Hz * 250 bytes = 2500 bytes/sec = 20 Kbps
    telemetry_bps = telemetry_rate_hz * telemetry_payload_bytes * 8.0
    telemetry_kbps = telemetry_bps / 1000.0
    
    # Event metadata stream: 12 events/hour * 1500 bytes = 18,000 bytes/hour = 40 bps
    event_bytes_per_sec = (event_rate_per_hour * event_payload_bytes) / 3600.0
    event_bps = event_bytes_per_sec * 8.0
    event_kbps = event_bps / 1000.0

    # Total Gartika stream
    gartika_bps = telemetry_bps + event_bps
    gartika_kbps = gartika_bps / 1000.0
    gartika_mbps = gartika_kbps / 1000.0
    
    gartika_bytes_per_sec = gartika_bps / 8.0
    gartika_bytes_per_hour = gartika_bytes_per_sec * 3600.0
    gartika_gb_per_bus_day = (gartika_bytes_per_hour * hours_per_day) / (1024.0 ** 3)
    gartika_total_fleet_gb_monthly = gartika_gb_per_bus_day * fleet_size * 30.0

    # 3. Savings Calculations
    bandwidth_reduction_pct = ((raw_stream_bps - gartika_bps) / raw_stream_bps) * 100.0
    data_saved_gb_monthly = raw_total_fleet_gb_monthly - gartika_total_fleet_gb_monthly
    cost_raw_monthly_inr = raw_total_fleet_gb_monthly * cellular_cost_per_gb_inr
    cost_gartika_monthly_inr = gartika_total_fleet_gb_monthly * cellular_cost_per_gb_inr
    cost_saved_monthly_inr = cost_raw_monthly_inr - cost_gartika_monthly_inr

    results = {
        "parameters": {
            "fleet_size": fleet_size,
            "operating_hours_per_day": hours_per_day,
            "camera_fps": fps,
            "resolution": f"{frame_width}x{frame_height}",
            "telemetry_rate_hz": telemetry_rate_hz,
            "estimated_defects_per_hour": event_rate_per_hour,
            "cellular_cost_per_gb_inr": cellular_cost_per_gb_inr
        },
        "raw_video_streaming": {
            "bitrate_kbps": round(raw_stream_kbps, 2),
            "bitrate_mbps": round(raw_stream_mbps, 3),
            "daily_data_per_bus_gb": round(raw_gb_per_bus_day, 3),
            "monthly_fleet_data_gb": round(raw_total_fleet_gb_monthly, 2),
            "monthly_fleet_cost_inr": round(cost_raw_monthly_inr, 2)
        },
        "gartika_edge_architecture": {
            "telemetry_bitrate_kbps": round(telemetry_kbps, 2),
            "event_bitrate_kbps": round(event_kbps, 4),
            "total_bitrate_kbps": round(gartika_kbps, 2),
            "daily_data_per_bus_gb": round(gartika_gb_per_bus_day, 4),
            "monthly_fleet_data_gb": round(gartika_total_fleet_gb_monthly, 2),
            "monthly_fleet_cost_inr": round(cost_gartika_monthly_inr, 2)
        },
        "comparison_and_savings": {
            "bandwidth_reduction_percent": round(bandwidth_reduction_pct, 2),
            "monthly_data_saved_gb": round(data_saved_gb_monthly, 2),
            "monthly_cost_saved_inr": round(cost_saved_monthly_inr, 2),
            "efficiency_multiplier": round(raw_stream_bps / gartika_bps, 1)
        }
    }
    return results

def print_report(res: dict):
    p = res["parameters"]
    raw = res["raw_video_streaming"]
    gar = res["gartika_edge_architecture"]
    sav = res["comparison_and_savings"]

    print("=" * 72)
    print("      GARTIKA URBAN INTELLIGENCE — BANDWIDTH & COST AUDIT REPORT      ")
    print("=" * 72)
    print(f"Fleet Size: {p['fleet_size']} Buses | Operating: {p['operating_hours_per_day']} hrs/day | Resolution: {p['resolution']} @ {p['camera_fps']} FPS")
    print(f"Cellular Data Tariff: ₹{p['cellular_cost_per_gb_inr']}/GB\n")

    print("-" * 72)
    print(f"{'Metric':<35} | {'Raw Cloud Video':<16} | {'Gartika Edge':<15}")
    print("-" * 72)
    print(f"{'Active Network Bitrate':<35} | {raw['bitrate_kbps']:>11.1f} Kbps | {gar['total_bitrate_kbps']:>10.2f} Kbps")
    print(f"{'Daily Data / Bus':<35} | {raw['daily_data_per_bus_gb']:>13.2f} GB | {gar['daily_data_per_bus_gb']:>12.4f} GB")
    print(f"{'Monthly Fleet Consumption':<35} | {raw['monthly_fleet_data_gb']:>13.1f} GB | {gar['monthly_fleet_data_gb']:>12.2f} GB")
    print(f"{'Monthly Cellular Cost':<35} | ₹{raw['monthly_fleet_cost_inr']:>14.2f} | ₹{gar['monthly_fleet_cost_inr']:>13.2f}")
    print("-" * 72)

    print("\n[KEY EFFICIENCY RESULTS]")
    print(f" * Bandwidth Reduction:     {sav['bandwidth_reduction_percent']}%")
    print(f" * Efficiency Multiplier:   {sav['efficiency_multiplier']}x reduction in transmission load")
    print(f" * Monthly Cellular Savings: ₹{sav['monthly_cost_saved_inr']:,.2f} ({sav['monthly_data_saved_gb']:,.1f} GB saved)")
    print("=" * 72)

def main():
    parser = argparse.ArgumentParser(description="Calculate bandwidth and cellular data costs for Gartika edge sensing.")
    parser.add_argument("--fleet", type=int, default=10, help="Number of operational transit buses")
    parser.add_argument("--hours", type=float, default=8.0, help="Operational hours per bus per day")
    parser.add_argument("--fps", type=int, default=15, help="Camera capture frame rate")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    args = parser.parse_args()

    results = calculate_bandwidth(
        fleet_size=args.fleet,
        hours_per_day=args.hours,
        fps=args.fps
    )

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print_report(results)

if __name__ == "__main__":
    main()
