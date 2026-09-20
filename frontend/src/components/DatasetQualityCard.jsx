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
      <div className="card-glass p-6 animate-pulse">
        <div className="h-6 bg-slate-700/50 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="h-16 bg-slate-800/40 rounded"></div>
          <div className="h-16 bg-slate-800/40 rounded"></div>
          <div className="h-16 bg-slate-800/40 rounded"></div>
          <div className="h-16 bg-slate-800/40 rounded"></div>
        </div>
        <div className="h-32 bg-slate-800/30 rounded"></div>
      </div>
    );
  }

  if (!qualityData) {
    return (
      <div className="card-glass p-6 text-center text-slate-400">
        <Database className="mx-auto mb-2 opacity-50" size={32} />
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
    TRUE_FIRE: { label: 'True Fire', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', icon: Flame },
    CONTROLLED_FLARING: { label: 'Controlled Flaring', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', icon: ShieldCheck },
    FALSE_ALARM: { label: 'False Alarm', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', icon: AlertTriangle },
    MAINTENANCE_ACTIVITY: { label: 'Maintenance', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', icon: Wrench },
    UNLABELED: { label: 'Pending Review', color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)', icon: Layers }
  };

  const maxTrend = Math.max(1, ...last_7_day_trend.map(t => t.count));

  return (
    <div className="card-glass p-6 border border-slate-700/60 shadow-xl rounded-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <FileCheck2 size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Dataset Quality &amp; Governance
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                Phase 14C
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Verified ground-truth coverage, label distributions, and empirical training data integrity
            </p>
          </div>
        </div>

        {/* Data Integrity Score */}
        <div className="flex items-center gap-2 bg-slate-900/80 px-3.5 py-1.5 rounded-lg border border-slate-700/80">
          <span className="text-xs text-slate-400">Data Integrity:</span>
          <span className="text-sm font-bold text-emerald-400">
            {data_integrity_score.toFixed(1)}/100
          </span>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Total Incidents</span>
          <div className="text-2xl font-bold text-slate-100">{total_incidents}</div>
          <span className="text-[11px] text-slate-500">Clusters &amp; historical</span>
        </div>

        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Human-Verified</span>
          <div className="text-2xl font-bold text-emerald-400">{total_labeled_incidents}</div>
          <span className="text-[11px] text-slate-500">Analyst reviewed</span>
        </div>

        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Verified Coverage</span>
          <div className="text-2xl font-bold text-sky-400">{verified_coverage_pct.toFixed(1)}%</div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-sky-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, verified_coverage_pct)}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Quality Modifications</span>
          <div className="text-2xl font-bold text-amber-400">{edited_labels_count}</div>
          <span className="text-[11px] text-slate-500">Audit-tracked edits</span>
        </div>
      </div>

      {/* Label Distribution Bar & Legend */}
      <div className="mb-6 bg-slate-900/40 p-4 rounded-lg border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Operational Label Distribution
          </span>
          <span className="text-xs text-slate-400">
            {total_labeled_incidents} of {total_incidents} classified
          </span>
        </div>

        {/* Multi-color segment bar */}
        <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex mb-3">
          {Object.entries(label_distribution).map(([key, count]) => {
            if (count === 0) return null;
            const pct = (count / Math.max(1, total_incidents)) * 100;
            const cfg = classConfig[key] || { color: '#64748B' };
            return (
              <div 
                key={key}
                style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                title={`${cfg.label}: ${count} (${pct.toFixed(1)}%)`}
                className="h-full transition-all duration-300"
              />
            );
          })}
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(label_distribution).map(([key, count]) => {
            const cfg = classConfig[key] || { label: key, color: '#64748B', bg: 'rgba(100,116,139,0.1)' };
            const Icon = cfg.icon || Layers;
            return (
              <div 
                key={key} 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs"
                style={{ backgroundColor: cfg.bg, borderColor: `${cfg.color}40`, color: cfg.color }}
              >
                <Icon size={13} />
                <span className="font-medium">{cfg.label}:</span>
                <span className="font-bold">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Columns: Facility Distribution & 7-Day Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Facilities */}
        <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-800">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Building2 size={14} className="text-sky-400" />
            Top Labeled Industrial Facilities
          </h4>
          {facility_distribution.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">No facilities labeled yet.</p>
          ) : (
            <div className="space-y-2">
              {facility_distribution.slice(0, 4).map((fac, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-0">
                  <span className="text-slate-300 truncate max-w-[200px]" title={fac.facility_name}>
                    {fac.facility_name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-400 font-mono font-medium">
                    {fac.count} {fac.count === 1 ? 'label' : 'labels'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7-Day Activity Trend */}
        <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-800">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-emerald-400" />
            Last 7-Day Review Activity
          </h4>
          <div className="flex items-end justify-between gap-1.5 h-20 pt-2">
            {last_7_day_trend.map((day, idx) => {
              const heightPct = maxTrend > 0 ? (day.count / maxTrend) * 100 : 0;
              const dateLabel = day.date ? day.date.slice(5) : `D-${idx}`;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <span className="text-[10px] text-slate-400 font-mono">{day.count}</span>
                  <div 
                    className="w-full max-w-[24px] bg-emerald-500/30 hover:bg-emerald-500/50 rounded-t transition-all duration-300 border-t-2 border-emerald-400"
                    style={{ height: `${Math.max(8, heightPct)}%` }}
                    title={`${day.date}: ${day.count} reviews`}
                  />
                  <span className="text-[9px] text-slate-500 truncate w-full text-center">{dateLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
