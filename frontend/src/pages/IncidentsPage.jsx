import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const IncidentsPage = ({ riskData = [], onOpenIncidentDetail }) => {
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('risk_score');
  const [sortAsc, setSortAsc] = useState(false);

  const classifications = useMemo(() => {
    const set = new Set(riskData.map((r) => r.incident_classification).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [riskData]);

  const filteredIncidents = useMemo(() => {
    return riskData.filter((item) => {
      if (selectedRisk !== 'ALL' && item.risk_level !== selectedRisk) return false;
      if (selectedClass !== 'ALL' && item.incident_classification !== selectedClass) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = item.cluster_id?.toLowerCase().includes(q);
        const matchFacility = item.nearest_facility_name?.toLowerCase().includes(q);
        const matchAction = item.action_code?.toLowerCase().includes(q);
        const matchContext = item.spatial_context?.toLowerCase().includes(q);
        if (!matchId && !matchFacility && !matchAction && !matchContext) return false;
      }
      return true;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle nested telemetry sorting
      if (sortField === 'max_frp') {
        valA = a.telemetry?.max_frp ?? 0;
        valB = b.telemetry?.max_frp ?? 0;
      } else if (sortField === 'distance') {
        valA = a.telemetry?.distance_to_industry_meters ?? 0;
        valB = b.telemetry?.distance_to_industry_meters ?? 0;
      } else if (sortField === 'persistence') {
        valA = a.telemetry?.persistence_ratio ?? 0;
        valB = b.telemetry?.persistence_ratio ?? 0;
      }

      valA = valA ?? 0;
      valB = valB ?? 0;

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [riskData, selectedRisk, selectedClass, searchQuery, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="incidents-page">
      {/* Page Header */}
      <div className="page-header-block" style={{ marginBottom: '2rem' }}>
        <div className="section-tag">OPERATIONAL INVESTIGATION QUEUE &bull; SIH26162</div>
        <h1 className="section-heading-lg">Prioritized Incident Queue</h1>
        <p className="section-subtext">
          Live thermal cluster queue prioritized by deterministic multi-signal risk calculation. 
          Select any incident record to open the complete scientific intelligence investigation report.
        </p>
      </div>

      {/* Clean Toolbar */}
      <div className="table-toolbar-clean">
        <input
          type="text"
          placeholder="Search by facility name, cluster ID, or action code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="clean-search-input"
        />

        <div className="filter-button-group">
          {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((tier) => (
            <button
              key={tier}
              className={`filter-btn-text ${selectedRisk === tier ? 'active' : ''}`}
              onClick={() => setSelectedRisk(tier)}
            >
              {tier}
            </button>
          ))}

          {classifications.length > 2 && (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="select-input"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
            >
              {classifications.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'All Classifications' : c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Clean Incident Table */}
      <div className="table-responsive">
        <table className="clean-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('rank')} style={{ cursor: 'pointer' }}>
                Rank
              </th>
              <th>Cluster ID</th>
              <th onClick={() => handleSort('risk_score')} style={{ cursor: 'pointer' }}>
                Risk Score
              </th>
              <th>Tier</th>
              <th>Facility &amp; Spatial Context</th>
              <th onClick={() => handleSort('max_frp')} style={{ cursor: 'pointer' }}>
                Peak FRP
              </th>
              <th onClick={() => handleSort('distance')} style={{ cursor: 'pointer' }}>
                Boundary Dist
              </th>
              <th onClick={() => handleSort('persistence')} style={{ cursor: 'pointer' }}>
                Persistence
              </th>
              <th>Action Code</th>
              <th>Ground Truth</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No incidents matching the current search and filter criteria.
                </td>
              </tr>
            ) : (
              filteredIncidents.map((item) => {
                const isCrit = item.risk_level === 'CRITICAL';
                const isHigh = item.risk_level === 'HIGH';
                const isMod = item.risk_level === 'MODERATE';
                const maxFrp = item.telemetry?.max_frp ?? 0.0;
                const dist = item.telemetry?.distance_to_industry_meters ?? 0.0;
                const pRatio = item.telemetry?.persistence_ratio ?? 0.0;

                return (
                  <tr key={item.cluster_id} onClick={() => onOpenIncidentDetail(item)}>
                    <td className="font-mono text-muted">#{item.rank}</td>
                    <td className="font-mono font-bold">{item.cluster_id}</td>
                    <td>
                      <strong className={isCrit ? 'text-critical' : isHigh ? 'text-warning' : ''}>
                        {item.risk_score.toFixed(1)} / 100
                      </strong>
                    </td>
                    <td>
                      <span className={`status-indicator-tag ${isCrit ? 'critical' : isMod || isHigh ? 'warning' : 'success'}`}>
                        {item.risk_level}
                      </span>
                    </td>
                    <td>
                      <span className="font-bold">{item.nearest_facility_name}</span>
                      <span className="text-secondary" style={{ display: 'block', fontSize: '0.74rem' }}>
                        {item.spatial_context} &bull; {item.centroid_latitude?.toFixed(3)}°N, {item.centroid_longitude?.toFixed(3)}°E
                      </span>
                    </td>
                    <td className="font-mono">{maxFrp.toFixed(1)} MW</td>
                    <td className="font-mono">
                      {dist === 0 ? (
                        <span className="badge-critical">0 m (Inside)</span>
                      ) : (
                        `${dist.toLocaleString()} m`
                      )}
                    </td>
                    <td className="font-mono">{(pRatio * 100).toFixed(0)}% ({item.telemetry?.active_days_count ?? 1}d)</td>
                    <td className="font-mono text-secondary" style={{ fontSize: '0.78rem' }}>
                      {item.action_code}
                    </td>
                    <td>
                      <span className="pill-badge pill-neutral font-mono">UNLABELED</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IncidentsPage;
