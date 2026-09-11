/**
 * Leaflet GIS Map Manager for Gartika Command Center.
 */

class MapManager {
  constructor(mapContainerId = "gisMap", initialCenter = [12.971598, 77.594562], initialZoom = 14) {
    this.mapContainerId = mapContainerId;
    this.initialCenter = initialCenter;
    this.initialZoom = initialZoom;
    this.map = null;
    this.busMarkers = {};
    this.busTrails = {};
    this.busPolylines = {};
    this.eventMarkers = {};
    this.isFirstLock = true;
    this.init();
  }

  init() {
    try {
      this.map = L.map(this.mapContainerId, {
        center: this.initialCenter,
        zoom: this.initialZoom,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        subdomains: "abc",
      }).addTo(this.map);

      const coordsBar = document.getElementById("mapCursorCoords");
      if (coordsBar) {
        this.map.on("mousemove", (e) => {
          coordsBar.innerText = `Lat: ${e.latlng.lat.toFixed(5)}° N | Lon: ${e.latlng.lng.toFixed(5)}° E`;
        });
      }
    } catch (e) {
      console.error("[MAP] Initialization error:", e);
    }
  }

  updateBusLocation(busId, lat, lon, speed = 0) {
    if (!this.map || lat === null || lon === null) return;
    const pos = [lat, lon];
    busId = (busId || "BUS-101").toUpperCase();

    if (!this.busMarkers[busId]) {
      const icon = L.divIcon({
        className: "custom-bus-icon",
        html: `<div class="marker-bus-pulse"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const marker = L.marker(pos, { icon }).addTo(this.map);
      marker.bindPopup(`<strong>${busId}</strong><br>Speed: ${speed.toFixed(1)} km/h`);
      this.busMarkers[busId] = marker;

      this.busTrails[busId] = [pos];
      this.busPolylines[busId] = L.polyline(this.busTrails[busId], {
        color: "#3b82f6",
        weight: 4,
        opacity: 0.85
      }).addTo(this.map);

      if (this.isFirstLock) {
        this.map.setView(pos, 16);
        this.isFirstLock = false;
      }
    } else {
      this.busMarkers[busId].setLatLng(pos);
      this.busTrails[busId].push(pos);
      if (this.busTrails[busId].length > 60) this.busTrails[busId].shift();
      this.busPolylines[busId].setLatLngs(this.busTrails[busId]);
    }
  }

  centerOnBus(busId = "BUS-101") {
    busId = busId.toUpperCase();
    const marker = this.busMarkers[busId] || Object.values(this.busMarkers)[0];
    if (marker && this.map) {
      this.map.setView(marker.getLatLng(), 16);
      return true;
    }
    return false;
  }

  fitBounds(allCoordinates = []) {
    if (!this.map) return;
    const coords = [...allCoordinates];
    Object.values(this.busMarkers).forEach((m) => coords.push(m.getLatLng()));
    if (coords.length > 0) {
      this.map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MapManager };
}
