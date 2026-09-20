import React, { useState, useEffect } from 'react';
import { Building2, TrendingUp, TrendingDown, ShieldAlert, CheckCircle2, AlertTriangle, Flame, Clock } from 'lucide-react';
import apiService from '../services/api';

export const FacilityRiskProfileCard = ({ facilityName, initialData = null }) => {
  const [profile, setProfile] = useState(initialData);
  const [loading, setLoading] = useState(!initialData && !!facilityName);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setProfile(initialData);
      return;
    }
    if (!facilityName) return;

    let mounted = true;
    setLoading(true);
    apiService.getFacilityRiskProfile(facilityName)
      .then(res => {
        if (mounted && res && res.facility_name) {
          setProfile(res);
        }
      })
      .catch(err => {
        if (mounted) setError('Could not load facility risk profile.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [facilityName, initialData]);

  if (loading) {
    return (
      <section className="report-section">
        <span className="report-section-heading">Facility Risk &amp; Compliance Profile</span>
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Aggregating facility longitudinal emission records and incident history...
        </div>
      </section>
    );
  }

  if (error || !profile) {
    return null;
  }

  const {
    facility_name = facilityName,
    facility_type = 'Industrial Installation',
    region_code = 'WEST_GUJARAT',
    state = 'Gujarat',
    total_incidents = 0,
    verified_fires = 0,
    false_alarms = 0,
    controlled_flaring = 0,
    average_risk_score = 0,
    average_abnormality_score = 0,
    peak_frp = 0,
    baseline_frp = 12,
    last_incident_date = null,
    historical_trend = 'STABLE',
    trend_description = '',
    risk_tier = 'NOMINAL_MONITORING'
  } = profile;

  const getTierColor = (tier) => {
    if (tier === 'CRITICAL_RISK') return '#D92D20';
    if (tier === 'ELEVATED_RISK') return '#F79009';
    if (tier === 'NOMINAL_MONITORING') return '#0BA5EC';
    return '#12B76A';
  };

  const isTrendIncreasing = historical_trend === 'INCREASING';
  const isTrendDecreasing = historical_trend === 'DECREASING';

  return (
    <div style={{ 
      background: 'var(--bg-secondary, #F8FAFC)', 
      border: '1px solid var(--border-divider, #E2E8F0)', 
      borderRadius: '8px', 
      padding: '1rem',
      marginTop: '1rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 size={18} className="text-secondary" />
          <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>
            {facility_name} &bull; Longitudinal Risk Profile
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ 
            fontSize: '0.72rem', 
            fontWeight: 700, 
            padding: '0.2rem 0.55rem', 
            borderRadius: '4px',
            background: 'var(--bg-card, #FFFFFF)',
            color: getTierColor(risk_tier),
            border: `1px solid ${getTierColor(risk_tier)}`
          }}>
            {risk_tier.replace(/_/g, ' ')}
          </span>
          <span style={{ 
            fontSize: '0.72rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.25rem',
            padding: '0.2rem 0.55rem',
            borderRadius: '4px',
            background: isTrendIncreasing ? 'rgba(217, 45, 32, 0.1)' : isTrendDecreasing ? 'rgba(18, 183, 106, 0.1)' : 'rgba(100, 116, 139, 0.1)',
            color: isTrendIncreasing ? '#D92D20' : isTrendDecreasing ? '#12B76A' : 'var(--text-secondary)'
          }}>
            {isTrendIncreasing ? <TrendingUp size={12} /> : isTrendDecreasing ? <TrendingDown size={12} /> : null}
            Trend: {historical_trend}
          </span>
        </div>
      </div>

      {trend_description && (
        <p className="text-secondary" style={{ fontSize: '0.78rem', margin: '0 0 0.75rem 0', fontStyle: 'italic' }}>
          {trend_description}
        </p>
      )}

      {/* Metric Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
        <div style={{ padding: '0.5rem', background: 'var(--bg-card, #FFFFFF)', borderRadius: '4px', border: '1px solid var(--border-subtle, #E2E8F0)' }}>
          <span className="report-data-label" style={{ fontSize: '0.68rem' }}>Total Incidents</span>
          <span className="font-mono font-bold" style={{ fontSize: '0.95rem' }}>{total_incidents}</span>
        </div>

        <div style={{ padding: '0.5rem', background: 'var(--bg-card, #FFFFFF)', borderRadius: '4px', border: '1px solid var(--border-subtle, #E2E8F0)' }}>
          <span className="report-data-label" style={{ fontSize: '0.68rem' }}>Verified Fires</span>
          <span className="font-mono font-bold text-critical" style={{ fontSize: '0.95rem' }}>{verified_fires}</span>
        </div>

        <div style={{ padding: '0.5rem', background: 'var(--bg-card, #FFFFFF)', borderRadius: '4px', border: '1px solid var(--border-subtle, #E2E8F0)' }}>
          <span className="report-data-label" style={{ fontSize: '0.68rem' }}>False Alarms</span>
          <span className="font-mono font-bold text-secondary" style={{ fontSize: '0.95rem' }}>{false_alarms}</span>
        </div>

        <div style={{ padding: '0.5rem', background: 'var(--bg-card, #FFFFFF)', borderRadius: '4px', border: '1px solid var(--border-subtle, #E2E8F0)' }}>
          <span className="report-data-label" style={{ fontSize: '0.68rem' }}>Routine Flares</span>
          <span className="font-mono font-bold text-info" style={{ fontSize: '0.95rem' }}>{controlled_flaring}</span>
        </div>

        <div style={{ padding: '0.5rem', background: 'var(--bg-card, #FFFFFF)', borderRadius: '4px', border: '1px solid var(--border-subtle, #E2E8F0)' }}>
          <span className="report-data-label" style={{ fontSize: '0.68rem' }}>Avg Risk</span>
          <span className="font-mono font-bold" style={{ fontSize: '0.95rem' }}>{average_risk_score.toFixed(1)}</span>
        </div>

        <div style={{ padding: '0.5rem', background: 'var(--bg-card, #FFFFFF)', borderRadius: '4px', border: '1px solid var(--border-subtle, #E2E8F0)' }}>
          <span className="report-data-label" style={{ fontSize: '0.68rem' }}>Avg Abnormality</span>
          <span className="font-mono font-bold" style={{ fontSize: '0.95rem' }}>{average_abnormality_score.toFixed(1)}</span>
        </div>

        <div style={{ padding: '0.5rem', background: 'var(--bg-card, #FFFFFF)', borderRadius: '4px', border: '1px solid var(--border-subtle, #E2E8F0)' }}>
          <span className="report-data-label" style={{ fontSize: '0.68rem' }}>Peak FRP (Record)</span>
          <span className="font-mono font-bold text-critical" style={{ fontSize: '0.95rem' }}>{peak_frp.toFixed(1)} MW</span>
        </div>

        <div style={{ padding: '0.5rem', background: 'var(--bg-card, #FFFFFF)', borderRadius: '4px', border: '1px solid var(--border-subtle, #E2E8F0)' }}>
          <span className="report-data-label" style={{ fontSize: '0.68rem' }}>Baseline Envelope</span>
          <span className="font-mono font-bold" style={{ fontSize: '0.95rem' }}>{baseline_frp.toFixed(1)} MW</span>
        </div>
      </div>
    </div>
  );
};

export default FacilityRiskProfileCard;
