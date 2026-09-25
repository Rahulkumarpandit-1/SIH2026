import React from 'react';
import { getDataStatus, getFreshnessLabel, computeFreshnessMinutes, getStreamLabel } from '../utils/dataProvenance';
import { formatToIST } from '../utils/dateUtils';

/**
 * DataProvenancePanel - Data Source & Freshness panel.
 * compact=true for map popups, compact=false for Incident Detail report.
 */
export const DataProvenancePanel = ({ incident, compact = false }) => {
  if (!incident) return null;

  const { status, config } = getDataStatus(incident);
  const isDemo = status === 'DEMO';
  const isLive = status === 'LIVE';

  const streamType = incident.stream_type ?? incident.telemetry?.stream_type ?? null;
  const lastDetected = incident.last_detected ?? incident.acq_date ?? null;
  const firstDetected = incident.first_detected ?? null;

  const freshMins = computeFreshnessMinutes(lastDetected)
    ?? incident.observation_freshness_minutes
    ?? incident.telemetry?.observation_freshness_minutes
    ?? null;

  const sourceLabel = isDemo ? 'Seeded Fallback Dataset' : getStreamLabel(streamType, false);

  if (compact) {
    return (
      <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
          Data Source &amp; Freshness
        </div>
        {isDemo && (
          <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px dashed rgba(245,158,11,0.5)', borderRadius: '3px', padding: '0.3rem 0.45rem', marginBottom: '0.35rem', fontSize: '0.68rem', color: '#D97706', fontWeight: 700 }}>
            &#9672; DEMO DATA &mdash; Seeded for visualization &amp; testing
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Status</span>
          <span style={{ color: config.color, fontWeight: 700 }}>{config.label}</span>
          <span style={{ color: 'var(--text-muted)' }}>Source</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>{sourceLabel}</span>
          {lastDetected && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>Last Detection</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
                {freshMins !== null ? getFreshnessLabel(freshMins) : formatToIST(lastDetected)}
              </span>
            </>
          )}
          {!isDemo && freshMins !== null && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>Freshness</span>
              <span style={{ color: isLive ? config.color : 'var(--text-secondary)', fontWeight: isLive ? 700 : 400, fontSize: '0.65rem' }}>
                {Math.round(freshMins)} min
              </span>
            </>
          )}
          {isDemo && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>Purpose</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>Visualization &amp; Testing</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dpanel-full">
      <div className="dpanel-header">
        <span className="dpanel-title">Data Source &amp; Freshness</span>
        <span
          className={`dpanel-status-badge ${config.cssClass}`}
          style={{ background: config.bgColor, border: `1px solid ${config.borderColor}`, color: config.color, ...(isDemo ? { borderStyle: 'dashed' } : {}) }}
        >
          {isLive && <span className="dsb-live-dot" />}
          {config.label}
        </span>
      </div>

      {isDemo && (
        <div className="dpanel-demo-banner">
          <span className="dpanel-demo-icon">&#9672;</span>
          <div>
            <div className="dpanel-demo-heading">DEMO DATA &mdash; Seeded Fallback Dataset</div>
            <div className="dpanel-demo-sub">
              This incident originates from a pre-seeded demonstration dataset and is <strong>not</strong> derived
              from live NASA FIRMS satellite ingestion. It is included for platform visualization, testing,
              and evaluation purposes only.
            </div>
          </div>
        </div>
      )}

      <div className="dpanel-grid">
        <div className="dpanel-item">
          <span className="dpanel-label">Status</span>
          <span className="dpanel-val" style={{ color: config.color, fontWeight: 700 }}>{config.label}</span>
        </div>
        <div className="dpanel-item">
          <span className="dpanel-label">Source</span>
          <span className="dpanel-val">{sourceLabel}</span>
        </div>
        {!isDemo && streamType && (
          <div className="dpanel-item">
            <span className="dpanel-label">Stream Type</span>
            <span className="dpanel-val font-mono" style={{ fontSize: '0.8rem' }}>{streamType}</span>
          </div>
        )}
        {firstDetected && (
          <div className="dpanel-item">
            <span className="dpanel-label">First Detected</span>
            <span className="dpanel-val font-mono" style={{ fontSize: '0.8rem' }}>{formatToIST(firstDetected)}</span>
          </div>
        )}
        {lastDetected && (
          <div className="dpanel-item">
            <span className="dpanel-label">Last Detection</span>
            <span className="dpanel-val font-mono" style={{ fontSize: '0.8rem' }}>{formatToIST(lastDetected)}</span>
          </div>
        )}
        {!isDemo && freshMins !== null && (
          <div className="dpanel-item">
            <span className="dpanel-label">Observation Freshness</span>
            <span className="dpanel-val" style={{ color: isLive ? config.color : undefined, fontWeight: isLive ? 700 : 400 }}>
              {getFreshnessLabel(freshMins)} ({Math.round(freshMins)} min)
            </span>
          </div>
        )}
        {isDemo && (
          <div className="dpanel-item">
            <span className="dpanel-label">Purpose</span>
            <span className="dpanel-val">Visualization &amp; Testing</span>
          </div>
        )}
        <div className="dpanel-item">
          <span className="dpanel-label">Scientific Note</span>
          <span className="dpanel-val" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
            {isDemo
              ? 'Not from live NASA FIRMS ingestion. All engines (DBSCAN, risk, fingerprint) are authentic.'
              : 'Temporal status derived from satellite orbital pass, not physical ground confirmation.'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DataProvenancePanel;