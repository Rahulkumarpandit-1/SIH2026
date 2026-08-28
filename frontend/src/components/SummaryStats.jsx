import React from 'react';
import { Eye, Layers, AlertOctagon, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

export const SummaryStats = ({ summary }) => {
  return (
    <section className="summary-grid">
      <div className="stat-card">
        <div className="stat-header">
          <span>Total Observations</span>
          <Eye size={16} />
        </div>
        <div className="stat-value">
          {summary?.total_observations ?? '—'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <span>Detected Clusters</span>
          <Layers size={16} />
        </div>
        <div className="stat-value">
          {summary?.total_clusters ?? '—'}
        </div>
      </div>

      <div className="stat-card critical">
        <div className="stat-header">
          <span>Critical Incidents</span>
          <AlertOctagon size={16} />
        </div>
        <div className="stat-value">
          {summary?.critical_count ?? 0}
        </div>
      </div>

      <div className="stat-card high">
        <div className="stat-header">
          <span>High Risk</span>
          <AlertTriangle size={16} />
        </div>
        <div className="stat-value">
          {summary?.high_count ?? 0}
        </div>
      </div>

      <div className="stat-card moderate">
        <div className="stat-header">
          <span>Moderate Risk</span>
          <AlertCircle size={16} />
        </div>
        <div className="stat-value">
          {summary?.moderate_count ?? 0}
        </div>
      </div>

      <div className="stat-card low">
        <div className="stat-header">
          <span>Low Risk</span>
          <CheckCircle2 size={16} />
        </div>
        <div className="stat-value">
          {summary?.low_count ?? 0}
        </div>
      </div>
    </section>
  );
};

export default SummaryStats;
