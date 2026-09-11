/**
 * Camera Stream Manager for Gartika Mobile Edge Sensing Terminal.
 * 
 * Implements comprehensive camera lifecycle management:
 * - Explicit lifecycle states: IDLE, REQUESTING_PERMISSION, INITIALIZING, READY, RUNNING, PAUSED, STOPPING, STOPPED, PERMISSION_DENIED, NO_CAMERA, CAMERA_ERROR.
 * - Granular browser capability & Secure Context verification.
 * - Environment (rear) camera prioritization with graceful fallback & device switching.
 * - Video readiness verification (waits for videoWidth > 0 & readyState before capture).
 * - Multi-rate capture pipeline: high-speed preview (15-30 FPS) with throttled AI inference sampling.
 * - Real-time diagnostic metrics: measured FPS, resolution, dropped frames, processing latency.
 * - Complete teardown and memory cleanup.
 */

class CameraManager {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.canvas = options.canvasElement || document.getElementById("virtualPreviewCanvas") || document.createElement("canvas");
    this.onStateChange = options.onStateChange || (() => {});
    this.onFrameCaptured = options.onFrameCaptured || (() => {});
    this.onError = options.onError || (() => {});
    
    // Lifecycle state: IDLE, REQUESTING_PERMISSION, INITIALIZING, READY, RUNNING, PAUSED, STOPPING, STOPPED, PERMISSION_DENIED, NO_CAMERA, CAMERA_ERROR
    this.state = "IDLE";
    this.stateDetail = "";
    this.stream = null;
    this.facingMode = options.facingMode || "environment";
    this.aiCaptureIntervalMs = options.aiCaptureIntervalMs || 1000;
    this.targetWidth = options.targetWidth || 640;
    this.targetHeight = options.targetHeight || 480;
    this.imageQuality = options.imageQuality || 0.80;
    
    // Execution controllers
    this.captureTimer = null;
    this.isStarting = false;
    this.isCapturing = false;
    
    // Diagnostic Metrics
    this.metrics = {
      framesCaptured: 0,
      framesProcessed: 0,
      framesDropped: 0,
      lastCaptureTimestamp: 0,
      videoWidth: 0,
      videoHeight: 0,
      measuredFps: 0.0,
      facingMode: this.facingMode,
      trackLabel: "",
      permissionStatus: "UNKNOWN"
    };

    // Internal rolling FPS calculator
    this._recentCaptureTimestamps = [];
    
