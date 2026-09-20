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

  getSummary: async (region) => {
    const params = region ? { region } : {};
    const response = await apiClient.get('/api/summary', { params });
    return ensureObject(response.data);
  },

  getObservations: async (streamType = 'all', region) => {
    const params = {};
    if (streamType && streamType !== 'all') params.stream_type = streamType;
    if (region) params.region = region;
    const response = await apiClient.get('/api/observations', { params });
    return ensureArray(response.data);
  },

  getClusters: async (region) => {
    const params = region ? { region } : {};
    const response = await apiClient.get('/api/clusters', { params });
    return ensureArray(response.data);
  },

  getRisk: async (region) => {
    const params = region ? { region } : {};
    const response = await apiClient.get('/api/risk', { params });
    return ensureArray(response.data);
  },

  getGeoJSON: async (region) => {
    const params = region ? { region } : {};
    const response = await apiClient.get('/api/geojson', { params });
    return ensureObject(response.data);
  },

  getIndustrialPolygons: async (region, bbox) => {
    const params = {};
    if (region) params.region = region;
    if (bbox) params.bbox = bbox;
    const response = await apiClient.get('/api/osm-industrial', { params });
    return ensureObject(response.data);
  },

  getRegions: async () => {
    const response = await apiClient.get('/api/regions');
    return ensureArray(response.data);
  },

  getFacilities: async (region) => {
    const params = region ? { region } : {};
    const response = await apiClient.get('/api/facilities', { params });
    return ensureArray(response.data);
  },

  getExposureAssets: async (region, category) => {
    const params = {};
    if (region) params.region = region;
    if (category) params.category = category;
    const response = await apiClient.get('/api/exposure-assets', { params });
    return ensureArray(response.data);
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

  createGroundTruthLabel: async (payload) => {
    const response = await apiClient.post('/api/ground-truth', payload);
    return response.data;
  },

  updateGroundTruthLabel: async (id, payload) => {
    const response = await apiClient.put(`/api/ground-truth/${id}`, payload);
    return response.data;
  },

  exportGroundTruthCsvUrl: () => {
    const base = apiClient.defaults.baseURL || '';
    return `${base}/api/ground-truth/export`;
  },

  getMLDatasetSummary: async () => {
    const response = await apiClient.get('/api/ml/dataset');
    return ensureObject(response.data);
  },

  getMLDatasetDownloadUrl: () => {
    const base = apiClient.defaults.baseURL || '';
    return `${base}/api/ml/dataset?download=true`;
  },

  submitGroundTruthReview: async (payload) => {
    const response = await apiClient.post('/api/ground-truth/review', payload);
    return response.data;
  },

  getGroundTruthQuality: async () => {
    const response = await apiClient.get('/api/ground-truth/quality');
    return ensureObject(response.data);
  },

  getReviewAudit: async (incidentUuid = null, reviewer = null, limit = 50) => {
    const params = { limit };
    if (incidentUuid) params.incident_uuid = incidentUuid;
    if (reviewer) params.reviewer = reviewer;
    const response = await apiClient.get('/api/review-audit', { params });
    return ensureArray(response.data);
  },

  getReviewers: async () => {
    const response = await apiClient.get('/api/reviewers');
    return ensureObject(response.data);
  },

  getDatasetQuality: async () => {
    const response = await apiClient.get('/api/dataset-quality');
    return ensureObject(response.data);
  },

  getMLReadiness: async () => {
    const response = await apiClient.get('/api/ml/readiness');
    return ensureObject(response.data);
  },

  refreshData: async (payload = {}) => {
    const response = await apiClient.post('/api/data/refresh', payload);
    return response.data;
  },

  getRefreshStatus: async () => {
    const response = await apiClient.get('/api/data/refresh/status');
    return ensureObject(response.data);
  },

  getIncidents: async (params = {}) => {
    const response = await apiClient.get('/api/incidents', { params });
    return ensureArray(response.data);
  },

  getIncidentsArchive: async (params = {}) => {
    const response = await apiClient.get('/api/incidents/archive', { params });
    return ensureArray(response.data);
  },

  getIncidentByUuid: async (incidentUuid) => {
    const response = await apiClient.get(`/api/incidents/${encodeURIComponent(incidentUuid)}`);
    return ensureObject(response.data);
  },

  getIncidentTimeline: async (incidentUuid) => {
    const response = await apiClient.get(`/api/incidents/${encodeURIComponent(incidentUuid)}/timeline`);
    return ensureObject(response.data);
  },

  getFacilityHistory: async (facilityName) => {
    const response = await apiClient.get(`/api/facilities/${encodeURIComponent(facilityName)}/history`);
    return ensureObject(response.data);
  },

  updateIncidentStatus: async (incidentUuid, status) => {
    const response = await apiClient.patch(`/api/incidents/${encodeURIComponent(incidentUuid)}/status`, { status });
    return ensureObject(response.data);
  },

  getRiskAttribution: async (incidentUuid) => {
    const response = await apiClient.get(`/api/incidents/${encodeURIComponent(incidentUuid)}/risk-attribution`);
    return ensureObject(response.data);
  },

  getAbnormalityBreakdown: async (incidentUuid) => {
    const response = await apiClient.get(`/api/incidents/${encodeURIComponent(incidentUuid)}/abnormality-breakdown`);
    return ensureObject(response.data);
  },

  getSimilarIncidents: async (incidentUuid, params = {}) => {
    const response = await apiClient.get(`/api/incidents/${encodeURIComponent(incidentUuid)}/similar`, { params });
    return ensureObject(response.data);
  },

  getFacilityRiskProfile: async (facilityName) => {
    const response = await apiClient.get(`/api/facilities/${encodeURIComponent(facilityName)}/risk-profile`);
    return ensureObject(response.data);
  },

  getExecutiveSummary: async (incidentUuid) => {
    const response = await apiClient.get(`/api/incidents/${encodeURIComponent(incidentUuid)}/executive-summary`);
    return ensureObject(response.data);
  },
};

export default apiService;
