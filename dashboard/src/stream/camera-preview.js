/**
 * Gartika Dashboard - Camera Stream Preview Module
 * Handles live preview canvas rendering, FPS counter, and detection overlay.
 */

export class CameraPreviewManager {
  constructor(options = {}) {
    this.canvas = options.canvas || document.getElementById('cameraStreamCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.fpsElement = options.fpsElement || document.getElementById('streamFps');
    this.busSelectElement = options.busSelectElement || document.getElementById('cameraBusSelector');
    this.statusBadge = options.statusBadge || document.getElementById('streamStatusBadge');
    
    this.activeBusId = 'BUS-101';
    this.frameCount = 0;
    this.lastFpsCalcTime = Date.now();
    this.currentFps = 0;
    this.imgElement = new Image();
    this.lastFrameTime = 0;
    this.streamActive = false;

    this.init();
  }

  init() {
    if (this.busSelectElement) {
      this.busSelectElement.addEventListener('change', (e) => {
        this.activeBusId = e.target.value;
      });
    }

    // Set fallback canvas background
    this.drawFallback();
  }

  drawFallback(message = 'Awaiting Camera Stream...') {
    if (!this.ctx || !this.canvas) return;
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#64748b';
    this.ctx.font = '13px JetBrains Mono, monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
  }

  updateFrame(busId, base64Jpeg, detections = []) {
    if (this.activeBusId && busId !== this.activeBusId && this.busSelectElement) {
      // If we don't have multiple options or user hasn't selected specifically, track active bus
      if (this.busSelectElement.options.length <= 1) {
        this.activeBusId = busId;
      }
    }

    if (busId !== this.activeBusId) return;

    this.streamActive = true;
    if (this.statusBadge) {
      this.statusBadge.textContent = 'Live Feed';
      this.statusBadge.className = 'badge badge-green';
    }

    const img = new Image();
    img.onload = () => {
      if (!this.ctx || !this.canvas) return;
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);

      // Render detection bounding boxes if provided
      if (Array.isArray(detections)) {
        detections.forEach(det => {
          this.drawDetection(det);
        });
      }

      this.updateFps();
    };

    if (base64Jpeg.startsWith('data:image')) {
      img.src = base64Jpeg;
    } else {
      img.src = `data:image/jpeg;base64,${base64Jpeg}`;
    }
  }

  drawDetection(det) {
    if (!this.ctx || !det.bbox) return;
    const [x1, y1, x2, y2] = det.bbox;
    const width = x2 - x1;
    const height = y2 - y1;

    // Scale to canvas dimensions if needed
    this.ctx.strokeStyle = det.class_name === 'pothole' ? '#ef4444' : '#3b82f6';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x1, y1, width, height);

    // Label tag
    const label = `${det.class_name || 'defect'} ${(det.confidence * 100).toFixed(0)}%`;
    this.ctx.fillStyle = det.class_name === 'pothole' ? 'rgba(239, 68, 68, 0.85)' : 'rgba(59, 130, 246, 0.85)';
    this.ctx.fillRect(x1, Math.max(0, y1 - 18), label.length * 8 + 8, 18);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '10px JetBrains Mono, monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(label, x1 + 4, Math.max(12, y1 - 4));
  }

  updateFps() {
    this.frameCount++;
    const now = Date.now();
    const elapsed = now - this.lastFpsCalcTime;
    if (elapsed >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsCalcTime = now;
      if (this.fpsElement) {
        this.fpsElement.textContent = `${this.currentFps} FPS`;
      }
    }
  }

  setAvailableBuses(busIds) {
    if (!this.busSelectElement || !Array.isArray(busIds)) return;
    const current = this.busSelectElement.value;
    this.busSelectElement.innerHTML = busIds.map(id => `<option value="${id}">${id}</option>`).join('');
    if (busIds.includes(current)) {
      this.busSelectElement.value = current;
    } else if (busIds.length > 0) {
      this.busSelectElement.value = busIds[0];
      this.activeBusId = busIds[0];
    }
  }
}
