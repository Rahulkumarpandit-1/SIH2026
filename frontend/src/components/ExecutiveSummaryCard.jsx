import React, { useState, useEffect } from 'react';
import { FileText, Copy, Check, ShieldAlert, Zap, Wind, Clock, Flame } from 'lucide-react';
import apiService from '../services/api';

export const ExecutiveSummaryCard = ({ incidentUuid, initialData = null }) => {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData && !!incidentUuid);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      return;
    }
    if (!incidentUuid) return;

    let mounted = true;
    setLoading(true);
    apiService.getExecutiveSummary(incidentUuid)
      .then(res => {
        if (mounted && res && res.executive_summary) {
          setData(res);
        }
      })
      .catch(err => {
        if (mounted) setError('Could not load executive summary.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [incidentUuid, initialData]);

  if (loading) {
    return (
      <section className="report-section">
        <span className="report-section-heading">06 &bull; Executive Incident Summary &amp; Decision Support Directive</span>
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Synthesizing verified multi-sensor telemetry into executive operational briefing...
        </div>
      </section>
    );
  }

  if (error || !data || !data.executive_summary) {
    return null;
  }

  const {
    facility_name = '',
    risk_level = 'LOW',
    risk_score = 0,
    action_code = 'BACKGROUND_LOG',
    executive_summary = '',
    key_bullet_points = [],
    evidence_telemetry = {},
    generated_at = ''
  } = data;

  const isCrit = risk_level === 'CRITICAL';
  const isHigh = risk_level === 'HIGH';

  const handleCopy = () => {
    const copyText = `${executive_summary}\n\nKey Telemetry:\n${key_bullet_points.map(b => `- ${b}`).join('\n')}`;
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <section className="report-section" id="executive-summary-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span className="report-section-heading" style={{ marginBottom: 0 }}>
          06 &bull; Executive Incident Summary &amp; Decision Support Directive
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            onClick={handleCopy}
            className="btn-secondary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem', 
              fontSize: '0.74rem', 
              padding: '0.25rem 0.6rem',
              borderRadius: '4px' 
            }}
          >
            {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
            <span>{copied ? 'Copied Briefing' : 'Copy Executive Brief'}</span>
          </button>
          <span className={`status-indicator-tag ${isCrit ? 'critical' : isHigh ? 'high' : 'warning'}`} style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem' }}>
            {risk_level} &bull; {action_code}
          </span>
        </div>
      </div>

      {/* Main Executive Paragraph Box */}
      <div style={{ 
        padding: '1rem 1.15rem', 
        background: isCrit ? 'rgba(217, 45, 32, 0.04)' : isHigh ? 'rgba(224, 79, 22, 0.04)' : 'var(--bg-secondary, #F8FAFC)', 
        border: isCrit ? '1px solid rgba(217, 45, 32, 0.25)' : isHigh ? '1px solid rgba(224, 79, 22, 0.25)' : '1px solid var(--border-divider, #E2E8F0)', 
        borderRadius: '6px', 
        marginBottom: '0.85rem' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem', fontWeight: 700, fontSize: '0.88rem' }}>
          <FileText size={16} className={isCrit ? 'text-critical' : isHigh ? 'text-warning' : 'text-secondary'} />
          <span>Operational Situation Synthesis</span>
        </div>
        <p style={{ 
          fontSize: '0.88rem', 
          lineHeight: 1.6, 
          margin: 0, 
          color: 'var(--text-primary)', 
          fontWeight: 500 
        }}>
          {executive_summary}
        </p>
      </div>

      {/* 4 High-Impact Evidence Bullet Nodes */}
      {key_bullet_points.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.5rem', marginBottom: '0.85rem' }}>
          {key_bullet_points.map((bullet, idx) => (
            <div 
              key={idx} 
              style={{ 
                padding: '0.65rem 0.85rem', 
                background: 'var(--bg-card, #FFFFFF)', 
                border: '1px solid var(--border-subtle, #E2E8F0)', 
                borderRadius: '5px',
                fontSize: '0.78rem',
                lineHeight: 1.45,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.45rem'
              }}
            >
              <span style={{ 
                width: 6, 
                height: 6, 
                borderRadius: '50%', 
                background: idx === 0 ? '#D92D20' : idx === 1 ? '#F79009' : idx === 2 ? '#7A5AF8' : '#0BA5EC', 
                marginTop: '0.35rem', 
                flexShrink: 0 
              }} />
              <span className="text-secondary font-medium">{bullet}</span>
            </div>
          ))}
        </div>
      )}

      {/* Forensic Telemetry Strip & Audit Disclaimer */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '0.5rem', 
        fontSize: '0.72rem', 
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-divider, #E2E8F0)',
        paddingTop: '0.5rem'
      }}>
        <div>
          <span>Peak FRP: <strong className="font-mono">{evidence_telemetry.peak_frp?.toFixed(1) || 'N/A'} MW</strong></span>
          <span style={{ margin: '0 0.35rem' }}>&bull;</span>
          <span>Baseline Ratio: <strong className="font-mono">{evidence_telemetry.anomaly_ratio?.toFixed(1) || '1.0'}x</strong></span>
          <span style={{ margin: '0 0.35rem' }}>&bull;</span>
          <span>Active Duration: <strong className="font-mono">{evidence_telemetry.active_duration_hours?.toFixed(1) || '0.0'}h</strong></span>
          <span style={{ margin: '0 0.35rem' }}>&bull;</span>
          <span>Plume: <strong className="font-mono">{evidence_telemetry.plume_dispersion_heading || 'N/A'}</strong></span>
        </div>
        <div>
          <span>Deterministic Telemetry Engine &bull; Zero External LLMs &bull; Audit-Ready</span>
        </div>
      </div>
    </section>
  );
};

export default ExecutiveSummaryCard;
