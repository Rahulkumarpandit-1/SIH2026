/**
 * dataProvenance.js - Incident Status & Data Provenance Utility
 * SIH26162 - Thermal Industrial Fire Intelligence Platform
 *
 * Classifies any incident/cluster record into one of four transparency tiers:
 *   LIVE       - Real NASA FIRMS near-real-time data, freshness <= 60 min
 *   RECENT     - Real satellite data, last detection within last 24 hours
 *   HISTORICAL - Real satellite data, older than 24 hours
 *   DEMO       - Seeded fallback dataset, not from live NASA FIRMS ingestion
 *
 * DEMO is always evaluated first. A DEMO record is NEVER shown as LIVE.
 * No backend engines are called or modified by this module.
 */

export const DATA_STATUS_CONFIG = {
  LIVE: {
    label: 'LIVE',
    shortLabel: 'LIVE',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    cssClass: 'dsb-live',
    ringStyle: 'live',
    source: 'NASA FIRMS VIIRS (NRT)',
    description: 'Near real-time satellite detection observed within the last 24 hours.',
  },
  RECENT: {
    label: 'RECENT',
    shortLabel: 'RECENT',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
    cssClass: 'dsb-recent',
    ringStyle: 'recent',
    source: 'NASA FIRMS Satellite Observation',
    description: 'Operationally relevant satellite detection observed between 24 hours and 7 days ago.',
  },
  HISTORICAL: {
    label: 'HISTORICAL',
    shortLabel: 'HIST',
    color: '#6B7280',
    bgColor: 'rgba(107, 114, 128, 0.10)',
    borderColor: 'rgba(107, 114, 128, 0.35)',
    cssClass: 'dsb-historical',
    ringStyle: 'historical',
    source: 'NASA FIRMS Historical Archive',
    description: 'Historical satellite observation older than 7 days.',
  },
  DEMO: {
    label: '⚠ DEMO DATA',
    shortLabel: 'DEMO',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    cssClass: 'dsb-demo',
    ringStyle: 'demo',
    source: 'Seeded Fallback Dataset',
    description: 'Demonstration data seeded for visualization and testing. Not from live satellite intelligence.',
  },
};

export function _isDemo(record) {
  if (!record) return false;
  if (record._isDemo === true) return true;
  const cid = String(record.cluster_id ?? '');
  const SEEDED_PREFIXES = ['CLUSTER_MAH_', 'CLUSTER_SOU_', 'CLUSTER_EAST_', 'CLUSTER_NCR_'];
  if (SEEDED_PREFIXES.some((p) => cid.startsWith(p))) return true;
  const uuid = String(record.incident_uuid ?? '');
  if (/^INC-[A-Z]+-[A-Z]+-\d{4}-\d+$/.test(uuid)) return true;
  const obsId = record.id ?? record.observation_id ?? null;
  if (obsId !== null && typeof obsId === 'number' && obsId >= 100 && obsId <= 599) {
    if (!record.satellite && !record.instrument && record.state !== 'Gujarat') return true;
  }
  return false;
}

/**
 * Derives the exact ISO timestamp of the latest satellite observation for an incident or cluster.
 */
export function getRecordLastDetectedTimestamp(record) {
  if (!record) return null;
  if (record.last_detected) return record.last_detected;
  if (record.telemetry?.last_detected) return record.telemetry.last_detected;
  if (record.acq_date) {
    const timeStr = record.acq_time
      ? `${String(record.acq_time).padStart(4, '0').slice(0, 2)}:${String(record.acq_time).padStart(4, '0').slice(2, 4)}:00`
      : '00:00:00';
    return `${record.acq_date}T${timeStr}Z`;
  }
  return null;
}

/**
 * Classifies any incident into exactly one category:
 * 1. DEMO: Seeded or fallback records
 * 2. LIVE: Last detection <= 24 hours
 * 3. RECENT: Last detection > 24 hours and <= 7 days (168 hours)
 * 4. HISTORICAL: Last detection > 7 days (168 hours)
 *
 * An incident older than 24 hours is NEVER classified as LIVE.
 */
