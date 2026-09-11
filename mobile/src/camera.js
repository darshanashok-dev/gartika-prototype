/**
 * Camera Stream Manager for Gartika Mobile Edge.
 * 
 * Features:
 * - Explicit lifecycle states (INITIALIZING, READY, RUNNING, PAUSED, ERROR, UNAVAILABLE).
 * - Environment (rear) camera prioritization with user camera fallback.
 * - Dynamic resolution negotiation (default 640x480, max 1280x720).
 * - High-speed preview stream vs throttled AI inference capture (1.0 FPS default).
 * - Canvas frame extraction fallback for iOS WebKit & secure context checks.
 */

class CameraManager {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.onStateChange = options.onStateChange || (() => {});
    this.onFrameCaptured = options.onFrameCaptured || (() => {});
    this.onError = options.onError || (() => {});
    
    this.state = "INITIALIZING"; // INITIALIZING, READY, RUNNING, PAUSED, ERROR, UNAVAILABLE
    this.stream = null;
    this.facingMode = options.facingMode || "environment";
    this.aiCaptureIntervalMs = options.aiCaptureIntervalMs || 1000;
    this.captureTimer = null;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.framesCaptured = 0;
    this.lastFrameTime = 0;
  }

  setState(newState, detail = null) {
    this.state = newState;
    this.onStateChange(this.state, detail);
  }

  async start() {
    this.setState("INITIALIZING");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isHttp = window.location.protocol === "http:" && !["localhost", "127.0.0.1"].includes(window.location.hostname);
      const msg = isHttp
        ? "Camera stream requires HTTPS or localhost origin. Use the manual photo button or enable secure origin."
        : "MediaDevices API not supported on this browser.";
      this.setState("UNAVAILABLE", msg);
      this.onError(msg);
      return false;
    }

    try {
      let mediaStream = null;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: this.facingMode },
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 15, max: 30 }
          },
          audio: false
        });
      } catch (err1) {
        // Fallback to any available video stream
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      this.stream = mediaStream;
      if (this.video) {
        this.video.srcObject = mediaStream;
        await this.video.play().catch(() => {});
      }

      this.setState("RUNNING");
      this.startSampling();
      return true;
    } catch (err) {
      const isDenied = err.name === "NotAllowedError" || err.name === "PermissionDeniedError";
      const detail = isDenied
        ? "Camera permission was denied. Please allow camera permissions in browser site settings."
        : `Camera failed to initialize: ${err.message}`;
      this.setState(isDenied ? "ERROR" : "UNAVAILABLE", detail);
      this.onError(detail);
      return false;
    }
  }

  startSampling() {
    if (this.captureTimer) clearInterval(this.captureTimer);
    this.captureTimer = setInterval(() => {
      if (this.state === "RUNNING") {
        this.captureFrame();
      }
    }, this.aiCaptureIntervalMs);
  }

  captureFrame(quality = 0.80) {
    if (!this.stream || !this.video) return null;
    const vw = this.video.videoWidth || 640;
    const vh = this.video.videoHeight || 480;
    if (vw === 0 || vh === 0) return null;

    this.canvas.width = Math.min(640, vw);
    this.canvas.height = Math.round((this.canvas.width / vw) * vh);
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

    this.canvas.toBlob((blob) => {
      if (blob) {
        this.framesCaptured++;
        this.lastFrameTime = Date.now();
        this.onFrameCaptured(blob, {
          width: this.canvas.width,
          height: this.canvas.height,
          timestamp: this.lastFrameTime
        });
      }
    }, "image/jpeg", quality);
  }

  pause() {
    if (this.state === "RUNNING") {
      this.setState("PAUSED");
    }
  }

  resume() {
    if (this.state === "PAUSED") {
      this.setState("RUNNING");
    }
  }

  stop() {
    if (this.captureTimer) {
      clearInterval(this.captureTimer);
      this.captureTimer = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.setState("READY");
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CameraManager };
}
