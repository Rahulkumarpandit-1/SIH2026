import React, { useState, useEffect } from 'react';
import { Building2, Flame, ShieldAlert, CheckCircle2, History, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { apiService } from '../services/api';

export const FacilityHistoryCard = ({ facilityName }) => {
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (!facilityName) return;
    let isMounted = true;
    setLoading(true);

    apiService.getFacilityHistory(facilityName)
      .then((data) => {
        if (isMounted) {
          setHistoryData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [facilityName]);

  if (!facilityName) return null;

  const totalIncidents = historyData?.total_incidents ?? 0;
  const verifiedFires = historyData?.verified_fires ?? 0;
  const falseAlarms = historyData?.false_alarms ?? 0;
  const controlledFlaring = historyData?.controlled_flaring ?? 0;
  const highestFrp = historyData?.highest_recorded_frp ?? 0.0;
  const avgRisk = historyData?.average_risk_score ?? 0.0;
  const avgAbnormality = historyData?.average_abnormality_score ?? 0.0;
  const lastIncident = historyData?.last_incident_date ?? 'No previous records';
  const pastIncidents = historyData?.historical_incidents ?? [];

  return (
    <section className="report-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <div>
          <span className="report-section-heading" style={{ marginBottom: 0 }}>
            05 &bull; Facility Historical Intelligence &amp; Precedent
          </span>
          <span className="text-secondary" style={{ display: 'block', fontSize: '0.8rem', marginTop: '0.15rem' }}>
            Historical track record for <strong>{facilityName}</strong>
          </span>
        </div>

        {totalIncidents > 0 && (
          <span className="pill-badge pill-neutral font-mono" style={{ fontSize: '0.78rem' }}>
            {totalIncidents} Cumulative Incident{totalIncidents === 1 ? '' : 's'} Logged
          </span>
        )}
      </div>

      {loading && (
        <div className="text-muted" style={{ padding: '1rem 0', fontSize: '0.85rem' }}>
          Querying historical installation track record...
        </div>
      )}

      {!loading && (
        <>
          {/* Key Metric Cards */}
          <div className="report-data-grid">
            <div className="report-data-item">
              <span className="report-data-label">Total Incidents</span>
              <span className="report-data-val font-mono">{totalIncidents}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Registered physical events</span>
            </div>

            <div className="report-data-item">
              <span className="report-data-label">Verified Fires</span>
              <span className="report-data-val font-mono text-critical">{verifiedFires}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Confirmed actual fire accidents</span>
            </div>

            <div className="report-data-item">
              <span className="report-data-label">False Alarms</span>
              <span className="report-data-val font-mono text-success">{falseAlarms}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Solar glare / thermal artifacts</span>
            </div>

            <div className="report-data-item">
              <span className="report-data-label">Controlled Flaring</span>
              <span className="report-data-val font-mono text-warning">{controlledFlaring}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Routine operational flaring</span>
            </div>

            <div className="report-data-item">
              <span className="report-data-label">Highest Recorded FRP</span>
              <span className="report-data-val font-mono text-critical">{highestFrp.toFixed(1)} MW</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Maximum historical thermal output</span>
            </div>

            <div className="report-data-item">
              <span className="report-data-label">Last Incident Date</span>
              <span className="report-data-val font-mono">{lastIncident}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Most recent precedent event</span>
            </div>
          </div>

          {/* Average Risk & Abnormality Context */}
          <div style={{
            marginTop: '0.85rem',
            padding: '0.75rem 1rem',
            background: 'var(--bg-secondary, #F8FAFC)',
            borderRadius: '6px',
            border: '1px solid var(--border-divider, #E2E8F0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            fontSize: '0.82rem'
          }}>
            <div>
              <span className="text-muted">Facility Average Risk Score: </span>
              <strong className="font-mono">{avgRisk.toFixed(1)} / 100</strong>
              <span className="text-muted" style={{ margin: '0 0.5rem' }}>&bull;</span>
              <span className="text-muted">Average Abnormality Score: </span>
              <strong className="font-mono">{avgAbnormality.toFixed(1)} / 100</strong>
            </div>

            {pastIncidents.length > 0 && (
              <button
                onClick={() => setShowList(!showList)}
                className="btn-text-link"
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}
              >
                <span>{showList ? 'Hide Precedent Table' : `View ${pastIncidents.length} Precedent Record${pastIncidents.length === 1 ? '' : 's'}`}</span>
                {showList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>

          {/* Collapsible Precedent Incidents Table */}
          {showList && pastIncidents.length > 0 && (
            <div style={{ marginTop: '0.85rem', overflowX: 'auto', border: '1px solid var(--border-divider, #E2E8F0)', borderRadius: '6px' }}>
              <table className="data-table-clean" style={{ width: '100%', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary, #F8FAFC)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Incident UUID</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Date</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Risk Score</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Peak FRP</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Temporal Status</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Investigation Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pastIncidents.map((p, idx) => (
                    <tr key={p.incident_uuid || idx} style={{ borderTop: '1px solid var(--border-divider, #E2E8F0)' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }} className="font-mono font-bold">
                        {p.incident_uuid}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }} className="font-mono text-muted">
                        {p.first_detected?.slice(0, 10)}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }} className="font-mono">
                        {p.risk_score?.toFixed(1)}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }} className="font-mono">
                        {p.peak_frp?.toFixed(1)} MW
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <span className="status-indicator-tag neutral" style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>
                          {p.temporal_status}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <span className={`status-indicator-tag ${
                          p.status === 'VERIFIED_FIRE' ? 'critical' : p.status === 'FALSE_ALARM' ? 'success' : 'neutral'
                        }`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default FacilityHistoryCard;
