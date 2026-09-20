import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Satellite } from 'lucide-react';
import { getCountdownRemaining, formatTimeIST, formatToIST } from '../utils/dateUtils';

/**
 * Next Satellite Ingestion Countdown Component (Phase 13.1C)
 * SIH26162 — Thermal Industrial Fire Intelligence Platform
 *
 * Provides a live, accurate, 1-second interval countdown:
 * - Calculated from server-provided UTC scheduler timestamps
 * - Strictly non-negative (clamps at 0m 00s -> "Checking satellite feed...")
 * - Correctly handles UTC to IST conversions and midnight crossovers
 * - Displays: NEXT SATELLITE DATA CHECK: Xm Ys (Next scheduled ingestion: HH:MM IST)
 */
export const NextSatelliteCountdown = ({ nextRefreshTime, onCountdownComplete }) => {
  const [countdown, setCountdown] = useState(() => getCountdownRemaining(nextRefreshTime));

  useEffect(() => {
    if (!nextRefreshTime) return;

    // Immediately compute initial state
    setCountdown(getCountdownRemaining(nextRefreshTime));

    // 1-second precision live ticker
    const timer = setInterval(() => {
      const state = getCountdownRemaining(nextRefreshTime);
      setCountdown(state);

      if (state.isDue && onCountdownComplete) {
        onCountdownComplete();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nextRefreshTime, onCountdownComplete]);

  const scheduledIST = formatTimeIST(nextRefreshTime);

  return (
    <div
      className="next-satellite-countdown-box"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.65rem',
        padding: '0.35rem 0.75rem',
        background: 'rgba(56, 189, 248, 0.08)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '6px',
        fontSize: '0.78rem'
      }}
    >
      <Satellite size={14} style={{ color: '#0284C7' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.03em' }}>
          NEXT SATELLITE DATA CHECK:
        </span>

        {countdown.isDue ? (
          <span style={{ color: '#F79009', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <RefreshCw size={11} className="spin-anim" /> Checking feed...
          </span>
        ) : (
          <span className="font-mono" style={{ color: '#0284C7', fontWeight: 700 }}>
            {countdown.formatted}
          </span>
        )}

        <span className="text-muted font-mono" style={{ fontSize: '0.74rem' }}>
          &bull; Scheduled: {scheduledIST}
        </span>
      </div>
    </div>
  );
};

export default NextSatelliteCountdown;
