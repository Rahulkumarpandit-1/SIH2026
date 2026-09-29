import React from 'react';
import {
  Database,
  CheckCircle2,
  Layers,
  Flame,
  ShieldCheck,
  Wrench,
  AlertTriangle,
  TrendingUp,
  BarChart2,
  Building2,
  MapPin,
  FileCheck2,
  Edit3
} from 'lucide-react';

export const DatasetQualityCard = ({ qualityData, loading = false }) => {
  if (loading) {
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-divider)', borderRadius: '8px', padding: '1.5rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '2rem' }}>
          <Database size={28} style={{ opacity: 0.4, display: 'block', margin: '0 auto 0.5rem' }} />
          Loading dataset quality telemetry...
        </div>
      </div>
    );
  }

  if (!qualityData) {
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-divider)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Database size={32} style={{ opacity: 0.4, display: 'block', margin: '0 auto 0.5rem' }} />
        <p>No dataset quality telemetry available.</p>
      </div>
    );
  }

  const {
    total_incidents = 0,
    total_labeled_incidents = 0,
    verified_coverage_pct = 0.0,
    label_distribution = {},
    labels_per_reviewer = {},
    region_distribution = {},
    facility_distribution = [],
    last_7_day_trend = [],
    edited_labels_count = 0,
    data_integrity_score = 0.0
  } = qualityData;

  const classConfig = {
    TRUE_FIRE:           { label: 'True Fire',          color: '#D92D20', bg: 'rgba(217,45,32,0.08)',   icon: Flame },
    CONTROLLED_FLARING:  { label: 'Controlled Flaring', color: '#175CD3', bg: 'rgba(23,92,211,0.08)',   icon: ShieldCheck },
    FALSE_ALARM:         { label: 'False Alarm',         color: '#B7791F', bg: 'rgba(183,121,31,0.08)', icon: AlertTriangle },
    MAINTENANCE_ACTIVITY:{ label: 'Maintenance',        color: '#6D28D9', bg: 'rgba(109,40,217,0.08)', icon: Wrench },
    UNLABELED:           { label: 'Pending Review',     color: '#6B7280', bg: 'rgba(107,114,128,0.08)', icon: Layers }
  };

  const maxTrend = Math.max(1, ...last_7_day_trend.map(t => t.count));

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-divider)', borderRadius: '8px', padding: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', borderRadius: '6px', background: 'rgba(40,122,75,0.08)', border: '1px solid rgba(40,122,75,0.2)', color: '#287A4B', display: 'flex' }}>
            <FileCheck2 size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              Dataset Quality &amp; Governance
              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '20px', background: 'rgba(40,122,75,0.1)', color: '#287A4B', border: '1px solid rgba(40,122,75,0.25)', fontWeight: 600 }}>
                Phase 14C
              </span>
            </h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Verified ground-truth coverage, label distributions, and empirical training data integrity
            </p>
          </div>
        </div>

        {/* Data Integrity Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border-divider)', borderRadius: '6px', padding: '0.4rem 0.85rem' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Data Integrity:</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#287A4B', fontFamily: 'var(--font-mono)' }}>
            {data_integrity_score.toFixed(1)}/100
          </span>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '0.85rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Total Incidents</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>{total_incidents}</div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Clusters &amp; historical</span>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '0.85rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Human-Verified</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#287A4B', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>{total_labeled_incidents}</div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Analyst reviewed</span>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '0.85rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Verified Coverage</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#175CD3', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>{verified_coverage_pct.toFixed(1)}%</div>
          <div style={{ width: '100%', background: 'var(--border-divider)', height: '4px', borderRadius: '999px', marginTop: '0.4rem', overflow: 'hidden' }}>
            <div style={{ background: '#175CD3', height: '100%', borderRadius: '999px', width: `${Math.min(100, verified_coverage_pct)}%`, transition: 'width 0.5s ease' }} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '0.85rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Quality Modifications</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#B7791F', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>{edited_labels_count}</div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Audit-tracked edits</span>
        </div>
      </div>

      {/* Label Distribution */}
      <div style={{ marginBottom: '1.25rem', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
            Operational Label Distribution
          </span>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {total_labeled_incidents} of {total_incidents} classified
          </span>
        </div>

        {/* Segmented bar */}
        <div style={{ width: '100%', height: '10px', borderRadius: '999px', background: 'var(--border-divider)', overflow: 'hidden', display: 'flex', marginBottom: '0.75rem' }}>
          {Object.entries(label_distribution).map(([key, count]) => {
            if (count === 0) return null;
            const pct = (count / Math.max(1, total_incidents)) * 100;
            const cfg = classConfig[key] || { color: '#6B7280' };
            return (
              <div
                key={key}
                style={{ width: `${pct}%`, background: cfg.color, height: '100%', transition: 'width 0.3s ease' }}
                title={`${cfg.label}: ${count} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>

        {/* Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {Object.entries(label_distribution).map(([key, count]) => {
            const cfg = classConfig[key] || { label: key, color: '#6B7280', bg: 'rgba(107,114,128,0.08)', icon: Layers };
            const Icon = cfg.icon || Layers;
            return (
              <div
                key={key}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '4px', background: cfg.bg, border: `1px solid ${cfg.color}40`, color: cfg.color, fontSize: '0.76rem' }}
              >
                <Icon size={12} />
                <span style={{ fontWeight: 500 }}>{cfg.label}:</span>
                <span style={{ fontWeight: 700 }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Columns: Facility Distribution & 7-Day Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        {/* Top Facilities */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Building2 size={13} style={{ color: 'var(--status-info)' }} />
            Top Labeled Industrial Facilities
          </h4>
          {facility_distribution.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No facilities labeled yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {facility_distribution.slice(0, 4).map((fac, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.4rem 0', borderBottom: idx < 3 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={fac.facility_name}>
                    {fac.facility_name}
                  </span>
                  <span style={{ padding: '0.1rem 0.5rem', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--status-info)', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.76rem', flexShrink: 0 }}>
                    {fac.count} {fac.count === 1 ? 'label' : 'labels'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7-Day Activity Trend */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <TrendingUp size={13} style={{ color: '#287A4B' }} />
            Last 7-Day Review Activity
          </h4>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.35rem', height: '72px', paddingTop: '0.5rem' }}>
            {last_7_day_trend.map((day, idx) => {
              const heightPct = maxTrend > 0 ? (day.count / maxTrend) * 100 : 0;
              const dateLabel = day.date ? day.date.slice(5) : `D-${idx}`;
              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{day.count}</span>
                  <div
                    style={{ width: '100%', maxWidth: '20px', borderRadius: '2px 2px 0 0', background: 'rgba(40,122,75,0.25)', borderTop: '2px solid #287A4B', height: `${Math.max(8, heightPct)}%`, transition: 'height 0.3s ease' }}
                    title={`${day.date}: ${day.count} reviews`}
                  />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dateLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
