import React from 'react';
import {
  Cpu,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Layers,
  Scale,
  Building2,
  MapPin,
  Users,
  Info
} from 'lucide-react';

export const TrainingReadinessCard = ({ readinessData, loading = false }) => {
  if (loading) {
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-divider)', borderRadius: '8px', padding: '1.5rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '2rem' }}>
          <Cpu size={28} style={{ opacity: 0.4, marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }} />
          Loading ML training readiness evaluation...
        </div>
      </div>
    );
  }

  if (!readinessData) {
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-divider)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Cpu size={32} style={{ opacity: 0.4, marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }} />
        <p>No machine learning readiness evaluation available.</p>
      </div>
    );
  }

  const {
    readiness_state = 'NOT_READY',
    readiness_score = 0.0,
    dimensions = {},
    dimension_telemetry = {},
    explanation = '',
    bottlenecks = [],
    recommendation = ''
  } = readinessData;

  const stateConfig = {
    NOT_READY: {
      label: 'NOT READY FOR SUPERVISED ML',
      sublabel: 'Statistical & geographic insufficiency',
      color: '#D92D20',
      bg: 'rgba(217, 45, 32, 0.08)',
      border: 'rgba(217, 45, 32, 0.25)',
      icon: ShieldAlert
    },
    LIMITED_TRAINING: {
      label: 'LIMITED EXPERIMENTAL TRAINING',
      sublabel: 'Suitable for benchmark evaluations',
      color: '#B7791F',
      bg: 'rgba(183, 121, 31, 0.08)',
      border: 'rgba(183, 121, 31, 0.25)',
      icon: AlertCircle
    },
    PRODUCTION_READY: {
      label: 'PRODUCTION TRAINING READY',
      sublabel: 'Full multi-region empirical sufficiency',
      color: '#287A4B',
      bg: 'rgba(40, 122, 75, 0.08)',
      border: 'rgba(40, 122, 75, 0.25)',
      icon: ShieldCheck
    }
  };

  const currentCfg = stateConfig[readiness_state] || stateConfig.NOT_READY;
  const StateIcon = currentCfg.icon;

  const dimensionItems = [
    { id: 'verified', label: 'Verified Volume', score: dimensions.total_verified_score ?? 0, value: `${dimension_telemetry.verified_count ?? 0} labels`, target: '50 target', icon: Layers },
    { id: 'balance', label: 'Class Balance', score: dimensions.class_balance_score ?? 0, value: `${dimension_telemetry.classes_represented ?? 0}/4 classes`, target: '4 balanced', icon: Scale },
    { id: 'facility', label: 'Facility Diversity', score: dimensions.facility_diversity_score ?? 0, value: `${dimension_telemetry.facility_count ?? 0} sites`, target: '5+ sites', icon: Building2 },
    { id: 'region', label: 'Regional Diversity', score: dimensions.regional_diversity_score ?? 0, value: `${dimension_telemetry.region_count ?? 0} regions`, target: '2+ corridors', icon: MapPin },
    { id: 'reviewer', label: 'Reviewer Diversity', score: dimensions.reviewer_diversity_score ?? 0, value: `${dimension_telemetry.reviewer_count ?? 0} analysts`, target: '3+ reviewers', icon: Users }
  ];

  const barColor = readiness_score >= 75 ? '#287A4B' : readiness_score >= 40 ? '#B7791F' : '#D92D20';

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-divider)', borderRadius: '8px', padding: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', borderRadius: '6px', background: currentCfg.bg, border: `1px solid ${currentCfg.border}`, color: currentCfg.color, display: 'flex' }}>
            <StateIcon size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Machine Learning Training Readiness Engine
              </h3>
              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '20px', background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6', border: '1px solid rgba(139, 92, 246, 0.25)', fontWeight: 600 }}>
                Phase 14D
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Honest 5-dimensional evaluation of empirical dataset sufficiency for supervised models
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div style={{ padding: '0.5rem 0.9rem', borderRadius: '6px', background: currentCfg.bg, border: `1px solid ${currentCfg.border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <StateIcon size={16} style={{ color: currentCfg.color, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', color: currentCfg.color, fontFamily: 'var(--font-mono)' }}>
              {currentCfg.label}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{currentCfg.sublabel}</div>
          </div>
        </div>
      </div>

      {/* Score Gauge */}
      <div style={{ marginBottom: '1.25rem', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Empirical ML Training Readiness Score
          </span>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: barColor }}>
            {readiness_score.toFixed(1)} / 100
          </span>
        </div>

        <div style={{ width: '100%', background: 'var(--border-divider)', height: '10px', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.5rem' }}>
          <div style={{ height: '100%', borderRadius: '999px', transition: 'width 0.6s ease', width: `${Math.max(3, Math.min(100, readiness_score))}%`, background: barColor }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          <span>0 (Not Ready)</span>
          <span style={{ color: '#B7791F' }}>40 (Limited Experimental)</span>
          <span style={{ color: '#287A4B' }}>75+ (Production Ready)</span>
          <span>100</span>
        </div>
      </div>

      {/* 5-Dimensional Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {dimensionItems.map((dim) => {
          const Icon = dim.icon;
          const scoreColor = dim.score >= 75 ? '#287A4B' : dim.score >= 40 ? '#B7791F' : '#D92D20';
          return (
            <div key={dim.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{dim.label}</span>
                <Icon size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                {dim.value}
              </div>
              <div style={{ width: '100%', background: 'var(--border-divider)', height: '4px', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.3rem' }}>
                <div style={{ height: '100%', borderRadius: '999px', width: `${Math.max(5, dim.score)}%`, background: scoreColor }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}>
                <span style={{ color: scoreColor, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{dim.score.toFixed(0)}%</span>
                <span style={{ color: 'var(--text-muted)' }}>{dim.target}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explanation & Bottlenecks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {/* Narrative */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Info size={13} style={{ color: 'var(--status-info)' }} />
            Scientific Readiness Assessment
          </h4>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {explanation}
          </p>
          <div style={{ padding: '0.6rem 0.8rem', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-divider)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--status-info)', display: 'block', marginBottom: '0.2rem' }}>Operational Guidance:</strong>
            {recommendation}
          </div>
        </div>

        {/* Bottlenecks */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertCircle size={13} style={{ color: '#B7791F' }} />
            Identified Training Bottlenecks ({bottlenecks.length})
          </h4>
          {bottlenecks.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#287A4B', padding: '0.4rem 0' }}>
              <CheckCircle2 size={15} />
              <span>No critical bottlenecks detected. Dataset is fully ready for supervised training.</span>
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {bottlenecks.map((item, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: '#B7791F', fontWeight: 700, flexShrink: 0, marginTop: '0.1rem' }}>•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
