import React from 'react';
import { Radio, AlertCircle, History, Clock, Info } from 'lucide-react';
import { classifyTemporalStatus, formatRelativeAge, formatToIST } from '../utils/dateUtils';

/**
 * Incident Temporal Clarity Banner (Phase 13.1D)
 * SIH26162 — Thermal Industrial Fire Intelligence Platform
 *
 * Prominently alerts operators whether an incident is:
 * - LIVE OBSERVATION (Green): Last detection <= 6h
 * - RECENT OBSERVATION (Amber): Last detection > 6h and <= 24h
 * - HISTORICAL INCIDENT (Grey): Last detection > 24h ("This incident is not a live event.")
 */
export const IncidentTemporalBanner = ({ lastDetected, temporalStatus }) => {
  // Determine temporal classification
  const calculatedClass = classifyTemporalStatus(lastDetected);
  // Match with backend temporal_status if provided
  const effectiveClass = (temporalStatus === 'RECENTLY_OBSERVED' || temporalStatus === 'ACTIVE')
    ? 'LIVE'
    : (temporalStatus === 'RECENT')
      ? 'RECENT'
      : (temporalStatus === 'HISTORICAL')
        ? 'HISTORICAL'
        : calculatedClass;

  const istString = formatToIST(lastDetected);
  const relativeAge = formatRelativeAge(lastDetected, ''); // e.g. "45 minutes ago", "13 hours ago", "26 days ago"

  // Visual theming per status class
  const configs = {
    LIVE: {
      title: 'LIVE OBSERVATION',
      message: `Last satellite detection ${relativeAge}.`,
      subtext: 'Orbital infrared sensors detected thermal anomalies within recent overpass window. Ground verification required.',
      bg: 'rgba(18, 183, 106, 0.09)',
      border: '1px solid rgba(18, 183, 106, 0.45)',
      color: '#12B76A',
      textColor: '#027A48',
      icon: <Radio size={18} className="spin-anim-slow" style={{ color: '#12B76A' }} />,
      pulseColor: '#12B76A',
      showLiveWarning: false
    },
    RECENT: {
      title: 'RECENT OBSERVATION',
      message: `Last satellite detection ${relativeAge}.`,
      subtext: 'Observed during orbital passes within the past 24 hours. Observation may not reflect current thermal state.',
      bg: 'rgba(247, 144, 9, 0.09)',
      border: '1px solid rgba(247, 144, 9, 0.45)',
      color: '#F79009',
      textColor: '#B54708',
      icon: <Clock size={18} style={{ color: '#F79009' }} />,
      pulseColor: '#F79009',
      showLiveWarning: false
    },
    HISTORICAL: {
      title: 'HISTORICAL INCIDENT',
      message: `Last satellite detection ${relativeAge}. This incident is not a live event.`,
      subtext: 'Archived satellite observation record retained for longitudinal intelligence, baseline evaluation, and ML model training.',
      bg: 'rgba(100, 116, 139, 0.08)',
      border: '1px solid rgba(100, 116, 139, 0.35)',
      color: '#64748B',
      textColor: '#475569',
      icon: <History size={18} style={{ color: '#64748B' }} />,
      pulseColor: '#64748B',
      showLiveWarning: true
    }
  };

  const current = configs[effectiveClass] || configs.HISTORICAL;

  return (
    <div
      className="temporal-clarity-banner"
      style={{
        background: current.bg,
        border: current.border,
        borderRadius: '8px',
        padding: '0.9rem 1.15rem',
        marginBottom: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {current.icon}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.88rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                color: current.color,
                textTransform: 'uppercase'
              }}
            >
              {current.title}
            </span>
            <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)' }}>
              &bull; {current.message}
            </span>
          </div>
        </div>

        {/* Local time badge in IST */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            className="font-mono"
            style={{
              fontSize: '0.74rem',
              color: 'var(--text-secondary)',
              background: 'rgba(255, 255, 255, 0.6)',
              padding: '0.2rem 0.55rem',
              borderRadius: '4px',
              border: '1px solid rgba(0, 0, 0, 0.08)'
            }}
          >
            Last Observed: <strong>{istString}</strong>
          </span>
        </div>
      </div>

      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45, paddingLeft: '1.75rem' }}>
        {current.subtext}
      </div>
    </div>
  );
};

export default IncidentTemporalBanner;
