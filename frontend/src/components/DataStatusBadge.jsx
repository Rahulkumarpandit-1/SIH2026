import React from 'react';
import { getDataStatus, getFreshnessLabel, computeFreshnessMinutes } from '../utils/dataProvenance';

/**
 * DataStatusBadge - Reusable data provenance pill badge.
 * LIVE (animated green dot) / RECENT (blue) / HISTORICAL (gray) / DEMO (orange dashed)
 */
export const DataStatusBadge = ({ incident, size = 'md', showSource = false }) => {
  const { status, config, source } = getDataStatus(incident);

  const freshMins = computeFreshnessMinutes(incident?.last_detected ?? incident?.telemetry?.last_detected)
    ?? incident?.observation_freshness_minutes
    ?? incident?.telemetry?.observation_freshness_minutes
    ?? null;

  const sizeClass = size === 'lg' ? 'dsb-lg' : size === 'sm' ? 'dsb-sm' : 'dsb-md';
  const isDemo = status === 'DEMO';
  const isLive = status === 'LIVE';

  return (
    <span className="data-status-badge-wrapper">
      <span
        className={`data-status-badge ${config.cssClass} ${sizeClass}`}
        title={config.description}
        style={{
          background: config.bgColor,
          border: `1px solid ${config.borderColor}`,
          color: config.color,
          ...(isDemo ? { borderStyle: 'dashed' } : {}),
        }}
      >
        {isLive ? (
          <span className="dsb-live-dot" aria-hidden="true" />
        ) : isDemo ? (
          <span className="dsb-icon" aria-hidden="true">&#9672;</span>
        ) : (
          <span className="dsb-dot" style={{ background: config.color }} aria-hidden="true" />
        )}
        <span className="dsb-label">{config.label}</span>
        {isLive && freshMins !== null && (
          <span className="dsb-freshness">{Math.round(freshMins)}m</span>
        )}
      </span>
      {showSource && (
        <span className="dsb-source-line" style={{ color: isDemo ? config.color : undefined }}>
          {isDemo ? '&#9888; Seeded Fallback Dataset' : source}
          {!isDemo && freshMins !== null && freshMins < 1440 && (
            <> &bull; {getFreshnessLabel(freshMins)}</>
          )}
        </span>
      )}
    </span>
  );
};

export default DataStatusBadge;