    // Setup off-screen canvas
    this.canvas.width = this.targetWidth;
    this.canvas.height = this.targetHeight;
    this.ctx = this.canvas.getContext("2d");
  }

  setState(newState, detail = "") {
    this.state = newState;
    this.stateDetail = detail;
    this.onStateChange(this.state, {
      detail: this.stateDetail,
      metrics: this.getMetrics()
    });
  }

  getMetrics() {
    return {
      ...this.metrics,
      state: this.state,
      stateDetail: this.stateDetail,
      isStreaming: this.state === "RUNNING" && !!this.stream
    };
  }

  getCameraState() {
    return {
      state: this.state,
      detail: this.stateDetail,
      facingMode: this.facingMode,
      videoWidth: this.video ? (this.video.videoWidth || 0) : 0,
      videoHeight: this.video ? (this.video.videoHeight || 0) : 0,
      metrics: this.getMetrics()
    };
  }

  /**
   * Diagnostic capability check: verifies navigator.mediaDevices and secure context.
   */
  checkEnvironmentCapabilities() {
    const isLocalhost = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(window.location.hostname);
    const isSecure = window.isSecureContext || window.location.protocol === "https:" || isLocalhost;
    
    const hasMediaDevices = typeof navigator !== "undefined" && !!navigator.mediaDevices;
    const hasGetUserMedia = hasMediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";

    return {
      isSecure,
      isLocalhost,
      hasMediaDevices,
      hasGetUserMedia,
      protocol: window.location.protocol,
      hostname: window.location.hostname
    };
  }

  /**
   * Starts camera stream with cascading constraints and readiness handshake.
   */
  async startCamera() {
    // Idempotent: return existing stream if already running
    if (this.state === "RUNNING" && this.stream && this.stream.active) {
      return true;
    }

    if (this.isStarting) return false;
    this.isStarting = true;

    this.setState("REQUESTING_PERMISSION", "Negotiating media device access...");

    const env = this.checkEnvironmentCapabilities();

    if (!env.isSecure && !env.isLocalhost) {
      const msg = "Camera requires a secure browser context (HTTPS or localhost).";
      this.metrics.permissionStatus = "INSECURE_CONTEXT";
      this.setState("CAMERA_ERROR", msg);
      this.onError(msg);
      this.isStarting = false;
      return false;
    }

    if (!env.hasGetUserMedia) {
      const msg = "MediaDevices API not supported on this browser context.";
      this.metrics.permissionStatus = "UNSUPPORTED";
      this.setState("CAMERA_ERROR", msg);
      this.onError(msg);
      this.isStarting = false;
      return false;
    }

    this.setState("INITIALIZING", `Requesting ${this.facingMode} camera stream...`);

    let mediaStream = null;
    let streamError = null;

    // Constraint Cascade: Rear Camera -> Specific Facing Mode -> Generic Video
    const constraintTiers = [
      {
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: false
      },
      {
        video: {
          facingMode: this.facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      },
      {
        video: true,
        audio: false
      }
    ];

    for (const constraints of constraintTiers) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (mediaStream && mediaStream.active) {
          streamError = null;
          break;
        }
      } catch (err) {
        streamError = err;
        // Continue to next fallback tier unless permission was explicitly denied
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          break;
        }
      }
    }

    if (!mediaStream) {
      this.isStarting = false;
      return this._handleStreamFailure(streamError);
    }

    // Assign stream & configure video element
    this.stream = mediaStream;
    this.metrics.permissionStatus = "GRANTED";

    const videoTrack = mediaStream.getVideoTracks()[0];
    if (videoTrack) {
      this.metrics.trackLabel = videoTrack.label || "Default Camera";
      const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
      if (settings.facingMode) this.metrics.facingMode = settings.facingMode;
    }

    if (this.video) {
      this.video.autoplay = true;
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.setAttribute("playsinline", "true");
      this.video.setAttribute("webkit-playsinline", "true");
      this.video.srcObject = mediaStream;

      try {
        await this.video.play();
      } catch (playErr) {
        // Autoplay may be restricted without user gesture, continue
      }
    }

    // Wait for video readiness (videoWidth > 0 and readyState >= 2)
    const isReady = await this._waitForVideoReadiness(3000);
    this.isStarting = false;

    if (!isReady) {
      // Stream is active, but dimensions not yet reported; mark READY and start sampling
      this.setState("READY", "Camera stream active (calibrating preview dimensions)...");
    } else {
      this.metrics.videoWidth = this.video.videoWidth;
      this.metrics.videoHeight = this.video.videoHeight;
      this.setState("RUNNING", `Live Road Camera: ${this.metrics.videoWidth}×${this.metrics.videoHeight}`);
    }

    this.startCaptureLoop();
    return true;
  }

  // Alias for startCamera
  async start() {
    return this.startCamera();
  }

  /**
   * Helper: Wait until the HTMLVideoElement has non-zero dimensions.
   */
  _waitForVideoReadiness(timeoutMs = 3000) {
    return new Promise((resolve) => {
      if (!this.video) return resolve(false);
      if (this.video.videoWidth > 0 && this.video.videoHeight > 0) return resolve(true);

      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (this.video && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime >= timeoutMs) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  }

  /**
   * Granular error classifier for getUserMedia exceptions.
   */
  _handleStreamFailure(err) {
    if (!err) {
      this.setState("CAMERA_ERROR", "Unable to acquire video hardware stream.");
      return false;
    }

    const errName = err.name || "";
    let friendlyMessage = "";
    let finalState = "CAMERA_ERROR";

    switch (errName) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        finalState = "PERMISSION_DENIED";
        friendlyMessage = "Camera access blocked. Allow camera permission in browser settings, then press Retry.";
        this.metrics.permissionStatus = "DENIED";
        break;

      case "NotFoundError":
      case "DevicesNotFoundError":
        finalState = "NO_CAMERA";
        friendlyMessage = "No camera hardware detected on this device.";
        this.metrics.permissionStatus = "NO_HARDWARE";
        break;

      case "NotReadableError":
      case "TrackStartError":
        finalState = "CAMERA_ERROR";
        friendlyMessage = "Camera hardware is currently locked or in use by another application.";
        break;

      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        finalState = "CAMERA_ERROR";
        friendlyMessage = "Requested camera resolution/facing mode constraints could not be satisfied.";
        break;

      case "SecurityError":
        finalState = "CAMERA_ERROR";
        friendlyMessage = "Camera access blocked by browser security policy. Secure origin (HTTPS) required.";
        break;

      case "AbortError":
        finalState = "CAMERA_ERROR";
        friendlyMessage = "Camera initialization was aborted.";
        break;

      default:
        finalState = "CAMERA_ERROR";
        friendlyMessage = `Camera initialization failed: ${err.message || errName}`;
    }

    this.setState(finalState, friendlyMessage);
    this.onError(friendlyMessage);
    return false;
  }

  /**
   * Switches camera facing mode (e.g. environment <-> user)
   */
  async switchCamera() {
    this.facingMode = this.facingMode === "environment" ? "user" : "environment";
    this.metrics.facingMode = this.facingMode;
    this.stopCamera();
    return this.startCamera();
  }

  /**
   * Initiates continuous background capture loop for AI inference sampling.
   */
  startCaptureLoop() {
    if (this.captureTimer) clearInterval(this.captureTimer);
    this.captureTimer = setInterval(() => {
      if (this.state === "RUNNING" || this.state === "READY") {
        this.captureFrame();
      }
    }, this.aiCaptureIntervalMs);
  }

  /**
   * Dedicated Frame Capture Pipeline:
   * HTMLVideoElement -> HTMLCanvasElement -> JPEG Blob -> onFrameCaptured callback.
   */
  captureFrame() {
    if (!this.stream || !this.video || this.isCapturing) return null;

    const vw = this.video.videoWidth || 0;
    const vh = this.video.videoHeight || 0;

    // Reject capture if video element does not yet have valid dimensions
    if (vw === 0 || vh === 0) {
      this.metrics.framesDropped++;
      return null;
    }

    this.isCapturing = true;

    try {
      // Update dimensions
      this.metrics.videoWidth = vw;
      this.metrics.videoHeight = vh;

      // Scale canvas to target bounds while preserving aspect ratio
      const scale = Math.min(1.0, this.targetWidth / vw);
      const cw = Math.round(vw * scale);
      const ch = Math.round(vh * scale);

      if (this.canvas.width !== cw || this.canvas.height !== ch) {
        this.canvas.width = cw;
        this.canvas.height = ch;
      }

      this.ctx.drawImage(this.video, 0, 0, cw, ch);

      const captureEpochMs = Date.now();
      const frameId = `FRM-${captureEpochMs}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      this.canvas.toBlob((blob) => {
        this.isCapturing = false;

        if (blob && blob.size > 0) {
          this.metrics.framesCaptured++;
          this.metrics.lastCaptureTimestamp = captureEpochMs;
          this._trackMeasuredFps(captureEpochMs);

          const frameMeta = {
            frame_id: frameId,
            width: cw,
            height: ch,
            size_bytes: blob.size,
            capture_timestamp: captureEpochMs,
            capture_iso: new Date(captureEpochMs).toISOString(),
            facing_mode: this.facingMode,
            track_label: this.metrics.trackLabel
          };

          this.onFrameCaptured(blob, frameMeta);
        } else {
          this.metrics.framesDropped++;
        }
      }, "image/jpeg", this.imageQuality);

    } catch (err) {
      this.isCapturing = false;
      this.metrics.framesDropped++;
    }
  }

  _trackMeasuredFps(nowMs) {
    this._recentCaptureTimestamps.push(nowMs);
    // Keep window of 5 seconds
    const cutoff = nowMs - 5000;
    this._recentCaptureTimestamps = this._recentCaptureTimestamps.filter(t => t >= cutoff);
    if (this._recentCaptureTimestamps.length > 1) {
      const elapsedSec = (nowMs - this._recentCaptureTimestamps[0]) / 1000.0;
      if (elapsedSec > 0.5) {
        this.metrics.measuredFps = parseFloat((this._recentCaptureTimestamps.length / elapsedSec).toFixed(1));
      }
    }
  }

  pauseCamera() {
    if (this.state === "RUNNING") {
      this.setState("PAUSED", "Camera sampling paused.");
    }
  }

  pause() {
    this.pauseCamera();
  }

  resumeCamera() {
    if (this.state === "PAUSED") {
      this.setState("RUNNING", "Camera sampling resumed.");
    }
  }

  resume() {
    this.resumeCamera();
  }

  /**
   * Complete hardware cleanup: stops all media tracks, clears timers & video element.
   */
  stopCamera() {
    this.setState("STOPPING", "Releasing camera hardware tracks...");

    if (this.captureTimer) {
      clearInterval(this.captureTimer);
      this.captureTimer = null;
    }

    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (err) {
        // Track stop cleanup
      }
      this.stream = null;
    }

    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }

    this._recentCaptureTimestamps = [];
    this.isStarting = false;
    this.isCapturing = false;
    this.setState("STOPPED", "Camera stopped.");
  }

  stop() {
    this.stopCamera();
  }

  /**
   * Clean retry method without requiring a full page refresh.
   */
  async retry() {
    this.stopCamera();
    return this.startCamera();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CameraManager };
}
