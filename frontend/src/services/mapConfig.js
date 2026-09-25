// High-performance, zero-watermark, 100% free map tile providers (no API key required)
export const MAP_PROVIDERS = {
  satellite: {
    id: 'satellite',
    name: 'Satellite Orbital',
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics, USDA, USGS',
    maxZoom: 18
  },
  streets: {
    id: 'streets',
    name: 'Detailed Streets',
    base: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }
};

export const getDefaultBasemap = () => 'satellite';
