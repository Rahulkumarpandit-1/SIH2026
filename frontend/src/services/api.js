import axios from 'axios';

/**
 * Resolves the API Base URL deterministically:
 * 1. If VITE_API_BASE_URL environment variable is provided, use it.
 * 2. In production (PROD mode) without VITE_API_BASE_URL, default to relative path '' (assumes reverse proxy or co-hosted API).
 * 3. In development (DEV mode), default to http://127.0.0.1:8000.
 */
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL !== undefined && import.meta.env.VITE_API_BASE_URL !== '') {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // Default to relative path to leverage Vite proxy in dev and unified hosting in prod
  return '';
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-fallback retry: if relative proxy fails, retry directly against FastAPI port 8000
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (originalRequest && !originalRequest._retry && (!originalRequest.baseURL || originalRequest.baseURL === '')) {
      originalRequest._retry = true;
      originalRequest.baseURL = 'http://127.0.0.1:8000';
      return apiClient(originalRequest);
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  getHealth: async () => {
    const response = await apiClient.get('/api/health');
    return response.data;
  },

  getSummary: async () => {
    const response = await apiClient.get('/api/summary');
    return response.data;
  },

  getObservations: async () => {
    const response = await apiClient.get('/api/observations');
    return response.data;
  },

  getClusters: async () => {
    const response = await apiClient.get('/api/clusters');
    return response.data;
  },

  getRisk: async () => {
    const response = await apiClient.get('/api/risk');
    return response.data;
  },

  getGeoJSON: async () => {
    const response = await apiClient.get('/api/geojson');
    return response.data;
  },

  getIndustrialPolygons: async () => {
    const response = await apiClient.get('/api/osm-industrial');
    return response.data;
  },

  getMLEvaluation: async () => {
    const response = await apiClient.get('/api/ml-evaluation');
    return response.data;
  },

  getMLStatus: async () => {
    const response = await apiClient.get('/api/ml/status');
    return response.data;
  },

  predictML: async (payload) => {
    const response = await apiClient.post('/api/ml/predict', payload);
    return response.data;
  },

  getDataset: async () => {
    const response = await apiClient.get('/api/dataset');
    return response.data;
  },

  getDatasetQuality: async () => {
    const response = await apiClient.get('/api/dataset/quality');
    return response.data;
  },

  getDatasetProvenance: async () => {
    const response = await apiClient.get('/api/dataset/provenance');
    return response.data;
  },

  getGroundTruth: async () => {
    const response = await apiClient.get('/api/ground-truth');
    return response.data;
  },

  submitGroundTruthReview: async (payload) => {
    const response = await apiClient.post('/api/ground-truth/review', payload);
    return response.data;
  },

  getGroundTruthQuality: async () => {
    const response = await apiClient.get('/api/ground-truth/quality');
    return response.data;
  },

  refreshData: async (payload = {}) => {
    const response = await apiClient.post('/api/data/refresh', payload);
    return response.data;
  },
};

export default apiService;
