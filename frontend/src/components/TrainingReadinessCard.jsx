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
  ArrowRight,
  Info
} from 'lucide-react';

export const TrainingReadinessCard = ({ readinessData, loading = false }) => {
  if (loading) {
    return (
      <div className="card-glass p-6 animate-pulse">
        <div className="h-6 bg-slate-700/50 rounded w-1/3 mb-4"></div>
        <div className="h-24 bg-slate-800/40 rounded mb-4"></div>
        <div className="grid grid-cols-5 gap-3">
          <div className="h-16 bg-slate-800/30 rounded"></div>
          <div className="h-16 bg-slate-800/30 rounded"></div>
          <div className="h-16 bg-slate-800/30 rounded"></div>
          <div className="h-16 bg-slate-800/30 rounded"></div>
          <div className="h-16 bg-slate-800/30 rounded"></div>
        </div>
      </div>
    );
  }

  if (!readinessData) {
    return (
      <div className="card-glass p-6 text-center text-slate-400">
        <Cpu className="mx-auto mb-2 opacity-50" size={32} />
        <p>No machine learning readiness evaluation available.</p>
      </div>
    );
  }

  const {
    readiness_state = 'NOT_READY',
    readiness_score = 0.0,
    is_trainable = false,
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
      color: '#EF4444',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.3)',
      icon: ShieldAlert
    },
    LIMITED_TRAINING: {
      label: 'LIMITED EXPERIMENTAL TRAINING',
      sublabel: 'Suitable for benchmark evaluations',
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
      icon: AlertCircle
    },
    PRODUCTION_READY: {
      label: 'PRODUCTION TRAINING READY',
      sublabel: 'Full multi-region empirical sufficiency',
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.3)',
      icon: ShieldCheck
    }
  };

  const currentCfg = stateConfig[readiness_state] || stateConfig.NOT_READY;
  const StateIcon = currentCfg.icon;

  const dimensionItems = [
    {
      id: 'verified',
      label: 'Verified Volume',
      score: dimensions.total_verified_score ?? 0,
      value: `${dimension_telemetry.verified_count ?? 0} labels`,
      target: '50 target',
      icon: Layers
    },
    {
      id: 'balance',
      label: 'Class Balance',
      score: dimensions.class_balance_score ?? 0,
      value: `${dimension_telemetry.classes_represented ?? 0}/4 classes`,
      target: '4 balanced',
      icon: Scale
    },
    {
      id: 'facility',
      label: 'Facility Diversity',
      score: dimensions.facility_diversity_score ?? 0,
      value: `${dimension_telemetry.facility_count ?? 0} sites`,
      target: '5+ sites',
      icon: Building2
    },
    {
      id: 'region',
      label: 'Regional Diversity',
      score: dimensions.regional_diversity_score ?? 0,
      value: `${dimension_telemetry.region_count ?? 0} regions`,
      target: '2+ corridors',
      icon: MapPin
    },
    {
      id: 'reviewer',
      label: 'Reviewer Diversity',
      score: dimensions.reviewer_diversity_score ?? 0,
      value: `${dimension_telemetry.reviewer_count ?? 0} analysts`,
      target: '3+ reviewers',
      icon: Users
    }
  ];

  return (
    <div className="card-glass p-6 border border-slate-700/60 shadow-xl rounded-xl">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div 
            className="p-2.5 rounded-lg border"
            style={{ backgroundColor: currentCfg.bg, borderColor: currentCfg.border, color: currentCfg.color }}
          >
            <StateIcon size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-100">
                Machine Learning Training Readiness Engine
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-medium">
                Phase 14D
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Honest 5-dimensional evaluation of empirical dataset sufficiency for supervised models
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div 
          className="px-4 py-2 rounded-lg border flex items-center gap-2"
          style={{ backgroundColor: currentCfg.bg, borderColor: currentCfg.border }}
        >
          <StateIcon size={18} style={{ color: currentCfg.color }} />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: currentCfg.color }}>
              {currentCfg.label}
            </div>
            <div className="text-[10px] text-slate-400">{currentCfg.sublabel}</div>
          </div>
        </div>
      </div>

      {/* Composite Readiness Score Gauge */}
      <div className="mb-6 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Empirical ML Training Readiness Score
          </span>
          <span className="text-base font-bold font-mono" style={{ color: currentCfg.color }}>
            {readiness_score.toFixed(1)} / 100
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden mb-2">
          <div 
            className="h-full rounded-full transition-all duration-700"
            style={{ 
              width: `${Math.max(3, Math.min(100, readiness_score))}%`, 
              backgroundColor: currentCfg.color 
            }}
          />
        </div>

        {/* Target ticks */}
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>0 (Not Ready)</span>
          <span className="text-amber-400">40 (Limited Experimental)</span>
          <span className="text-emerald-400">75+ (Production Ready)</span>
          <span>100</span>
        </div>
      </div>

      {/* 5-Dimensional Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        {dimensionItems.map((dim) => {
          const Icon = dim.icon;
          const scoreColor = 
            dim.score >= 75 ? '#10B981' :
            dim.score >= 40 ? '#F59E0B' :
            '#EF4444';

          return (
            <div key={dim.id} className="bg-slate-900/40 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-medium truncate">{dim.label}</span>
                <Icon size={14} className="text-slate-400 shrink-0" />
              </div>

              <div className="text-sm font-bold text-slate-100 font-mono mb-1">
                {dim.value}
              </div>

              {/* Dimension mini-bar */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1">
                <div 
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(5, dim.score)}%`, backgroundColor: scoreColor }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-mono">{dim.score.toFixed(0)}%</span>
                <span className="text-slate-500">{dim.target}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explanation & Bottlenecks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Narrative */}
        <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-800/80">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Info size={14} className="text-sky-400" />
            Scientific Readiness Assessment
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed mb-3">
            {explanation}
          </p>
          <div className="p-2.5 rounded bg-slate-800/50 border border-slate-700/50 text-xs text-slate-300">
            <strong className="text-sky-400 block mb-0.5">Operational Guidance:</strong>
            {recommendation}
          </div>
        </div>

        {/* Actionable Bottlenecks */}
        <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-800/80">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertCircle size={14} className="text-amber-400" />
            Identified Training Bottlenecks ({bottlenecks.length})
          </h4>
          {bottlenecks.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400 py-2">
              <CheckCircle2 size={16} />
              <span>No critical bottlenecks detected. Dataset is fully ready for supervised training.</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {bottlenecks.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-amber-400 font-bold shrink-0 mt-0.5">•</span>
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
