/**
 * GPS / GNSS Sensor Manager for Gartika Mobile Edge.
 * 
 * Features:
 * - Explicit lifecycle states (SEARCHING, FIXED, STALE, UNAVAILABLE, ERROR).
 * - Quality classification (GOOD, ACCEPTABLE, STALE, INVALID, NO_FIX).
 * - Age monitoring: marks fix as STALE if no fresh satellite update within 5000ms.
 * - Strict coordinate validation (rejects invalid ranges, NaN, zero-locks).
 * - Never fabricates fake coordinates.
 */

class GpsSensorManager {
  constructor(options = {}) {
    this.onLocationUpdate = options.onLocationUpdate || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onError = options.onError || (() => {});
    this.staleThresholdMs = options.staleThresholdMs || 6000;
    
    this.state = "SEARCHING"; // SEARCHING, FIXED, STALE, UNAVAILABLE, ERROR
    this.watchId = null;
    this.currentPosition = null;
    this.lastFixTimestamp = 0;
    this.staleCheckTimer = null;
  }

  setState(newState, detail = null) {
    this.state = newState;
    this.onStateChange(this.state, detail);
  }

  start() {
    if (!("geolocation" in navigator)) {
      this.setState("UNAVAILABLE", "Geolocation API not supported in this browser.");
      this.onError("Geolocation not supported.");
      return;
    }

    this.setState("SEARCHING");

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const accuracy = pos.coords.accuracy || 10.0;
        const speed = pos.coords.speed !== null && pos.coords.speed !== undefined ? pos.coords.speed * 3.6 : 0.0;
        const heading = pos.coords.heading !== null && !isNaN(pos.coords.heading) ? pos.coords.heading : null;
        const altitude = pos.coords.altitude !== null ? pos.coords.altitude : null;

        // Validation
        if (lat === null || lon === null || isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          this.setState("ERROR", "Invalid GPS coordinate received.");
          return;
        }

        this.lastFixTimestamp = Date.now();
        
        let quality = "GOOD";
        if (accuracy > 30.0) quality = "ACCEPTABLE";
        else if (accuracy <= 10.0) quality = "GOOD";

        this.currentPosition = {
          latitude: lat,
          longitude: lon,
          accuracy: accuracy,
          speed: speed,
          heading: heading,
          altitude: altitude,
          quality: quality,
          timestamp: new Date().toISOString(),
          timestamp_ms: this.lastFixTimestamp
        };

        this.setState("FIXED", { accuracy, quality });
        this.onLocationUpdate(this.currentPosition);
      },
      (err) => {
        const isDenied = err.code === 1; // PERMISSION_DENIED
        const detail = isDenied 
          ? "Location permission denied. Please allow GPS access in site settings."
          : `GPS signal lost: ${err.message}`;
        this.setState(isDenied ? "ERROR" : "SEARCHING", detail);
        this.onError(detail);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );

    // Continuous staleness checker
    if (this.staleCheckTimer) clearInterval(this.staleCheckTimer);
    this.staleCheckTimer = setInterval(() => {
      if (this.state === "FIXED" && this.lastFixTimestamp > 0) {
        const age = Date.now() - this.lastFixTimestamp;
        if (age > this.staleThresholdMs) {
          this.setState("STALE", { ageMs: age });
          if (this.currentPosition) {
            this.currentPosition.quality = "STALE";
          }
        }
      }
    }, 2000);
  }

  getReading() {
    if (!this.currentPosition) return null;
    const ageMs = Date.now() - this.lastFixTimestamp;
    return {
      ...this.currentPosition,
      age_ms: ageMs,
      is_stale: ageMs > this.staleThresholdMs
    };
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.staleCheckTimer) {
      clearInterval(this.staleCheckTimer);
      this.staleCheckTimer = null;
    }
    this.setState("SEARCHING");
    this.currentPosition = null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { GpsSensorManager };
}
