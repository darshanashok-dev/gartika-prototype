/**
 * GPS Geolocation Tracking Manager for Gartika Mobile Edge.
 */

class GpsSensorManager {
  constructor(onLocationUpdate = () => {}, onError = () => {}) {
    this.onLocationUpdate = onLocationUpdate;
    this.onError = onError;
    this.watchId = null;
    this.currentPosition = null;
  }

  start() {
    if (!("geolocation" in navigator)) {
      this.onError("Geolocation not supported on this device/browser");
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const speedKmH = (pos.coords.speed !== null && pos.coords.speed !== undefined)
          ? pos.coords.speed * 3.6
          : 0.0;

        this.currentPosition = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 5.0,
          speed: speedKmH,
          heading: pos.coords.heading || null,
          timestamp: new Date().toISOString()
        };
        this.onLocationUpdate(this.currentPosition);
      },
      (err) => {
        this.onError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { GpsSensorManager };
}
