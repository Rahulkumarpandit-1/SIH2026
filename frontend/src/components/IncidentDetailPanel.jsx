import React from 'react';
import { ShieldAlert, Activity, MapPin, Gauge, Flame, BarChart2, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';

export const IncidentDetailPanel = ({ selectedCluster, selectedObservation }) => {
  // If nothing is selected
  if (!selectedCluster && !selectedObservation) {
    return (
      <div className="detail-panel">
        <div className="detail-empty-state">
          <Activity size={36} className="text-muted" style={{ opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No Incident Selected</p>
          <span style={{ fontSize: '0.78rem' }}>
            Click any hotspot or cluster marker on the GIS map, or select a row in the triage table to inspect full risk telemetry.
          </span>
        </div>
      </div>
    );
  }

  // Active cluster data (or derived from observation)
  const item = selectedCluster || selectedObservation;
  const isCluster = !!selectedCluster;

  const riskLevel = item.risk_level || 'LOW';
  const riskScore = item.risk_score ?? 0;
  const subscores = item.subscores || {};

  return (
    <div className="detail-panel">
      {/* Header */}
      <div className="detail-header">
        <div>
          <div className="detail-id">
            {isCluster ? item.cluster_id : `OBS #${item.observation_id} (${item.cluster_id})`}
          </div>
          <div className="detail-facility-tag">
            <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
            {item.nearest_facility_name || 'Nearby Area'} 
            {item.nearest_facility_type ? ` (${item.nearest_facility_type})` : ''}
          </div>
        </div>

        <span className={`risk-badge ${riskLevel.toLowerCase()}`}>
          {riskLevel} • {riskScore.toFixed(1)}
        </span>
      </div>

      {/* Action Banner */}
      <div 
        style={{
          background: riskLevel === 'CRITICAL' ? 'var(--risk-critical-bg)' : 'var(--bg-card-subtle)',
          border: `1px solid ${riskLevel === 'CRITICAL' ? 'var(--risk-critical-border)' : 'var(--border-subtle)'}`,
          padding: '0.65rem 0.85rem',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.78rem'
        }}
      >
        {riskLevel === 'CRITICAL' ? <AlertOctagon size={16} color="var(--risk-critical)" /> : <Activity size={16} color="var(--accent-cyan)" />}
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
            ACTION: {item.action_code || 'MONITOR'}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
            Classification: {item.incident_classification || 'UNKNOWN'}
          </div>
        </div>
      </div>

      {/* Telemetry Grid */}
      <div className="telemetry-grid">
        <div className="telemetry-item">
          <div className="telemetry-label">Max FRP (Power)</div>
          <div className="telemetry-val" style={{ color: 'var(--accent-cyan)' }}>
            {(item.telemetry?.max_frp ?? item.frp ?? item.max_frp ?? 0).toFixed(1)} MW
          </div>
        </div>

        <div className="telemetry-item">
          <div className="telemetry-label">Brightness Temp</div>
          <div className="telemetry-val">
            {(item.telemetry?.max_brightness ?? item.brightness ?? item.max_brightness ?? 0).toFixed(1)} K
          </div>
        </div>

        <div className="telemetry-item">
          <div className="telemetry-label">Industrial Distance</div>
          <div className="telemetry-val">
            {(item.telemetry?.distance_to_industry_meters ?? item.distance_to_industry_meters ?? 0) <= 0
              ? '0 m (Inside)'
              : `${(item.telemetry?.distance_to_industry_meters ?? item.distance_to_industry_meters ?? 0).toFixed(0)} m`}
          </div>
        </div>

        <div className="telemetry-item">
          <div className="telemetry-label">Persistence Ratio</div>
          <div className="telemetry-val">
            {(((item.telemetry?.persistence_ratio ?? item.persistence_ratio ?? 0)) * 100).toFixed(0)}%
          </div>
        </div>

        <div className="telemetry-item">
          <div className="telemetry-label">Detections / Days</div>
          <div className="telemetry-val">
            {item.telemetry?.total_detections ?? item.detection_count ?? 1} obs / {item.telemetry?.active_days_count ?? item.active_days_count ?? 1} days
          </div>
        </div>

        <div className="telemetry-item">
          <div className="telemetry-label">Anomaly Spike</div>
          <div className="telemetry-val" style={{ color: (item.telemetry?.is_anomaly_spike || item.is_anomaly_spike) ? 'var(--risk-critical)' : 'var(--risk-low)' }}>
            {(item.telemetry?.is_anomaly_spike || item.is_anomaly_spike) ? 'YES (Spike)' : 'Normal'}
          </div>
        </div>
      </div>

      {/* Explainable Phase 4 Risk Breakdown */}
      {isCluster && (
        <div className="explain-card">
          <div className="explain-title">
            <Gauge size={14} />
            <span>Why Is This Risky? (Phase 4 Breakdown)</span>
          </div>

          <div className="score-bar-row">
            <div className="score-bar-header">
              <span>Thermal Intensity (35%)</span>
              <span>{(subscores.thermal_subscore ?? 0).toFixed(1)} / 100</span>
            </div>
            <div className="score-bar-track">
              <div 
                className={`score-bar-fill ${riskLevel.toLowerCase()}`}
                style={{ width: `${Math.min(100, subscores.thermal_subscore ?? 0)}%` }}
              />
            </div>
          </div>

          <div className="score-bar-row">
            <div className="score-bar-header">
              <span>Industrial Proximity (30%)</span>
              <span>{(subscores.proximity_subscore ?? 0).toFixed(1)} / 100</span>
            </div>
            <div className="score-bar-track">
              <div 
                className={`score-bar-fill ${riskLevel.toLowerCase()}`}
                style={{ width: `${Math.min(100, subscores.proximity_subscore ?? 0)}%` }}
              />
            </div>
          </div>

          <div className="score-bar-row">
            <div className="score-bar-header">
              <span>Persistence & Anomaly (25%)</span>
              <span>{(subscores.persistence_subscore ?? 0).toFixed(1)} / 100</span>
            </div>
            <div className="score-bar-track">
              <div 
                className={`score-bar-fill ${riskLevel.toLowerCase()}`}
                style={{ width: `${Math.min(100, subscores.persistence_subscore ?? 0)}%` }}
              />
            </div>
          </div>

          <div className="score-bar-row">
            <div className="score-bar-header">
              <span>Sensor Confidence (10%)</span>
              <span>{(subscores.confidence_subscore ?? 0).toFixed(1)} / 100</span>
            </div>
            <div className="score-bar-track">
              <div 
                className={`score-bar-fill ${riskLevel.toLowerCase()}`}
                style={{ width: `${Math.min(100, subscores.confidence_subscore ?? 0)}%` }}
              />
            </div>
          </div>

          <div className="detail-disclaimer">
            * The risk score is an explainable decision-support prioritization metric, not definitive physical proof of an accident.
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentDetailPanel;
