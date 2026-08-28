import React from 'react';
import { ListOrdered, AlertOctagon, Flame } from 'lucide-react';

export const PriorityTriageTable = ({ riskData = [], selectedClusterId, onSelectCluster }) => {
  return (
    <div className="table-card">
      <div className="table-header-row">
        <div className="table-title">
          <ListOrdered size={18} color="var(--accent-cyan)" />
          <span>Incident Prioritization Triage Queue (Sorted by Risk Score DESC)</span>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {riskData.length} Incident Clusters Monitored
        </span>
      </div>

      <table className="triage-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Cluster ID</th>
            <th>Facility / Area</th>
            <th>Max FRP</th>
            <th>Distance to Industry</th>
            <th>Persistence</th>
            <th>Anomaly</th>
            <th>Risk Score</th>
            <th>Action Required</th>
          </tr>
        </thead>
        <tbody>
          {riskData.map((row) => {
            const isSelected = selectedClusterId === row.cluster_id;
            const riskLevel = row.risk_level || 'LOW';
            const dist = row.telemetry?.distance_to_industry_meters ?? row.distance_to_industry_meters ?? 0;
            const pRatio = (row.telemetry?.persistence_ratio ?? row.persistence_ratio ?? 0) * 100;
            const isSpike = row.telemetry?.is_anomaly_spike || row.is_anomaly_spike;

            return (
              <tr 
                key={row.cluster_id} 
                className={isSelected ? 'selected' : ''}
                onClick={() => onSelectCluster(row)}
              >
                <td style={{ fontWeight: 700, color: row.rank === 1 ? 'var(--risk-critical)' : 'var(--text-secondary)' }}>
                  #{row.rank}
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  {row.cluster_id}
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{row.nearest_facility_name || 'Rural Sector'}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.nearest_facility_type || 'unclassified'}</div>
                </td>
                <td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  {(row.telemetry?.max_frp ?? row.max_frp ?? 0).toFixed(1)} MW
                </td>
                <td>
                  {dist <= 0 ? (
                    <span style={{ color: 'var(--risk-critical)', fontWeight: 600 }}>0 m (Inside)</span>
                  ) : (
                    <span>{dist.toFixed(0)} m</span>
                  )}
                </td>
                <td>
                  {pRatio.toFixed(0)}% ({row.telemetry?.active_days_count ?? 1}d)
                </td>
                <td>
                  {isSpike ? (
                    <span style={{ color: 'var(--risk-critical)', fontWeight: 700 }}>YES (Spike)</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Normal</span>
                  )}
                </td>
                <td>
                  <span className={`risk-badge ${riskLevel.toLowerCase()}`}>
                    {riskLevel} • {row.risk_score.toFixed(1)}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>
                  <span style={{ 
                    color: row.action_code === 'EMERGENCY_DISPATCH' ? 'var(--risk-critical)' : 'var(--text-main)',
                    fontSize: '0.78rem'
                  }}>
                    {row.action_code}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PriorityTriageTable;
