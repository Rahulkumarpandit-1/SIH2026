import React from 'react';
import { AlertOctagon, AlertTriangle, AlertCircle, Info, Archive } from 'lucide-react';
import { getDataStatus } from './dataProvenance';

/**
 * priorityEngine.js - Multi-Signal Operational Priority Engine
 * SIH26162 - Thermal Industrial Fire Intelligence Platform
 *
 * Implements strict 4-Tier Operational Priority Hierarchy:
 * Tier 1: LIVE incidents (<= 24h)           -> Score Band: [75.0, 100.0] -> P1 CRITICAL / P2 HIGH
 * Tier 2: RECENT incidents (24h - 7d)        -> Score Band: [45.0, 74.9]  -> P2 HIGH / P3 MEDIUM
 * Tier 3: HISTORICAL incidents (> 7d)        -> Score Band: [15.0, 44.9]  -> P4 LOW / ARCHIVED
 * Tier 4: DEMO incidents (Seeded fallback)   -> Score Band: [5.0, 14.9]   -> P4 LOW / DEMO
 *
 * Mathematical Guarantee:
 * Every LIVE incident (> 75) strictly outranks every RECENT incident (45 - 74.9).
 * Every RECENT incident strictly outranks every HISTORICAL incident (15 - 44.9).
 * Every HISTORICAL incident strictly outranks every DEMO incident (5 - 14.9).
 *
 * HISTORICAL incidents heavily penalize age via decay factor = 7 / age_days
 * and CAN NEVER reach Priority 1 (CRITICAL) or Priority 2 (HIGH).
 */

export const PRIORITY_CONFIG = {
  CRITICAL: {
    level: 'CRITICAL',
    label: 'CRITICAL',
    prefix: 'PRIORITY 1',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
    textColor: '#DC2626',
    icon: AlertOctagon,
    action: 'IMMEDIATE DISPATCH & EVACUATION RADIUS PROTOCOL',
    description: 'Catastrophic live thermal event exceeding baseline with critical downwind exposure.',
  },
  HIGH: {
    level: 'HIGH',
    label: 'HIGH',
    prefix: 'PRIORITY 2',
    color: '#F97316',
    bgColor: 'rgba(249, 115, 22, 0.12)',
    borderColor: 'rgba(249, 115, 22, 0.45)',
    textColor: '#EA580C',
    icon: AlertTriangle,
    action: 'PRIORITY INDUSTRIAL VERIFICATION & FOAM TENDER STANDBY',
    description: 'Significant thermal excursion near industrial boundaries requiring active intervention.',
  },
  MEDIUM: {
    level: 'MEDIUM',
    label: 'MEDIUM',
    prefix: 'PRIORITY 3',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    textColor: '#D97706',
    icon: AlertCircle,
    action: 'REGIONAL SENSOR CONFIRMATION & FACILITY INQUIRY',
    description: 'Elevated heat source requiring scheduled perimeter verification.',
  },
  LOW: {
    level: 'LOW',
    label: 'LOW',
    prefix: 'PRIORITY 4',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
    textColor: '#059669',
    icon: Info,
    action: 'ROUTINE LOGGING & PASSIVE BASELINE MONITORING',
    description: 'Thermal activity consistent with nominal historical baselines or rural biomass.',
  },
  ARCHIVE: {
    level: 'LOW',
    label: 'ARCHIVED',
    prefix: 'PRIORITY 4',
    color: '#6B7280',
    bgColor: 'rgba(107, 114, 128, 0.12)',
    borderColor: 'rgba(107, 114, 128, 0.40)',
    textColor: '#4B5563',
    icon: Archive,
    action: 'ARCHIVED TELEMETRY RECORD & HISTORICAL BASELINE',
    description: 'Historical thermal observation (>7 days old). No active emergency dispatch required.',
  },
  DEMO: {
    level: 'LOW',
    label: 'DEMO',
    prefix: 'DEMO DATA',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.40)',
    textColor: '#B45309',
    icon: Info,
    action: 'SEEDED DEMO RECORD — NOT REAL TELEMETRY',
    description: 'Demonstration record for UI testing and system illustration.',
  },
};

/**
 * Converts exposure string or asset list into a normalized 0-100 score.
 */
function normalizeExposureScore(exposure) {
  if (!exposure) return 30;
  if (typeof exposure === 'number') return Math.max(0, Math.min(100, exposure));

  const pop = String(exposure.population_exposure || '').toUpperCase();
  const inf = String(exposure.infrastructure_exposure || '').toUpperCase();
  const env = String(exposure.environmental_exposure || '').toUpperCase();

  let score = 25;
  if (pop === 'CRITICAL' || inf === 'CRITICAL') score = Math.max(score, 95);
  else if (pop === 'HIGH' || inf === 'HIGH') score = Math.max(score, 80);
  else if (pop === 'MEDIUM' || inf === 'MEDIUM') score = Math.max(score, 55);

  if (env === 'HIGH' || env === 'CRITICAL') score = Math.min(100, score + 15);
  return score;
}

/**
 * Computes deterministic operational priority with strict age penalization
 * and mathematically guaranteed tier boundaries.
 */
