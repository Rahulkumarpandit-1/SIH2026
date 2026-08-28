import axios from 'axios';

/**
 * Resolves the API Base URL deterministically:
 * 1. If VITE_API_BASE_URL environment variable is provided, trim trailing slash and use it.
 * 2. In development (DEV mode), default to http://127.0.0.1:8000.
 * 3. In production, fallback to relative path or default public API.
 */
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8000';
  }
  // Default to hosted Render API when running on Vercel without env var
  return 'https://sih2026-api.onrender.com';
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to ensure response is valid JSON object or array, not an HTML fallback page
const ensureArray = (data) => (Array.isArray(data) ? data : []);
const ensureObject = (data) => (data && typeof data === 'object' && !Array.isArray(data) && !data.includes?.('<!DOCTYPE') ? data : null);

export const apiService = {
  getHealth: async () => {
    const response = await apiClient.get('/api/health');
    if (typeof response.data === 'string' && response.data.includes('<!doctype')) {
      throw new Error('Received HTML instead of JSON from API');
    }
    return response.data;
  },

  getSummary: async () => {
    const response = await apiClient.get('/api/summary');
    return ensureObject(response.data);
  },

  getObservations: async () => {
    const response = await apiClient.get('/api/observations');
    return ensureArray(response.data);
  },

  getClusters: async () => {
    const response = await apiClient.get('/api/clusters');
    return ensureArray(response.data);
  },

  getRisk: async () => {
    const response = await apiClient.get('/api/risk');
    return ensureArray(response.data);
  },

  getGeoJSON: async () => {
    const response = await apiClient.get('/api/geojson');
    return ensureObject(response.data);
  },

  getIndustrialPolygons: async () => {
    const response = await apiClient.get('/api/osm-industrial');
    return ensureObject(response.data);
  },

  getMLEvaluation: async () => {
    const response = await apiClient.get('/api/ml-evaluation');
    return ensureObject(response.data);
  },

  getMLStatus: async () => {
    const response = await apiClient.get('/api/ml/status');
    return ensureObject(response.data);
  },

  predictML: async (payload) => {
    const response = await apiClient.post('/api/ml/predict', payload);
    return response.data;
  },

  getDataset: async () => {
    const response = await apiClient.get('/api/dataset');
    return ensureArray(response.data);
  },

  getDatasetQuality: async () => {
    const response = await apiClient.get('/api/dataset/quality');
    return ensureObject(response.data);
  },

  getDatasetProvenance: async () => {
    const response = await apiClient.get('/api/dataset/provenance');
    return ensureArray(response.data);
  },

  getGroundTruth: async () => {
    const response = await apiClient.get('/api/ground-truth');
    return ensureArray(response.data);
  },

  submitGroundTruthReview: async (payload) => {
    const response = await apiClient.post('/api/ground-truth/review', payload);
    return response.data;
  },

  getGroundTruthQuality: async () => {
    const response = await apiClient.get('/api/ground-truth/quality');
    return ensureObject(response.data);
  },

  refreshData: async (payload = {}) => {
    const response = await apiClient.post('/api/data/refresh', payload);
    return response.data;
  },
};

export default apiService;
