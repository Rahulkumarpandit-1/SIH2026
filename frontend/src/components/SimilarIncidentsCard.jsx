import React, { useState, useEffect } from 'react';
import { GitCompare, History, Flame, ShieldAlert, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import apiService from '../services/api';

export const SimilarIncidentsCard = ({ incidentUuid, initialData = null }) => {
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
    apiService.getSimilarIncidents(incidentUuid, { top_k: 5 })
      .then(res => {
        if (mounted && res && res.similar_incidents) {
          setData(res);
        }
      })
      .catch(err => {
        if (mounted) setError('Could not load historical precedents.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [incidentUuid, initialData]);

  if (loading) {
    return (
      <section className="report-section">
        <span className="report-section-heading">09 &bull; Historically Similar Incident Precedents</span>
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Matching multi-dimensional thermal signature against historical incident database...
        </div>
      </section>
    );
  }

  if (error || !data || !data.similar_incidents) {
    return null;
  }

  const { similar_incidents = [], facility = '', target_risk_score = 0, target_frp = 0, target_abnormality_score = 0 } = data;

  const getMatchBadgeClass = (score) => {
    if (score >= 0.85) return 'critical';
    if (score >= 0.70) return 'high';
    if (score >= 0.50) return 'warning';
    return 'neutral';
  };

  return (
    <section className="report-section" id="similar-incidents-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span className="report-section-heading" style={{ marginBottom: 0 }}>
          09 &bull; Historically Similar Incident Precedents
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <span>Target: <strong className="font-mono">{target_risk_score.toFixed(1)} Risk</strong></span>
          <span>&bull;</span>
          <span><strong className="font-mono">{target_frp.toFixed(1)} MW Peak</strong></span>
          <span>&bull;</span>
          <span><strong className="font-mono">{target_abnormality_score.toFixed(1)} Abnormality</strong></span>
        </div>
      </div>

      <p className="text-secondary" style={{ fontSize: '0.82rem', marginBottom: '0.85rem', lineHeight: 1.5 }}>
        Top historical precedents identified via multi-feature distance matching across Risk Score, Peak FRP, Abnormality, Thermal Excursion Ratio, Persistence, and Facility Sector.
      </p>

      {similar_incidents.length === 0 ? (
        <div style={{ padding: '1rem', background: 'var(--bg-secondary, #F8FAFC)', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          No comparable historical incidents identified in the current observation registry.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {similar_incidents.map((inc, idx) => {
            const matchPct = (inc.similarity_score * 100).toFixed(0);
            const badgeClass = getMatchBadgeClass(inc.similarity_score);
            const breakdown = inc.similarity_breakdown || {};

            return (
              <div 
                key={inc.incident_uuid || idx} 
                style={{
                  background: 'var(--bg-secondary, #F8FAFC)',
                  border: '1px solid var(--border-divider, #E2E8F0)',
                  borderRadius: '6px',
                  padding: '0.75rem 1rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className={`status-indicator-tag ${badgeClass}`} style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem' }}>
                      {matchPct}% Match
                    </span>
                    <span className="font-bold" style={{ fontSize: '0.88rem' }}>{inc.facility}</span>
                    <span className="text-muted" style={{ fontSize: '0.74rem' }}>({inc.facility_type})</span>
                  </div>
                  <span className="font-mono text-muted" style={{ fontSize: '0.74rem' }}>
                    {inc.incident_uuid}
                  </span>
                </div>

                {/* Metric Summary Bar */}
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.78rem', margin: '0.45rem 0' }}>
                  <div>
                    <span className="text-muted">Outcome / Status: </span>
                    <strong className={inc.status === 'VERIFIED_FIRE' ? 'text-critical' : inc.status === 'FALSE_ALARM' ? 'text-secondary' : 'text-info'}>
                      {inc.status.replace(/_/g, ' ')}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted">Risk Score: </span>
                    <strong className="font-mono">{inc.risk_score.toFixed(1)}</strong> ({inc.risk_level})
                  </div>
                  <div>
                    <span className="text-muted">Peak FRP: </span>
                    <strong className="font-mono">{inc.peak_frp.toFixed(1)} MW</strong>
                  </div>
                  <div>
                    <span className="text-muted">Abnormality: </span>
                    <strong className="font-mono">{inc.abnormality_score.toFixed(1)}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Observation Window: </span>
                    <span className="font-mono text-secondary">
                      {inc.first_detected ? inc.first_detected.split('T')[0] : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Similarity Breakdown Micro-Tags */}
                {breakdown.risk_similarity !== undefined && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-divider, #E2E8F0)', fontSize: '0.7rem' }}>
                    <span className="text-muted">Similarity Sub-Scores:</span>
                    <span style={{ padding: '0.1rem 0.35rem', background: 'var(--bg-card, #FFFFFF)', borderRadius: '3px', border: '1px solid var(--border-subtle, #E2E8F0)' }}>
                      Risk: <strong>{(breakdown.risk_similarity * 100).toFixed(0)}%</strong>
                    </span>
                    <span style={{ padding: '0.1rem 0.35rem', background: 'var(--bg-card, #FFFFFF)', borderRadius: '3px', border: '1px solid var(--border-subtle, #E2E8F0)' }}>
                      FRP: <strong>{(breakdown.frp_similarity * 100).toFixed(0)}%</strong>
                    </span>
                    <span style={{ padding: '0.1rem 0.35rem', background: 'var(--bg-card, #FFFFFF)', borderRadius: '3px', border: '1px solid var(--border-subtle, #E2E8F0)' }}>
                      Abnormality: <strong>{(breakdown.abnormality_similarity * 100).toFixed(0)}%</strong>
                    </span>
                    <span style={{ padding: '0.1rem 0.35rem', background: 'var(--bg-card, #FFFFFF)', borderRadius: '3px', border: '1px solid var(--border-subtle, #E2E8F0)' }}>
                      Sector: <strong>{(breakdown.facility_type_similarity * 100).toFixed(0)}%</strong>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default SimilarIncidentsCard;
