/**
 * Camera Stream Manager for Gartika Mobile Edge.
 */

class CameraManager {
  constructor(videoElement, onFrameReady = () => {}, onError = () => {}) {
    this.video = videoElement;
    this.onFrameReady = onFrameReady;
    this.onError = onError;
    this.stream = null;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.frameInterval = null;
  }

  async start() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          window.location.protocol === "http:"
            ? "Camera stream requires HTTPS on non-localhost IPs. Use the Snap Road Photo button or enable HTTPS."
            : "MediaDevices not supported in this browser"
        );
      }

      let mediaStream = null;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 }
          },
          audio: false
        });
      } catch (e1) {
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
      return true;
    } catch (err) {
      this.onError(err.message);
      return false;
    }
  }

  startFrameCapture(intervalMs = 1000) {
    if (this.frameInterval) clearInterval(this.frameInterval);
    this.frameInterval = setInterval(() => {
      this.captureFrame();
    }, intervalMs);
  }

  captureFrame() {
    if (!this.stream || !this.video || !this.video.videoWidth) return;

    const vw = this.video.videoWidth || 640;
    const vh = this.video.videoHeight || 480;
    this.canvas.width = 640;
    this.canvas.height = Math.round((640 / vw) * vh);
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

    this.canvas.toBlob((blob) => {
      if (blob) {
        this.onFrameReady(blob);
      }
    }, "image/jpeg", 0.75);
  }

  stop() {
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      if (this.video) this.video.srcObject = null;
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CameraManager };
}
