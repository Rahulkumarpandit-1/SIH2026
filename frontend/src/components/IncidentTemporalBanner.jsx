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
export const IncidentTemporalBanner = ({ lastDetected, temporalStatus, isDemo = false }) => {
  // Derive mathematically consistent classification strictly from observation timestamp
  let effectiveClass = 'HISTORICAL';
  let diffHours = null;

  if (isDemo) {
    effectiveClass = 'DEMO';
  } else if (lastDetected) {
    const lastMs = new Date(lastDetected).getTime();
    if (!isNaN(lastMs)) {
      diffHours = (Date.now() - lastMs) / 3600000;
      if (diffHours >= 0 && diffHours <= 24) {
        effectiveClass = 'LIVE';
      } else if (diffHours > 24 && diffHours <= 168) {
        effectiveClass = 'RECENT';
      } else {
        effectiveClass = 'HISTORICAL';
      }
    }
  }

  const istString = formatToIST(lastDetected);
  const relativeAge = formatRelativeAge(lastDetected, ''); // e.g. "45 minutes ago", "13 hours ago", "26 days ago"

  // Visual theming per status class
  const configs = {
    LIVE: {
      title: 'LIVE SATELLITE OBSERVATION',
      message: `Last satellite detection ${relativeAge}.`,
      subtext: 'Near-real-time orbital infrared pass detected within the last 24 hours. Decision support intelligence; ground verification recommended.',
      bg: 'rgba(16, 185, 129, 0.09)',
      border: '1px solid rgba(16, 185, 129, 0.45)',
      color: '#10B981',
      textColor: '#047857',
      icon: <Radio size={18} className="spin-anim-slow" style={{ color: '#10B981' }} />,
    },
    RECENT: {
      title: 'RECENT SATELLITE OBSERVATION',
      message: `Last satellite detection ${relativeAge}.`,
      subtext: 'Operationally relevant detection observed between 24 hours and 7 days ago. Still operationally relevant for situational tracking.',
      bg: 'rgba(59, 130, 246, 0.09)',
      border: '1px solid rgba(59, 130, 246, 0.45)',
      color: '#3B82F6',
      textColor: '#1D4ED8',
      icon: <Clock size={18} style={{ color: '#3B82F6' }} />,
    },
    HISTORICAL: {
      title: 'HISTORICAL INCIDENT ARCHIVE',
      message: `Last satellite detection ${relativeAge}. This incident is not an active fire event.`,
      subtext: 'Archived satellite intelligence (>7 days old) retained for longitudinal analysis, seasonal baseline modeling, and ML training.',
      bg: 'rgba(107, 114, 128, 0.08)',
      border: '1px solid rgba(107, 114, 128, 0.35)',
      color: '#6B7280',
      textColor: '#374151',
      icon: <History size={18} style={{ color: '#6B7280' }} />,
    },
    DEMO: {
      title: '⚠ DEMO DATA &mdash; SEEDED RECORD',
      message: 'Demonstration and synthetic scenario record.',
      subtext: 'This record was seeded for platform evaluation and visualization. Not derived from live satellite ingestion.',
      bg: 'rgba(245, 158, 11, 0.09)',
      border: '1px dashed rgba(245, 158, 11, 0.55)',
      color: '#F59E0B',
      textColor: '#B45309',
      icon: <AlertCircle size={18} style={{ color: '#F59E0B' }} />,
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
