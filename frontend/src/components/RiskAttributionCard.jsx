import React, { useState, useEffect } from 'react';
import { Gauge, ShieldAlert, Layers, Percent, HelpCircle } from 'lucide-react';
import apiService from '../services/api';

export const RiskAttributionCard = ({ incidentUuid, initialData = null }) => {
  const [attribution, setAttribution] = useState(initialData);
  const [loading, setLoading] = useState(!initialData && !!incidentUuid);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setAttribution(initialData);
      return;
    }
    if (!incidentUuid) return;

    let mounted = true;
    setLoading(true);
    apiService.getRiskAttribution(incidentUuid)
      .then(res => {
        if (mounted && res && res.contributors) {
          setAttribution(res);
        }
      })
      .catch(err => {
        if (mounted) setError('Could not load risk attribution breakdown.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [incidentUuid, initialData]);

  if (loading) {
    return (
      <section className="report-section">
        <span className="report-section-heading">07 &bull; Explainable Risk Attribution Breakdown</span>
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Computing explainable mathematical factor attribution...
        </div>
      </section>
    );
  }

  if (error || !attribution || !attribution.contributors) {
    return null;
  }

  const { risk_score = 0, risk_level = 'LOW', contributors = [], primary_factor = '', explanation = '' } = attribution;
  const isCrit = risk_level === 'CRITICAL';
  const isHigh = risk_level === 'HIGH';

  const getFactorColor = (factor) => {
    if (factor.includes('Thermal')) return '#D92D20';
    if (factor.includes('Proximity')) return '#E04F16';
    if (factor.includes('Persistence')) return '#F79009';
    if (factor.includes('Confidence')) return '#0BA5EC';
    if (factor.includes('Exposure')) return '#7A5AF8';
    return '#64748B';
  };

  return (
    <section className="report-section" id="risk-attribution-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span className="report-section-heading" style={{ marginBottom: 0 }}>
          07 &bull; Explainable Risk Attribution Breakdown
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Risk Score: <strong className={`font-mono ${isCrit ? 'text-critical' : isHigh ? 'text-warning' : ''}`}>{risk_score.toFixed(1)} / 100</strong>
          </span>
          <span className={`status-indicator-tag ${isCrit ? 'critical' : isHigh ? 'high' : 'warning'}`} style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem' }}>
            Primary Driver: {primary_factor}
          </span>
        </div>
      </div>

      <p className="text-secondary" style={{ fontSize: '0.82rem', marginBottom: '0.85rem', lineHeight: 1.5 }}>
        Mathematical deconstruction of composite risk into independent contributing dimensions. Provides transparent, auditable evidence for incident prioritization and regulatory logging.
      </p>

      {/* Ranked Contributors Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
        {contributors.map((c, idx) => {
          const barColor = getFactorColor(c.factor);
          return (
            <div key={idx} style={{ 
              background: 'var(--bg-secondary, #F8FAFC)', 
              padding: '0.65rem 0.85rem', 
              borderRadius: '6px', 
              border: '1px solid var(--border-divider, #E2E8F0)' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: barColor }} />
                  <span className="font-bold">{c.factor}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className="font-mono text-secondary" style={{ fontSize: '0.78rem' }}>
                    +{c.value.toFixed(1)} pts
                  </span>
                  <span className="font-mono font-bold" style={{ color: barColor, minWidth: '48px', textAlign: 'right' }}>
                    {c.percent.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="track-clean" style={{ height: '6px', background: 'var(--border-subtle, #E2E8F0)' }}>
                <div 
                  className="fill-clean" 
                  style={{ 
                    width: `${Math.min(c.percent, 100)}%`, 
                    background: barColor, 
                    transition: 'width 0.4s ease' 
                  }} 
                />
              </div>

              {c.description && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  {c.description}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Analyst Narrative Callout */}
      {explanation && (
        <div style={{ 
          padding: '0.75rem 1rem', 
          background: 'rgba(11, 165, 236, 0.05)', 
          border: '1px solid rgba(11, 165, 236, 0.25)', 
          borderRadius: '6px', 
          fontSize: '0.82rem', 
          lineHeight: 1.55 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.3rem', fontWeight: 600, color: '#0284C7' }}>
            <Layers size={14} />
            <span>Analyst Risk Attribution Summary</span>
          </div>
          <p className="text-secondary" style={{ margin: 0 }}>
            {explanation}
          </p>
        </div>
      )}
    </section>
  );
};

export default RiskAttributionCard;
