import React, { useState, useEffect } from 'react';
import { Activity, Flame, TrendingUp, Clock, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import apiService from '../services/api';

export const AbnormalityBreakdownCard = ({ incidentUuid, initialData = null }) => {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData && !!incidentUuid);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      return;
    }
    if (!incidentUuid) return;

    let mounted = true;
    setLoading(true);
    apiService.getAbnormalityBreakdown(incidentUuid)
      .then(res => {
        if (mounted && res && res.components) {
          setData(res);
        }
      })
      .catch(err => {
        if (mounted) setError('Could not load abnormality diagnostic breakdown.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [incidentUuid, initialData]);

  if (loading) {
    return (
      <section className="report-section">
        <span className="report-section-heading">08 &bull; Multi-Dimensional Abnormality Breakdown</span>
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Computing multi-dimensional abnormality diagnostics...
        </div>
      </section>
    );
  }

  if (error || !data || !data.components) {
    return null;
  }

  const {
    abnormality_score = 0,
    abnormality_status = 'NORMAL',
    components = [],
    intensity_ratio = 1.0,
    growth_trend = 'STABLE',
    persistence_excess_pct = 0,
    recurrence_ratio = 1.0,
    plain_language_explanation = ''
  } = data;

  const isSevere = abnormality_status === 'SEVERELY_ABNORMAL';
  const isAbnormal = abnormality_status === 'ABNORMAL';
  const isElevated = abnormality_status === 'ELEVATED';

  const getStatusColor = (status) => {
    if (status === 'SEVERELY_ABNORMAL') return '#D92D20';
    if (status === 'ABNORMAL') return '#E04F16';
    if (status === 'ELEVATED') return '#F79009';
    return '#12B76A';
  };

  const getIcon = (name) => {
    if (name.includes('Intensity')) return <Flame size={15} />;
    if (name.includes('Growth')) return <TrendingUp size={15} />;
    if (name.includes('Persistence')) return <Clock size={15} />;
    return <RotateCcw size={15} />;
  };

  return (
    <section className="report-section" id="abnormality-breakdown-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span className="report-section-heading" style={{ marginBottom: 0 }}>
          08 &bull; Multi-Dimensional Abnormality Breakdown
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Abnormality: <strong className="font-mono">{abnormality_score.toFixed(1)} / 100</strong>
          </span>
          <span className={`status-indicator-tag ${
            isSevere ? 'critical' : isAbnormal ? 'high' : isElevated ? 'warning' : 'success'
          }`} style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem' }}>
            {abnormality_status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      <p className="text-secondary" style={{ fontSize: '0.82rem', marginBottom: '0.85rem', lineHeight: 1.5 }}>
        Itemized point allocation across 4 physical anomaly dimensions: Heat Intensity (40 pts max), Thermal Growth (25 pts max), Persistence (20 pts max), and Recurrence (15 pts max).
      </p>

      {/* 4 Component Diagnostic Cards */}
      <div className="report-data-grid" style={{ marginBottom: '1rem' }}>
        {components.map((comp, idx) => {
          const compColor = getStatusColor(comp.status);
          return (
            <div key={idx} className="report-data-item" style={{ 
              borderLeft: `3px solid ${compColor}`,
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <span className="report-data-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {getIcon(comp.name)}
                  {comp.name}
                </span>
                <span style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: 600, 
                  color: compColor, 
                  background: 'var(--bg-card, #FFFFFF)', 
                  padding: '0.1rem 0.35rem', 
                  borderRadius: '3px' 
                }}>
                  {comp.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Point Fraction (e.g. 38 / 40) */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', margin: '0.3rem 0' }}>
                <span className="font-mono font-bold" style={{ fontSize: '1.25rem', color: compColor }}>
                  {comp.points.toFixed(0)}
                </span>
                <span className="font-mono text-muted" style={{ fontSize: '0.85rem' }}>
                  / {comp.max_points.toFixed(0)} pts
                </span>
                <span className="font-mono text-secondary" style={{ fontSize: '0.75rem', marginLeft: 'auto' }}>
                  {comp.contribution_percent.toFixed(1)}% of total
                </span>
              </div>

              {/* Fractional Progress Bar */}
              <div className="track-clean" style={{ height: '5px', background: 'var(--border-subtle, #E2E8F0)', marginBottom: '0.35rem' }}>
                <div 
                  className="fill-clean" 
                  style={{ 
                    width: `${Math.min((comp.points / comp.max_points) * 100, 100)}%`, 
                    background: compColor 
                  }} 
                />
              </div>

              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4, display: 'block' }}>
                {comp.detail}
              </span>
            </div>
          );
        })}
      </div>

      {/* Plain Language Diagnostic Summary */}
      {plain_language_explanation && (
        <div style={{ 
          padding: '0.75rem 1rem', 
          background: isSevere ? 'rgba(217, 45, 32, 0.05)' : isAbnormal ? 'rgba(224, 79, 22, 0.05)' : 'var(--bg-secondary, #F8FAFC)', 
          border: isSevere ? '1px solid rgba(217, 45, 32, 0.25)' : isAbnormal ? '1px solid rgba(224, 79, 22, 0.25)' : '1px solid var(--border-divider, #E2E8F0)', 
          borderRadius: '6px', 
          fontSize: '0.82rem', 
          lineHeight: 1.55 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.3rem', fontWeight: 600, color: isSevere ? '#D92D20' : isAbnormal ? '#E04F16' : 'var(--text-primary)' }}>
            <Activity size={14} />
            <span>Root-Cause Operational Diagnostic</span>
          </div>
          <p className="text-secondary" style={{ margin: 0 }}>
            {plain_language_explanation}
          </p>
        </div>
      )}
    </section>
  );
};

export default AbnormalityBreakdownCard;
