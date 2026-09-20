import React from 'react';
import { Clock, Calendar, AlertCircle, RefreshCw, Satellite, History, Layers } from 'lucide-react';
import { formatToIST, formatRelativeAge, formatTimestampWithRelative } from '../utils/dateUtils';

export const IncidentTemporalPanel = ({ temporalData, incidentUuid, currentStatus }) => {
  if (!temporalData) return null;

  const {
    first_detected,
    last_detected,
    incident_age_hours = 0,
    active_duration_hours = 0,
    detection_count = 1,
    observation_freshness_minutes = 0,
    temporal_status = 'HISTORICAL',
    is_recently_observed = false,
    scientific_disclosure = ''
  } = temporalData;

  const formatFreshness = (mins) => {
    if (mins === null || mins === undefined) return 'N/A';
    if (mins < 60) return `Observed ${mins.toFixed(0)} minutes ago`;
    const hours = mins / 60;
    if (hours < 24) return `Observed ${hours.toFixed(1)} hours ago`;
    const days = hours / 24;
    return `Observed ${days.toFixed(1)} days ago`;
  };

  const isRecentObs = temporal_status === 'RECENTLY_OBSERVED';
  const isRecent = temporal_status === 'RECENT';

  return (
    <section className="report-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <span className="report-section-heading" style={{ marginBottom: 0 }}>
          03 &bull; Temporal Intelligence &amp; Observation Freshness
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Observation-derived status badge */}
          <span className={`status-indicator-tag ${
            isRecentObs ? 'critical' : isRecent ? 'warning' : 'neutral'
          }`} style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isRecentObs ? '#D92D20' : isRecent ? '#F79009' : '#64748B',
              animation: isRecentObs ? 'pulse 1.8s infinite' : 'none'
            }} />
            {temporal_status.replace(/_/g, ' ')}
          </span>

          {/* Investigation status badge */}
          {currentStatus && (
            <span className="pill-badge pill-neutral font-mono" style={{ fontSize: '0.76rem', padding: '0.2rem 0.55rem' }}>
              INVESTIGATION: <strong>{currentStatus}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Freshness Banner Callout */}
      <div style={{
        padding: '0.85rem 1rem',
        background: isRecentObs ? 'rgba(217, 45, 32, 0.06)' : 'var(--bg-secondary, #F8FAFC)',
        border: `1px solid ${isRecentObs ? 'rgba(217, 45, 32, 0.3)' : 'var(--border-divider, #E2E8F0)'}`,
        borderRadius: '6px',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <RefreshCw size={18} className={isRecentObs ? 'text-critical' : 'text-secondary'} />
          <div>
            <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>
              Satellite Observation Freshness: <span className="font-mono">{formatFreshness(observation_freshness_minutes)}</span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              Latest sensor overpass: <strong>{formatTimestampWithRelative(last_detected, 'Observed')}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Permanent UUID:</span>
          <span className="font-mono font-bold text-secondary" style={{ fontSize: '0.78rem' }}>
            {incidentUuid || 'INC-PERSISTENT-ID'}
          </span>
        </div>
      </div>

      {/* 6-Grid Core Temporal Metrics */}
      <div className="report-data-grid">
        <div className="report-data-item">
          <span className="report-data-label">First Detected</span>
          <span className="report-data-val font-mono" style={{ fontSize: '0.85rem' }}>
            {formatToIST(first_detected)}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatRelativeAge(first_detected, 'Initial observation')}</span>
        </div>

        <div className="report-data-item">
          <span className="report-data-label">Latest Detected</span>
          <span className="report-data-val font-mono" style={{ fontSize: '0.85rem' }}>
            {formatToIST(last_detected)}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatRelativeAge(last_detected, 'Most recent overpass')}</span>
        </div>

        <div className="report-data-item">
          <span className="report-data-label">Incident Age</span>
          <span className="report-data-val font-mono">
            {incident_age_hours >= 24
              ? `${(incident_age_hours / 24).toFixed(1)} Days`
              : `${incident_age_hours.toFixed(1)} Hours`}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total elapsed since first capture</span>
        </div>

        <div className="report-data-item">
          <span className="report-data-label">Active Observation Span</span>
          <span className="report-data-val font-mono">
            {active_duration_hours >= 24
              ? `${(active_duration_hours / 24).toFixed(1)} Days`
              : active_duration_hours > 0
              ? `${active_duration_hours.toFixed(1)} Hours`
              : 'Single Overpass'}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Duration between first &amp; last pass</span>
        </div>

        <div className="report-data-item">
          <span className="report-data-label">Satellite Detections</span>
          <span className="report-data-val font-mono">
            {detection_count} {detection_count === 1 ? 'Detection' : 'Overpass Passes'}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Contributing infrared pixels</span>
        </div>

        <div className="report-data-item">
          <span className="report-data-label">Temporal Window Status</span>
          <span className={`report-data-val ${isRecentObs ? 'text-critical font-bold' : ''}`}>
            {isRecentObs ? 'RECENTLY OBSERVED (<=6h)' : isRecent ? 'RECENT WINDOW (6-24h)' : 'HISTORICAL ARCHIVE (>24h)'}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Derived from overpass timestamp</span>
        </div>
      </div>

      {/* Scientific Disclosure on Observation Derivation */}
      <div style={{
        marginTop: '0.85rem',
        padding: '0.75rem 1rem',
        background: 'var(--bg-secondary, #F8FAFC)',
        borderRadius: '6px',
        border: '1px solid var(--border-divider, #E2E8F0)',
        fontSize: '0.8rem',
        lineHeight: 1.5,
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.3rem', fontWeight: 600 }}>
          <AlertCircle size={15} className="text-secondary" />
          <span>Observation-Derived Classification Notice</span>
        </div>
        <p style={{ margin: 0 }}>
          {scientific_disclosure || (
            'Incident status (RECENTLY_OBSERVED, RECENT, HISTORICAL) is derived strictly from the latest available satellite infrared overpass (NASA FIRMS) and does not represent real-time physical ground truth. Orbital satellites pass at discrete intervals.'
          )}
        </p>
      </div>
    </section>
  );
};

export default IncidentTemporalPanel;
