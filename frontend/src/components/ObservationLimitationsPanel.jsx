import React from 'react';
import { AlertTriangle, ShieldAlert, Satellite, Info, CheckCircle2 } from 'lucide-react';

/**
 * Observation Limitations Panel (Phase 13.1E)
 * SIH26162 — Thermal Industrial Fire Intelligence Platform
 *
 * Dedicated scientific disclosure panel establishing satellite observation boundaries,
 * physical sensor constraints, and mandatory ground verification requirements.
 */
export const ObservationLimitationsPanel = () => {
  return (
    <section className="report-section observation-limitations-panel" style={{
      background: 'rgba(15, 23, 42, 0.03)',
      border: '1px solid var(--border-divider, #E2E8F0)',
      borderRadius: '8px',
      padding: '1.1rem 1.25rem',
      marginTop: '1.25rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
        <ShieldAlert size={18} style={{ color: '#0284C7' }} />
        <span style={{ fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-main)' }}>
          Satellite Observation Limitations &amp; Operational Safety Disclosure
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '0.85rem',
        marginBottom: '0.9rem'
      }}>
        {/* DATA SOURCE */}
        <div style={{
          background: 'var(--bg-primary, #FFFFFF)',
          border: '1px solid var(--border-divider, #E2E8F0)',
          borderRadius: '6px',
          padding: '0.75rem 0.9rem'
        }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            DATA SOURCE
          </div>
          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
            NASA FIRMS VIIRS / MODIS
          </div>
        </div>

        {/* OBSERVATION TYPE */}
        <div style={{
          background: 'var(--bg-primary, #FFFFFF)',
          border: '1px solid var(--border-divider, #E2E8F0)',
          borderRadius: '6px',
          padding: '0.75rem 0.9rem'
        }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            OBSERVATION TYPE
          </div>
          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Satellite Thermal Anomaly Detection
          </div>
        </div>
      </div>

      {/* LIMITATION */}
      <div style={{
        background: 'var(--bg-primary, #FFFFFF)',
        border: '1px solid var(--border-divider, #E2E8F0)',
        borderRadius: '6px',
        padding: '0.75rem 0.9rem',
        marginBottom: '0.85rem'
      }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
          LIMITATION
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Detections represent satellite observations during orbital overpasses and do not provide continuous real-time monitoring.
        </div>
      </div>

      {/* WARNING CALLOUT */}
      <div style={{
        background: 'rgba(217, 45, 32, 0.06)',
        border: '1px solid rgba(217, 45, 32, 0.25)',
        borderRadius: '6px',
        padding: '0.75rem 0.9rem',
        marginBottom: '0.85rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.65rem'
      }}>
        <AlertTriangle size={17} style={{ color: '#D92D20', marginTop: '2px', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#D92D20', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.15rem' }}>
            WARNING
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
            Thermal detections do not independently confirm active fires, explosions, industrial accidents, or emergency conditions.
          </div>
        </div>
      </div>

      {/* REQUIREMENT */}
      <div style={{
        background: 'rgba(18, 183, 106, 0.06)',
        border: '1px solid rgba(18, 183, 106, 0.3)',
        borderRadius: '6px',
        padding: '0.75rem 0.9rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem'
      }}>
        <CheckCircle2 size={17} style={{ color: '#027A48', flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#027A48', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.45rem' }}>
            REQUIREMENT:
          </span>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Ground verification is required before operational action.
          </span>
        </div>
      </div>
    </section>
  );
};

export default ObservationLimitationsPanel;