export function getDataStatus(record) {
  if (!record) {
    return { status: 'HISTORICAL', config: DATA_STATUS_CONFIG.HISTORICAL, source: DATA_STATUS_CONFIG.HISTORICAL.source };
  }

  if (_isDemo(record)) {
    return { status: 'DEMO', config: DATA_STATUS_CONFIG.DEMO, source: DATA_STATUS_CONFIG.DEMO.source };
  }

  const streamType = record.stream_type ?? record.telemetry?.stream_type ?? null;
  const lastDetectedStr = getRecordLastDetectedTimestamp(record);

  if (!lastDetectedStr) {
    return { status: 'HISTORICAL', config: DATA_STATUS_CONFIG.HISTORICAL, source: getStreamLabel(streamType, false) };
  }

  const lastMs = new Date(lastDetectedStr).getTime();
  if (isNaN(lastMs)) {
    return { status: 'HISTORICAL', config: DATA_STATUS_CONFIG.HISTORICAL, source: getStreamLabel(streamType, false) };
  }

  const diffHours = (Date.now() - lastMs) / 3600000;

  // Strict 24-hour limit for LIVE
  if (diffHours >= 0 && diffHours <= 24) {
    return {
      status: 'LIVE',
      config: DATA_STATUS_CONFIG.LIVE,
      source: 'NASA FIRMS VIIRS (NRT)',
      diffHours,
    };
  }

  // Operationally relevant window (24 hours to 7 days)
  if (diffHours > 24 && diffHours <= 168) {
    return {
      status: 'RECENT',
      config: DATA_STATUS_CONFIG.RECENT,
      source: getStreamLabel(streamType, false),
      diffHours,
    };
  }

  // Archived intelligence (> 7 days)
  return {
    status: 'HISTORICAL',
    config: DATA_STATUS_CONFIG.HISTORICAL,
    source: getStreamLabel(streamType, false),
    diffHours,
  };
}

export function getStreamLabel(streamType, isDemo) {
  if (isDemo) return 'Seeded Fallback Dataset';
  if (streamType === 'near_real_time') return 'NASA FIRMS VIIRS (NRT Archive)';
  if (streamType === 'historical') return 'NASA FIRMS Historical Archive';
  if (streamType === 'modis') return 'NASA FIRMS MODIS Archive';
  if (streamType) return `NASA FIRMS (${streamType})`;
  return 'NASA FIRMS Satellite Archive';
}

export function getFreshnessLabel(minutes) {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return 'UNKNOWN';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m ago` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h ago` : `${days} day${days !== 1 ? 's' : ''} ago`;
}

export function computeFreshnessMinutes(lastDetectedStr) {
  if (!lastDetectedStr) return null;
  try {
    const lastMs = new Date(lastDetectedStr).getTime();
    if (isNaN(lastMs)) return null;
    return Math.max(0, (Date.now() - lastMs) / 60000);
  } catch {
    return null;
  }
}

/**
 * Derives completely self-consistent temporal metrics for any record.
 * Eliminates any contradictions between "Freshness minutes" and "Last detected age".
 */
export function deriveConsistentTemporalMetrics(record) {
  const lastDetectedStr = getRecordLastDetectedTimestamp(record);
  const { status, config, source } = getDataStatus(record);

  if (!lastDetectedStr) {
    return {
      lastDetectedStr: null,
      freshnessMinutes: null,
      freshnessLabel: 'UNKNOWN',
      diffHours: null,
      diffDays: null,
      status,
      config,
      source,
      isLive: false,
    };
  }

  const lastMs = new Date(lastDetectedStr).getTime();
  if (isNaN(lastMs)) {
    return {
      lastDetectedStr,
      freshnessMinutes: null,
      freshnessLabel: 'UNKNOWN',
      diffHours: null,
      diffDays: null,
      status,
      config,
      source,
      isLive: false,
    };
  }

  const freshnessMinutes = Math.max(0, (Date.now() - lastMs) / 60000);
  const diffHours = freshnessMinutes / 60;
  const diffDays = diffHours / 24;

  return {
    lastDetectedStr,
    freshnessMinutes,
    freshnessLabel: getFreshnessLabel(freshnessMinutes),
    diffHours,
    diffDays,
    status,
    config,
    source,
    isLive: status === 'LIVE',
  };
}