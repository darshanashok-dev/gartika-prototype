/**
 * Toast Notification Manager for Gartika Dashboard.
 */

class ToastManager {
  constructor(containerId = "toastContainer") {
    this.container = document.getElementById(containerId);
  }

  show(message, type = "info", durationMs = 3000) {
    if (!this.container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 250);
    }, durationMs);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ToastManager };
}