export function calculateOperationalPriority(incident) {
  if (!incident) {
    return {
      level: 'LOW',
      score: 10,
      tier: 'HISTORICAL',
      config: PRIORITY_CONFIG.LOW,
      breakdown: { riskScore: 0, abnormalityScore: 0, exposureScore: 0, freshnessScore: 0, ageDays: 0, decayFactor: 0 },
    };
  }

  const dataStatus = getDataStatus(incident);
  const tier = dataStatus.status; // 'LIVE' | 'RECENT' | 'HISTORICAL' | 'DEMO'

  const riskScore = Number(incident.risk_score ?? incident.subscores?.risk_score ?? 0);
  const abScore = Number(
    incident.abnormality_detection?.abnormality_score
    ?? incident.abnormality_score
    ?? incident.subscores?.abnormality_score
    ?? (incident.is_anomaly_spike ? 75 : 30)
  );
  const exposureScore = normalizeExposureScore(incident.exposure_context || incident.exposure);

  let finalScore = 15;
  let level = 'LOW';
  let configKey = 'LOW';
  let ageDays = 0;
  let decayFactor = 1.0;
  let freshnessScore = 0;

  // Resolve observation age in hours/days
  let diffHours = dataStatus.diffHours;
  if (typeof diffHours !== 'number' || isNaN(diffHours)) {
    const lastStr = incident.last_detected || incident.acq_date || incident.telemetry?.last_detected;
    if (lastStr) {
      const ms = new Date(lastStr).getTime();
      if (!isNaN(ms)) diffHours = Math.max(0, (Date.now() - ms) / 3600000);
    }
  }
  if (typeof diffHours === 'number' && !isNaN(diffHours)) {
    ageDays = Number((diffHours / 24).toFixed(1));
  }

  if (tier === 'LIVE') {
    // -------------------------------------------------------------------------
    // TIER 1: LIVE (<= 24h) — Base Range: [75.0, 100.0]
    // -------------------------------------------------------------------------
    const ageMins = (diffHours ?? 0) * 60;
    freshnessScore = Math.max(0, Math.min(100, Math.round(100 * (1 - ageMins / 1440))));
    const rawQuality = (riskScore * 0.45) + (exposureScore * 0.30) + (abScore * 0.25);
    finalScore = Number((75 + (rawQuality / 100) * 15 + (freshnessScore / 100) * 10).toFixed(1));

    if (finalScore >= 85 || riskScore >= 80) {
      level = 'CRITICAL';
      configKey = 'CRITICAL';
    } else {
      level = 'HIGH';
      configKey = 'HIGH';
    }
  } else if (tier === 'RECENT') {
    // -------------------------------------------------------------------------
    // TIER 2: RECENT (> 24h and <= 7 days) — Base Range: [45.0, 74.9]
    // -------------------------------------------------------------------------
    const dayProgress = Math.min(6, Math.max(0, ageDays - 1));
    freshnessScore = Math.max(0, Math.round(100 * (1 - dayProgress / 6)));
    const rawQuality = (riskScore * 0.50) + (exposureScore * 0.30) + (abScore * 0.20);
    finalScore = Number((45 + (rawQuality / 100) * 20 + (freshnessScore / 100) * 9.9).toFixed(1));

    if (finalScore >= 60) {
      level = 'HIGH';
      configKey = 'HIGH';
    } else {
      level = 'MEDIUM';
      configKey = 'MEDIUM';
    }
  } else if (tier === 'HISTORICAL') {
    // -------------------------------------------------------------------------
    // TIER 3: HISTORICAL (> 7 days) — Base Range: [15.0, 44.9]
    // HEAVY AGE PENALTY: decay proportional to 7 / ageDays
    // -------------------------------------------------------------------------
    const effectiveDays = Math.max(7, ageDays || 30);
    decayFactor = Number((7 / effectiveDays).toFixed(3)); // e.g. 31.9 days -> 0.219
    const rawQuality = ((riskScore * 0.60) + (exposureScore * 0.40)) * decayFactor;
    finalScore = Number((15 + Math.min(29.9, (rawQuality / 100) * 29.9)).toFixed(1));

    level = 'LOW';
    configKey = 'ARCHIVE';
  } else {
    // -------------------------------------------------------------------------
    // TIER 4: DEMO (Seeded fallback dataset) — Base Range: [5.0, 14.9]
    // -------------------------------------------------------------------------
    finalScore = Number((5 + (riskScore / 100) * 9.9).toFixed(1));
    level = 'LOW';
    configKey = 'DEMO';
  }

  return {
    level,
    score: finalScore,
    tier,
    config: PRIORITY_CONFIG[configKey] || PRIORITY_CONFIG[level] || PRIORITY_CONFIG.LOW,
    breakdown: {
      riskScore: Math.round(riskScore),
      abnormalityScore: Math.round(abScore),
      exposureScore: Math.round(exposureScore),
      freshnessScore: Math.round(freshnessScore),
      ageDays,
      decayFactor
    },
    isLive: tier === 'LIVE',
    isRecent: tier === 'RECENT',
    isHistorical: tier === 'HISTORICAL',
    isDemo: tier === 'DEMO'
  };
}

/**
 * Stable comparator for operational queues.
 * Strictly guarantees: LIVE > RECENT > HISTORICAL > DEMO
 */
export function compareOperationalPriority(a, b) {
  const opA = calculateOperationalPriority(a);
  const opB = calculateOperationalPriority(b);

  if (opB.score !== opA.score) {
    return opB.score - opA.score;
  }

  // Tiebreak by risk_score
  const riskA = Number(a.risk_score ?? a.subscores?.risk_score ?? 0);
  const riskB = Number(b.risk_score ?? b.subscores?.risk_score ?? 0);
  if (riskB !== riskA) return riskB - riskA;

  // Tiebreak by last_detected timestamp
  const timeA = new Date(a.last_detected || a.acq_date || 0).getTime();
  const timeB = new Date(b.last_detected || b.acq_date || 0).getTime();
  return timeB - timeA;
}

// Re-export badge component
export { OperationalPriorityBadge } from '../components/OperationalPriorityBadge';

export default calculateOperationalPriority;
