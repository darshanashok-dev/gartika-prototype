/**
 * IMU / 3-Axis Accelerometer Sensor Manager for Gartika Mobile Edge.
 * 
 * Features:
 * - Explicit lifecycle states (INITIALIZING, ACTIVE, PAUSED, UNAVAILABLE, ERROR).
 * - Calibrated baseline gravity tracking (removes mounting tilt bias).
 * - Mechanical road bump / pothole shock detection (|a_z - g| > 3.2 m/s²).
 * - Vibration level classification (NORMAL, MEDIUM, HIGH).
 * - iOS DeviceMotionEvent permission handshake support.
 */

class ImuSensorManager {
  constructor(options = {}) {
    this.onReading = options.onReading || (() => {});
    this.onShockDetected = options.onShockDetected || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onError = options.onError || (() => {});
    
    this.state = "INITIALIZING"; // INITIALIZING, ACTIVE, PAUSED, UNAVAILABLE, ERROR
    this.baselineGravity = 9.81;
    this.lastReading = {
      ax: 0.0, ay: 0.0, az: 9.81,
      gravity_compensated_z: 0.0,
      shock_score: 0.0,
      vibration_level: "NORMAL",
      timestamp_ms: 0
    };
    this.sampleCount = 0;
    this.listener = this.handleDeviceMotion.bind(this);
  }

  setState(newState, detail = null) {
    this.state = newState;
    this.onStateChange(this.state, detail);
  }

  async requestPermission() {
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        return response === "granted";
      } catch (err) {
        return false;
      }
    }
    return true; // Non-iOS platforms allow by default
  }

  async start() {
    this.setState("INITIALIZING");

    if (!window.DeviceMotionEvent) {
      this.setState("UNAVAILABLE", "DeviceMotionEvent not supported on this browser.");
      return false;
    }

    const permitted = await this.requestPermission();
    if (!permitted) {
      this.setState("ERROR", "Motion & Orientation sensor permission denied.");
      this.onError("Motion permission denied.");
      return false;
    }

    try {
      window.addEventListener("devicemotion", this.listener, false);
      this.setState("ACTIVE");
      return true;
    } catch (err) {
      this.setState("ERROR", err.message);
      return false;
    }
  }

  handleDeviceMotion(e) {
    if (!e.accelerationIncludingGravity) return;

    const rawAx = e.accelerationIncludingGravity.x || 0.0;
    const rawAy = e.accelerationIncludingGravity.y || 0.0;
    const rawAz = e.accelerationIncludingGravity.z !== null ? e.accelerationIncludingGravity.z : 9.81;

    // Running calibration of baseline gravity (decaying average over static samples)
    if (this.sampleCount < 100) {
      this.baselineGravity = this.baselineGravity * 0.90 + rawAz * 0.10;
    } else {
      this.baselineGravity = this.baselineGravity * 0.98 + rawAz * 0.02;
    }
    this.sampleCount++;

    const deltaZ = Math.abs(rawAz - this.baselineGravity);
    let vibLevel = "NORMAL";
    if (deltaZ > 4.5 || rawAz > 15.0) vibLevel = "HIGH";
    else if (deltaZ > 2.2 || rawAz > 12.0) vibLevel = "MEDIUM";

    const shockScore = Math.min(1.0, parseFloat((deltaZ / 8.0).toFixed(3)));
    const nowMs = Date.now();

    this.lastReading = {
      ax: parseFloat(rawAx.toFixed(2)),
      ay: parseFloat(rawAy.toFixed(2)),
      az: parseFloat(rawAz.toFixed(2)),
      baseline_g: parseFloat(this.baselineGravity.toFixed(2)),
      gravity_compensated_z: parseFloat(deltaZ.toFixed(2)),
      shock_score: shockScore,
      vibration_level: vibLevel,
      timestamp_ms: nowMs
    };

    this.onReading(this.lastReading);

    // Trigger instant shock callback if threshold exceeded
    if (deltaZ > 3.2 || rawAz > 13.5) {
      this.onShockDetected(this.lastReading);
    }
  }

  getReading() {
    const ageMs = Date.now() - this.lastReading.timestamp_ms;
    return {
      ...this.lastReading,
      age_ms: ageMs,
      is_stale: ageMs > 3000
    };
  }

  pause() {
    if (this.state === "ACTIVE") {
      this.setState("PAUSED");
    }
  }

  resume() {
    if (this.state === "PAUSED") {
      this.setState("ACTIVE");
    }
  }

  stop() {
    window.removeEventListener("devicemotion", this.listener, false);
    this.setState("INITIALIZING");
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ImuSensorManager };
}
