# Gartika Mobile Edge Sensing Interface

## 1. Operational Overview
The mobile interface (`/mobile`) turns any modern smartphone running Chrome or Safari into an autonomous edge sensing terminal for transit buses.

## 2. Hardware APIs Utilized
- **MediaDevices (`navigator.mediaDevices.getUserMedia`)**: Front windshield camera feed.
- **Geolocation (`navigator.geolocation.watchPosition`)**: High-accuracy GPS tracking with speed and heading calculations.
- **DeviceMotion (`window.DeviceMotionEvent`)**: 6-axis accelerometer monitoring vertical shocks ($a_z$).
- **Offline Storage Queue**: Local queue storing telemetry and photo evidence when cellular connectivity drops, automatically flushing when connection is restored.
