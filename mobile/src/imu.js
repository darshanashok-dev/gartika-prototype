/**
 * IMU / Accelerometer Sensor Manager for Gartika Mobile Edge.
 */

class ImuSensorManager {
  constructor(onShockDetected = () => {}, onReading = () => {}) {
    this.onShockDetected = onShockDetected;
    this.onReading = onReading;
    this.isActive = false;
    this.lastReading = { ax: 0.0, ay: 0.0, az: 9.81, gx: 0.0, gy: 0.0, gz: 0.0 };
    this.listener = this.handleDeviceMotion.bind(this);
  }

  async requestPermission() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const res = await DeviceMotionEvent.requestPermission();
        return res === 'granted';
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  start() {
    if (this.isActive) return;
    window.addEventListener("devicemotion", this.listener, false);
    this.isActive = true;
  }

  stop() {
    if (!this.isActive) return;
    window.removeEventListener("devicemotion", this.listener, false);
    this.isActive = false;
  }

  handleDeviceMotion(e) {
    if (e.accelerationIncludingGravity) {
      const ax = parseFloat((e.accelerationIncludingGravity.x || 0).toFixed(2));
      const ay = parseFloat((e.accelerationIncludingGravity.y || 0).toFixed(2));
      const az = parseFloat((e.accelerationIncludingGravity.z || 9.81).toFixed(2));
      
      this.lastReading = { ax, ay, az };
      this.onReading(this.lastReading);

      // Detect severe road bump impact (> 13.5 m/s² or deviation from gravity > 3.5 m/s²)
      const deltaZ = Math.abs(az - 9.81);
      if (az > 13.5 || deltaZ > 3.5) {
        this.onShockDetected({
          ax, ay, az,
          shock_magnitude: deltaZ,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ImuSensorManager };
}
