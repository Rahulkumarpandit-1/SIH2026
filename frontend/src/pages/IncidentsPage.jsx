import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ShieldAlert, CheckCircle2, Radio, Info, Clock, Calendar, RefreshCw, Database } from 'lucide-react';
import { formatToIST, formatRelativeAge, deriveConsistentTemporalMetrics } from '../utils/dateUtils';
import DataStatusBadge from '../components/DataStatusBadge';
import { getDataStatus } from '../utils/dataProvenance';
import { OperationalPriorityBadge, calculateOperationalPriority, compareOperationalPriority } from '../utils/priorityEngine';

export const IncidentsPage = ({ riskData = [], onOpenIncidentDetail }) => {
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedTemporal, setSelectedTemporal] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedDataStatus, setSelectedDataStatus] = useState('OPERATIONAL'); // Default to OPERATIONAL (LIVE + RECENT)
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('operational_priority');
  const [sortAsc, setSortAsc] = useState(false);

  const safeRiskData = Array.isArray(riskData) ? riskData : [];

  const classifications = useMemo(() => {
    const set = new Set(safeRiskData.map((r) => r.incident_classification).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [safeRiskData]);

  const filteredIncidents = useMemo(() => {
    return safeRiskData.filter((item) => {
      // Risk level filter
      if (selectedRisk !== 'ALL' && item.risk_level !== selectedRisk) return false;

      // Operational Priority filter (multi-signal synthesis)
      if (selectedPriority !== 'ALL') {
        const op = calculateOperationalPriority(item);
        if (op.level !== selectedPriority) return false;
      }

      // Classification filter
      if (selectedClass !== 'ALL' && item.incident_classification !== selectedClass) return false;

      // Temporal status filter (strictly derived from 4-tier model)
      if (selectedTemporal !== 'ALL') {
        const { status: itemTemporal } = getDataStatus(item);
        if (selectedTemporal === 'LIVE' || selectedTemporal === 'RECENTLY_OBSERVED' || selectedTemporal === 'ACTIVE') {
          if (itemTemporal !== 'LIVE') return false;
        } else if (itemTemporal !== selectedTemporal) {
          return false;
        }
      }

      // Investigation status filter
      if (selectedStatus !== 'ALL') {
        const itemStatus = (item.status || 'NEW').toUpperCase();
        if (itemStatus !== selectedStatus) return false;
      }

      // Data Status filter (provenance 4-tier model)
      if (selectedDataStatus === 'OPERATIONAL') {
        const { status: ds } = getDataStatus(item);
        if (ds !== 'LIVE' && ds !== 'RECENT') return false;
      } else if (selectedDataStatus !== 'ALL') {
        const { status: ds } = getDataStatus(item);
        if (ds !== selectedDataStatus) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = item.cluster_id?.toLowerCase().includes(q);
        const matchUuid = item.incident_uuid?.toLowerCase().includes(q);
        const matchFacility = item.nearest_facility_name?.toLowerCase().includes(q);
        const matchAction = item.action_code?.toLowerCase().includes(q);
        const matchContext = item.spatial_context?.toLowerCase().includes(q);
        if (!matchId && !matchUuid && !matchFacility && !matchAction && !matchContext) return false;
      }
      return true;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'operational_priority') {
        const cmp = compareOperationalPriority(a, b);
        return sortAsc ? -cmp : cmp;
      }

      // Handle nested telemetry or date sorting
      if (sortField === 'max_frp') {
        valA = a.telemetry?.max_frp ?? 0;
        valB = b.telemetry?.max_frp ?? 0;
      } else if (sortField === 'distance') {
        valA = a.telemetry?.distance_to_industry_meters ?? 0;
        valB = b.telemetry?.distance_to_industry_meters ?? 0;
      } else if (sortField === 'persistence') {
        valA = a.telemetry?.persistence_ratio ?? 0;
        valB = b.telemetry?.persistence_ratio ?? 0;
      } else if (sortField === 'detections') {
        valA = a.telemetry?.total_detections ?? a.detection_count ?? 1;
        valB = b.telemetry?.total_detections ?? b.detection_count ?? 1;
      } else if (sortField === 'age') {
        valA = a.incident_age_hours ?? 0;
        valB = b.incident_age_hours ?? 0;
      } else if (sortField === 'first_detected' || sortField === 'last_detected') {
        valA = new Date(a[sortField] || 0).getTime();
        valB = new Date(b[sortField] || 0).getTime();
      }

      valA = valA ?? 0;
      valB = valB ?? 0;

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [safeRiskData, selectedRisk, selectedPriority, selectedClass, selectedTemporal, selectedStatus, selectedDataStatus, searchQuery, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const formatShortDate = (isoStr) => {
    if (!isoStr) return '--:--';
    try {
      const d = new Date(isoStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const m = months[d.getUTCMonth()];
      const day = d.getUTCDate();
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      return `${m} ${day}, ${hh}:${mm} UTC`;
    } catch {
      return isoStr.slice(5, 16);
    }
  };

  const formatAge = (hours) => {
    if (hours === null || hours === undefined || hours === 0) return '0.0h';
    if (hours >= 24) return `${(hours / 24).toFixed(1)}d`;
    return `${hours.toFixed(1)}h`;
  };

  return (
    <div className="incidents-page">
      {/* Page Header */}
      <div className="page-header-block" style={{ marginBottom: '1.5rem' }}>
        <div className="section-tag">INVESTIGATION MANAGEMENT &bull; TEMPORAL INTELLIGENCE &bull; SIH26162</div>
        <h1 className="section-heading-lg">Prioritized Incident Queue</h1>
        <p className="section-subtext">
          Satellite thermal clusters prioritized by deterministic multi-signal risk and observation freshness.
          Select any incident record to open the complete scientific intelligence investigation report.
        </p>
      </div>

      {/* Observation-Derived Scientific Notice */}
      <div className="alert-callout-neutral" style={{ marginBottom: '1.25rem' }}>
        <div className="callout-icon text-info"><Info size={20} /></div>
        <div style={{ fontSize: '0.84rem', lineHeight: 1.55 }}>
          <strong>Observation-Derived Telemetry:</strong> Temporal classification (
          <span className="pill-badge pill-neutral font-mono" style={{ margin: '0 0.25rem', fontSize: '0.72rem' }}>LIVE (&le;24h)</span>,
          <span className="pill-badge pill-neutral font-mono" style={{ margin: '0 0.25rem', fontSize: '0.72rem' }}>RECENT (24h–7d)</span>,
          <span className="pill-badge pill-neutral font-mono" style={{ margin: '0 0.25rem', fontSize: '0.72rem' }}>HISTORICAL (&gt;7d)</span>,
          <span className="pill-badge pill-neutral font-mono" style={{ margin: '0 0.25rem', fontSize: '0.72rem' }}>⚠ DEMO DATA</span>
          ) is derived strictly from verified orbital infrared satellite overpasses (NASA FIRMS) and does not represent real-time continuous ground confirmation.
        </div>
      </div>

      {/* Enhanced Multi-Tier Filter Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
        {/* Search and Risk Filters */}
        <div className="table-toolbar-clean" style={{ flexWrap: 'wrap', gap: '0.6rem' }}>
          <input
            type="text"
            placeholder="Search by facility name, cluster ID, or UUID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="clean-search-input"
            style={{ minWidth: '260px' }}
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
          </div>

          {/* Investigation Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="select-input"
            style={{ padding: '0.4rem 0.65rem', fontSize: '0.76rem' }}
          >
            <option value="ALL">All Investigation States</option>
            <option value="NEW">NEW</option>
            <option value="UNDER_REVIEW">UNDER REVIEW</option>
            <option value="VERIFIED_FIRE">VERIFIED FIRE</option>
            <option value="FALSE_ALARM">FALSE ALARM</option>
            <option value="CONTROLLED_FLARING">CONTROLLED FLARING</option>
          </select>

          {/* Spatial Landuse Classification */}
          {classifications.length > 2 && (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="select-input"
              style={{ padding: '0.4rem 0.65rem', fontSize: '0.76rem' }}
            >
              {classifications.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'All Landuses' : c}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Operational Incident Priority Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <span className="text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <ShieldAlert size={12} /> Op Priority:
          </span>
          {[
            { label: 'All Priorities', val: 'ALL' },
            { label: 'CRITICAL', val: 'CRITICAL', color: '#D92D20' },
            { label: 'HIGH', val: 'HIGH', color: '#F79009' },
            { label: 'MEDIUM', val: 'MEDIUM', color: '#2E90FA' },
            { label: 'LOW', val: 'LOW', color: '#667085' },
          ].map((t) => (
            <button
              key={t.val}
              onClick={() => setSelectedPriority(t.val)}
              className={`filter-btn-text ${selectedPriority === t.val ? 'active' : ''}`}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
                color: selectedPriority === t.val ? t.color : undefined,
                borderColor: selectedPriority === t.val && t.color ? t.color : undefined,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Data Status (Provenance 4-Tier) Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <span className="text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Database size={12} /> Recency Tier:
          </span>
          {[
            { label: '⚡ OPERATIONAL (LIVE + RECENT)', val: 'OPERATIONAL', color: '#10B981' },
            { label: '● LIVE (≤24h)', val: 'LIVE', color: '#10B981' },
            { label: '● RECENT (24h-7d)', val: 'RECENT', color: '#3B82F6' },
            { label: '● HISTORICAL (>7d)', val: 'HISTORICAL', color: '#6B7280' },
            { label: '⚠ DEMO DATA', val: 'DEMO', color: '#F59E0B' },
            { label: 'ALL RECORDS', val: 'ALL' },
          ].map((t) => (
            <button
              key={t.val}
              onClick={() => setSelectedDataStatus(t.val)}
              className={`filter-btn-text ${selectedDataStatus === t.val ? 'active' : ''}`}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
                color: selectedDataStatus === t.val ? t.color : undefined,
                borderColor: selectedDataStatus === t.val && t.color ? t.color : undefined,
                fontWeight: selectedDataStatus === t.val ? 700 : 500,
              }}
            >
              {t.label}
            </button>
          ))}
          <span className="text-muted" style={{ marginLeft: 'auto', fontSize: '0.76rem' }}>
            Showing <strong>{filteredIncidents.length}</strong> of {safeRiskData.length} records
          </span>
        </div>

        {/* Temporal Intelligence Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <span className="text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.72rem' }}>
            Temporal Status:
          </span>
          {[
            { label: 'All Windows', val: 'ALL' },
            { label: 'LIVE (≤24h)', val: 'LIVE' },
            { label: 'RECENT (24h–7d)', val: 'RECENT' },
            { label: 'HISTORICAL (>7d)', val: 'HISTORICAL' }
          ].map((t) => (
            <button
              key={t.val}
              onClick={() => setSelectedTemporal(t.val)}
              className={`filter-btn-text ${selectedTemporal === t.val ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clean Incident Table with Enhanced Temporal Columns */}
      <div className="table-responsive">
        <table className="clean-table" style={{ fontSize: '0.8rem' }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('rank')} style={{ cursor: 'pointer' }}>
                Rank
              </th>
              <th>Cluster / UUID</th>
              <th onClick={() => handleSort('risk_score')} style={{ cursor: 'pointer' }}>
                Risk Score
              </th>
              <th>Tier</th>
              <th onClick={() => handleSort('operational_priority')} style={{ cursor: 'pointer' }}>
                Op Priority {sortField === 'operational_priority' && (sortAsc ? '▲' : '▼')}
              </th>
              <th>Data Status</th>
              <th>Temporal Status</th>
              <th>Facility &amp; Regional Context</th>
              <th onClick={() => handleSort('first_detected')} style={{ cursor: 'pointer' }}>
                First Detected
              </th>
              <th onClick={() => handleSort('last_detected')} style={{ cursor: 'pointer' }}>
                Last Detected
              </th>
              <th onClick={() => handleSort('age')} style={{ cursor: 'pointer' }}>
                Observation Age
              </th>
              <th onClick={() => handleSort('detections')} style={{ cursor: 'pointer' }}>
                Passes
              </th>
              <th onClick={() => handleSort('max_frp')} style={{ cursor: 'pointer' }}>
                Peak FRP
              </th>
              <th>Action Directive</th>
              <th>Investigation</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={15} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No incidents matching the current search, temporal status, and investigation filter criteria.
                </td>
              </tr>
            ) : (
              filteredIncidents.map((item) => {
                const isCrit = item.risk_level === 'CRITICAL';
                const isHigh = item.risk_level === 'HIGH';
                const isMod = item.risk_level === 'MODERATE';
                const maxFrp = item.telemetry?.max_frp ?? item.peak_frp ?? 0.0;
                const detections = item.telemetry?.total_detections ?? item.detection_count ?? 1;
                const temporal = deriveConsistentTemporalMetrics(item);
                const tempStatus = temporal.temporal_status;
                const isRecentObs = tempStatus === 'RECENTLY_OBSERVED' || tempStatus === 'ACTIVE';
                const isRecent = tempStatus === 'RECENT';
                const invStatus = item.status || 'NEW';

                return (
                  <tr key={item.incident_uuid || item.cluster_id} onClick={() => onOpenIncidentDetail(item)}>
                    <td className="font-mono text-muted">#{item.rank}</td>
                    <td>
                      <div className="font-mono font-bold" style={{ fontSize: '0.82rem' }}>
                        {item.cluster_id}
                      </div>
                      {item.incident_uuid && item.incident_uuid !== item.cluster_id && (
                        <span className="font-mono text-muted" style={{ display: 'block', fontSize: '0.68rem' }}>
                          {item.incident_uuid.length > 22 ? `${item.incident_uuid.slice(0, 20)}...` : item.incident_uuid}
                        </span>
                      )}
                    </td>
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
                      <OperationalPriorityBadge incident={item} size="sm" />
                    </td>
                    <td className="data-status-col">
                      <DataStatusBadge incident={item} size="sm" />
                    </td>
                    <td>
                      <span className={`status-indicator-tag ${
                        tempStatus === 'LIVE' ? 'critical' : tempStatus === 'RECENT' ? 'info' : tempStatus === 'DEMO' ? 'warning' : 'neutral'
                      }`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', whiteSpace: 'nowrap' }}>
                        {tempStatus === 'DEMO' ? '⚠ DEMO DATA' : tempStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span className="font-bold">{item.nearest_facility_name}</span>
                      <span className="text-secondary" style={{ display: 'block', fontSize: '0.72rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--primary, #38BDF8)', marginRight: '4px' }}>
                          📍 {item.state || 'India'}
                        </span>
                        &bull; {item.spatial_context}
                      </span>
                    </td>
                    <td className="font-mono text-secondary" style={{ fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                      {formatToIST(temporal.first_detected || item.first_detected)}
                    </td>
                    <td className="font-mono text-secondary" style={{ fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                      {formatToIST(temporal.last_detected || item.last_detected)}
                    </td>
                    <td className="font-mono text-secondary" style={{ fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                      {temporal.formatted_freshness}
                    </td>
                    <td className="font-mono text-secondary" style={{ fontSize: '0.76rem' }}>
                      {detections}
                    </td>
                    <td className="font-mono font-bold" style={{ whiteSpace: 'nowrap' }}>
                      {maxFrp.toFixed(1)} MW
                    </td>
                    <td className="font-mono text-secondary" style={{ fontSize: '0.74rem' }}>
                      {item.action_directive || item.action_code?.replace(/_/g, ' ')}
                    </td>
                    <td>
                      <span className={`status-indicator-tag ${
                        invStatus === 'VERIFIED_FIRE' ? 'critical' : invStatus === 'FALSE_ALARM' ? 'success' : invStatus === 'UNDER_REVIEW' ? 'warning' : 'neutral'
                      }`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', whiteSpace: 'nowrap' }}>
                        {invStatus}
                      </span>
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
