import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/api';
import { useRegion } from '../context/RegionContext';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  ShieldCheck, 
  Wrench, 
  HelpCircle, 
  Download, 
  Search, 
  Save, 
  X, 
  Edit3, 
  Filter,
  Check,
  RefreshCw,
  Info,
  History,
  Layers,
  FileCheck2
} from 'lucide-react';
import { DatasetQualityCard } from '../components/DatasetQualityCard';
import { ReviewerAnalyticsCard } from '../components/ReviewerAnalyticsCard';
import { ReviewAuditTimeline } from '../components/ReviewAuditTimeline';

export const GroundTruthReviewPage = () => {
  const { currentRegion } = useRegion();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabelFilter, setSelectedLabelFilter] = useState('ALL');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState('ALL');
  
  // Phase 14 View Tab: 'FEED' | 'GOVERNANCE'
  const [activeTab, setActiveTab] = useState('FEED');
  const [qualityData, setQualityData] = useState(null);
  const [reviewerData, setReviewerData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingGovernance, setLoadingGovernance] = useState(false);
  
  // Selected incident for the review modal
  const [activeIncident, setActiveIncident] = useState(null);
  const [selectedLabel, setSelectedLabel] = useState('TRUE_FIRE');
  const [reviewerName, setReviewerName] = useState(() => {
    return localStorage.getItem('sih-reviewer-name') || 'Dr. R. Sharma (Disaster Cell)';
  });
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  const labelOptions = [
    {
      id: 'TRUE_FIRE',
      label: 'True Fire',
      icon: Flame,
      color: '#EF4444',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: '#EF4444',
      desc: 'Analyst-confirmed true fire incident verified against independent ground truth.'
    },
    {
      id: 'CONTROLLED_FLARING',
      label: 'Controlled Flaring',
      icon: ShieldCheck,
      color: '#3B82F6',
      bg: 'rgba(59, 130, 246, 0.12)',
      border: '#3B82F6',
      desc: 'Routine operational flare stack burn within permitted facility baseline.'
    },
    {
      id: 'MAINTENANCE_ACTIVITY',
      label: 'Maintenance Activity',
      icon: Wrench,
      color: '#A855F7',
      bg: 'rgba(168, 85, 247, 0.12)',
      border: '#A855F7',
      desc: 'Scheduled high-temp shutdown, boiler purge, or startup heat release.'
    },
    {
      id: 'FALSE_ALARM',
      label: 'False Alarm',
      icon: HelpCircle,
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: '#10B981',
      desc: 'Non-combustion reflection, cloud-edge refraction, or sensor artifact.'
    }
  ];

  const fetchFeed = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await apiService.getGroundTruth();
      setFeed(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load ground truth feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchGovernanceData = async () => {
    setLoadingGovernance(true);
    try {
      const [qRes, rRes, aRes] = await Promise.all([
        apiService.getDatasetQuality().catch(() => null),
        apiService.getReviewers().catch(() => null),
        apiService.getReviewAudit().catch(() => [])
      ]);
      if (qRes) setQualityData(qRes);
      if (rRes) setReviewerData(rRes);
      if (Array.isArray(aRes)) setAuditLogs(aRes);
    } catch (err) {
      console.error('Failed to load governance data:', err);
    } finally {
      setLoadingGovernance(false);
    }
  };

  useEffect(() => {
    fetchFeed();
    fetchGovernanceData();
  }, []);

  const handleOpenReview = (item) => {
    setActiveIncident(item);
    setSelectedLabel(item.assigned_label && item.assigned_label !== 'UNLABELED' ? item.assigned_label : 'TRUE_FIRE');
    setReviewNotes(item.review_notes || '');
  };

  const handleCloseReview = () => {
    setActiveIncident(null);
  };

  const handleSaveReview = async (e) => {
    e.preventDefault();
    if (!activeIncident) return;

    const trimmedReviewer = (reviewerName || '').trim();
    if (!trimmedReviewer || trimmedReviewer.length < 2) {
      alert('Reviewer name is required and must be at least 2 characters.');
      return;
    }
    if (['anonymous', 'anon', 'unknown', 'n/a', 'none'].includes(trimmedReviewer.toLowerCase())) {
      alert('Anonymous reviews are prohibited. Please provide a verified analyst identity for ML training governance.');
      return;
    }

    setSaving(true);

    try {
      try {
        localStorage.setItem('sih-reviewer-name', trimmedReviewer);
      } catch (e) {
        // Safe fallback
      }
      const payload = {
        incident_uuid: activeIncident.incident_uuid,
        facility_name: activeIncident.facility_name,
        assigned_label: selectedLabel,
        reviewer_name: trimmedReviewer,
        review_notes: (reviewNotes || '').trim() || null
      };

      if (activeIncident.label_id) {
        await apiService.updateGroundTruthLabel(activeIncident.label_id, {
          assigned_label: selectedLabel,
          reviewer_name: trimmedReviewer,
          review_notes: (reviewNotes || '').trim() || null
        });
      } else {
        await apiService.createGroundTruthLabel(payload);
      }

      setSuccessToast(`Successfully labeled ${activeIncident.incident_uuid} as ${selectedLabel.replace('_', ' ')}!`);
      setTimeout(() => setSuccessToast(null), 4000);
      handleCloseReview();
      await fetchFeed(true);
      await fetchGovernanceData();
    } catch (err) {
      console.error('Failed to save ground-truth review:', err);
      alert('Failed to save ground truth label. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Stats computation
  const stats = useMemo(() => {
    const total = feed.length;
    const labeled = feed.filter((f) => f.assigned_label && f.assigned_label !== 'UNLABELED').length;
    const unlabeled = total - labeled;
    const trueFires = feed.filter((f) => f.assigned_label === 'TRUE_FIRE').length;
    const controlled = feed.filter((f) => f.assigned_label === 'CONTROLLED_FLARING').length;
    return {
      total,
      labeled,
      unlabeled,
      trueFires,
      controlled,
      pct: total > 0 ? Math.round((labeled / total) * 100) : 0
    };
  }, [feed]);

  // Filtered rows
  const filteredFeed = useMemo(() => {
    return feed.filter((item) => {
      if (selectedLabelFilter === 'UNLABELED' && item.assigned_label !== 'UNLABELED') return false;
      if (selectedLabelFilter === 'LABELED' && item.assigned_label === 'UNLABELED') return false;
      if (
        selectedLabelFilter !== 'ALL' &&
        selectedLabelFilter !== 'UNLABELED' &&
        selectedLabelFilter !== 'LABELED' &&
        item.assigned_label !== selectedLabelFilter
      ) {
        return false;
      }
      if (selectedRiskFilter !== 'ALL' && item.risk_level !== selectedRiskFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = item.incident_uuid?.toLowerCase().includes(q);
        const matchFac = item.facility_name?.toLowerCase().includes(q);
        const matchNotes = item.review_notes?.toLowerCase().includes(q);
        const matchReviewer = item.reviewer_name?.toLowerCase().includes(q);
        if (!matchId && !matchFac && !matchNotes && !matchReviewer) return false;
      }
      return true;
    });
  }, [feed, selectedLabelFilter, selectedRiskFilter, searchQuery]);

  const getLabelBadge = (label) => {
    switch (label) {
      case 'TRUE_FIRE':
        return <span className="status-indicator-tag critical font-mono font-bold">TRUE FIRE</span>;
      case 'CONTROLLED_FLARING':
        return <span className="status-indicator-tag info font-mono font-bold" style={{ color: '#3B82F6', borderColor: '#3B82F6' }}>CONTROLLED FLARING</span>;
      case 'MAINTENANCE_ACTIVITY':
        return <span className="status-indicator-tag warning font-mono font-bold" style={{ color: '#A855F7', borderColor: '#A855F7' }}>MAINTENANCE</span>;
      case 'FALSE_ALARM':
        return <span className="status-indicator-tag success font-mono font-bold">FALSE ALARM</span>;
      default:
        return <span className="pill-badge pill-neutral font-mono">UNLABELED</span>;
    }
  };

  return (
    <div className="page-container" style={{ paddingBottom: '4rem' }}>
      {/* Editorial Header */}
      <div className="page-header-block" style={{ marginBottom: '1.5rem' }}>
        <div className="section-tag">PHASE 9 &bull; GROUND TRUTH REVIEW SYSTEM</div>
        <h1 className="section-heading-lg">Ground Truth Review &amp; Labeling</h1>
        <p className="section-subtext">
          Expert human-in-the-loop validation console. Review detected satellite thermal events alongside 
          risk telemetry, meteorological dispersion, and abnormality indices to assign verified training labels for supervised ML.
        </p>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="alert-callout-neutral" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #10B981', background: 'rgba(16, 185, 129, 0.08)' }}>
          <div className="callout-icon text-success"><CheckCircle2 size={20} /></div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{successToast}</div>
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid-4" style={{ marginBottom: '1.75rem', gap: '1rem' }}>
        <div className="report-data-item" style={{ padding: '1.1rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <span className="report-data-label" style={{ fontSize: '0.75rem' }}>Total Monitored Incidents</span>
          <span className="report-data-val font-mono font-bold" style={{ fontSize: '1.8rem' }}>{stats.total}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{currentRegion?.short_name || currentRegion?.name || 'All Monitored Corridors'}</span>
        </div>

        <div className="report-data-item" style={{ padding: '1.1rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <span className="report-data-label" style={{ fontSize: '0.75rem' }}>Verified &amp; Labeled</span>
          <span className="report-data-val font-mono font-bold text-success" style={{ fontSize: '1.8rem' }}>{stats.labeled}</span>
          <div className="track-clean" style={{ height: '6px', marginTop: '0.4rem', background: 'var(--border-subtle)' }}>
            <div className="fill-clean" style={{ width: `${stats.pct}%`, background: '#10B981' }} />
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.3rem', display: 'block' }}>{stats.pct}% verified coverage</span>
        </div>

        <div className="report-data-item" style={{ padding: '1.1rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <span className="report-data-label" style={{ fontSize: '0.75rem' }}>Pending Analyst Review</span>
          <span className="report-data-val font-mono font-bold text-warning" style={{ fontSize: '1.8rem' }}>{stats.unlabeled}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Awaiting human validation</span>
        </div>

        <div className="report-data-item" style={{ padding: '1.1rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span className="report-data-label" style={{ fontSize: '0.75rem' }}>Export Training Dataset</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
              Download labeled CSV for model training
            </span>
          </div>
          <a
            href={apiService.exportGroundTruthCsvUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-black-primary"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 0.8rem', fontSize: '0.8rem', textDecoration: 'none', marginTop: '0.6rem' }}
          >
            <Download size={14} />
            Export Ground Truth CSV
          </a>
        </div>
      </div>

      {/* View Switcher Tabs (Phase 14) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          className={`filter-btn-text ${activeTab === 'FEED' ? 'active' : ''}`}
          onClick={() => setActiveTab('FEED')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem', padding: '0.5rem 1rem', fontWeight: 600 }}
        >
          <Layers size={16} />
          Incident Review Feed ({filteredFeed.length})
        </button>
        <button
          type="button"
          className={`filter-btn-text ${activeTab === 'GOVERNANCE' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('GOVERNANCE');
            fetchGovernanceData();
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem', padding: '0.5rem 1rem', fontWeight: 600 }}
        >
          <FileCheck2 size={16} />
          Dataset Quality &amp; Review Governance
        </button>
      </div>

      {activeTab === 'FEED' ? (
        <>
          {/* Filter & Search Bar */}
          <div className="table-toolbar-clean" style={{ flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ position: 'relative', flex: '1 1 280px' }}>
              <input
                type="text"
                placeholder="Search by cluster ID, facility, notes, or reviewer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="clean-search-input"
                style={{ width: '100%' }}
              />
            </div>

            <div className="filter-button-group" style={{ flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'UNLABELED', label: 'Unlabeled' },
                { id: 'LABELED', label: 'Labeled' },
                { id: 'TRUE_FIRE', label: 'True Fire' },
                { id: 'CONTROLLED_FLARING', label: 'Controlled Flaring' },
                { id: 'MAINTENANCE_ACTIVITY', label: 'Maintenance' },
                { id: 'FALSE_ALARM', label: 'False Alarm' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`filter-btn-text ${selectedLabelFilter === tab.id ? 'active' : ''}`}
                  onClick={() => setSelectedLabelFilter(tab.id)}
                  style={{ fontSize: '0.76rem', padding: '0.35rem 0.65rem' }}
                >
                  {tab.label}
                </button>
              ))}

              <select
                value={selectedRiskFilter}
                onChange={(e) => setSelectedRiskFilter(e.target.value)}
                className="select-input"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem', marginLeft: '0.5rem' }}
              >
                <option value="ALL">All Risk Tiers</option>
                <option value="CRITICAL">Critical Only</option>
                <option value="HIGH">High Only</option>
                <option value="MODERATE">Moderate Only</option>
                <option value="LOW">Low Only</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive" style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Incident UUID</th>
                  <th>Facility &amp; Context</th>
                  <th>Peak FRP</th>
                  <th>Risk Tier</th>
                  <th>Abnormality</th>
                  <th>Weather / Plume</th>
                  <th>Assigned Label</th>
                  <th>Reviewer &amp; Notes</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      <RefreshCw size={20} className="spin-anim" style={{ display: 'inline', marginRight: '0.5rem' }} />
                      Loading ground-truth incident review feed...
                    </td>
                  </tr>
                ) : filteredFeed.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No incidents matching search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredFeed.map((item) => {
                    const isCrit = item.risk_level === 'CRITICAL';
                    const isHigh = item.risk_level === 'HIGH';
                    const abStatus = item.abnormality_detection?.abnormality_status || 'NORMAL';
                    const wx = item.weather_context || {};

                    return (
                      <tr key={item.incident_uuid}>
                        <td className="font-mono font-bold" style={{ fontSize: '0.85rem' }}>
                          {item.incident_uuid}
                        </td>
                        <td>
                          <div className="font-bold" style={{ fontSize: '0.84rem' }}>
                            {item.facility_name}
                          </div>
                          <span className="text-secondary" style={{ fontSize: '0.72rem' }}>
                            {item.distance_to_industry_meters === 0 ? 'Inside Perimeter' : `${item.distance_to_industry_meters.toLocaleString()}m from boundary`}
                          </span>
                        </td>
                        <td className="font-mono font-bold">
                          {item.max_frp.toFixed(1)} MW
                        </td>
                        <td>
                          <span className={`status-indicator-tag ${isCrit ? 'critical' : isHigh ? 'high' : 'success'}`} style={{ fontSize: '0.72rem' }}>
                            {item.risk_level} ({item.risk_score.toFixed(0)})
                          </span>
                        </td>
                        <td>
                          <div className="font-mono font-bold" style={{ fontSize: '0.78rem' }}>
                            {item.abnormality_detection?.abnormality_score !== undefined ? `${item.abnormality_detection.abnormality_score.toFixed(1)} / 100` : 'N/A'}
                          </div>
                          <span style={{ fontSize: '0.7rem', color: abStatus === 'SEVERELY_ABNORMAL' ? '#EF4444' : abStatus === 'ABNORMAL' ? '#F97316' : 'var(--text-secondary)' }}>
                            {abStatus.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.76rem' }}>
                            {wx.wind_speed_kmh ? `${wx.wind_speed_kmh} km/h ${wx.wind_cardinal}` : 'Telemetry Active'}
                          </div>
                          <span className="text-secondary" style={{ fontSize: '0.7rem' }}>
                            Plume: <strong>{wx.plume_dispersion_heading || 'N/A'}</strong>
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {getLabelBadge(item.assigned_label)}
                            {item.is_edited && (
                              <span 
                                title={`Label was edited ${item.edit_count || 1} time(s). Originally labeled: ${item.original_label || 'UNLABELED'}`}
                                style={{ 
                                  fontSize: '0.68rem', 
                                  fontWeight: 700, 
                                  padding: '0.15rem 0.4rem', 
                                  borderRadius: '4px', 
                                  background: 'rgba(245, 158, 11, 0.12)', 
                                  color: '#d97706', 
                                  border: '1px solid rgba(245, 158, 11, 0.4)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem'
                                }}
                              >
                                <History size={10} />
                                Edited ({item.edit_count || 1})
                              </span>
                            )}
                          </div>
                          {item.is_edited && item.original_label && item.original_label !== item.assigned_label && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                              Orig: {item.original_label.replace(/_/g, ' ')}
                            </div>
                          )}
                        </td>
                        <td style={{ maxWidth: '200px' }}>
                          {item.reviewer_name ? (
                            <>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{item.reviewer_name}</div>
                              <div className="text-secondary" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.review_notes || 'No review remarks logged.'}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '0.74rem' }}>Unassigned</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleOpenReview(item)}
                            className="btn-text-link"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', fontSize: '0.76rem' }}
                          >
                            <Edit3 size={13} />
                            {item.is_reviewed ? 'Edit Label' : 'Review'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Governance View Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <DatasetQualityCard qualityData={qualityData} loading={loadingGovernance} onRefresh={fetchGovernanceData} />
          <ReviewerAnalyticsCard reviewerData={reviewerData} loading={loadingGovernance} onRefresh={fetchGovernanceData} />
          <ReviewAuditTimeline auditLogs={auditLogs} loading={loadingGovernance} onRefresh={fetchGovernanceData} />
        </div>
      )}

      {/* Review Modal / Drawer */}
      {activeIncident && (
        <div className="modal-overlay" onClick={handleCloseReview} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '12px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div className="section-tag" style={{ marginBottom: '0.25rem' }}>INCIDENT GROUND TRUTH VALIDATION</div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  {activeIncident.facility_name}
                </h3>
                <span className="font-mono text-secondary" style={{ fontSize: '0.8rem' }}>
                  UUID: {activeIncident.incident_uuid} &bull; Coordinates: {activeIncident.centroid_latitude?.toFixed(4)}°N, {activeIncident.centroid_longitude?.toFixed(4)}°E
                </span>
              </div>
              <button onClick={handleCloseReview} className="btn-text-link" style={{ padding: '0.25rem' }}>
                <X size={20} />
              </button>
            </div>

            {/* Context Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div>
                <span className="report-data-label" style={{ fontSize: '0.7rem' }}>Peak FRP</span>
                <span className="font-mono font-bold" style={{ fontSize: '0.9rem' }}>{activeIncident.max_frp.toFixed(1)} MW</span>
              </div>
              <div>
                <span className="report-data-label" style={{ fontSize: '0.7rem' }}>Risk Score</span>
                <span className="font-mono font-bold" style={{ fontSize: '0.9rem', color: activeIncident.risk_level === 'CRITICAL' ? '#EF4444' : '#F97316' }}>
                  {activeIncident.risk_score.toFixed(1)} / 100
                </span>
              </div>
              <div>
                <span className="report-data-label" style={{ fontSize: '0.7rem' }}>Abnormality</span>
                <span className="font-mono font-bold" style={{ fontSize: '0.9rem' }}>
                  {activeIncident.abnormality_detection?.abnormality_score !== undefined ? `${activeIncident.abnormality_detection.abnormality_score.toFixed(1)}` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Label Modification History Notice (Phase 14E) */}
            {activeIncident.is_edited && (
              <div style={{ marginBottom: '1.25rem', padding: '0.75rem 0.9rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#d97706', marginBottom: '0.2rem' }}>
                  <History size={14} />
                  Label Revision History &bull; Edited {activeIncident.edit_count || 1} time(s)
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {activeIncident.original_label && (
                    <span>Initial Assignment: <strong className="font-mono">{activeIncident.original_label}</strong>. </span>
                  )}
                  Current Label: <strong className="font-mono">{activeIncident.assigned_label}</strong>.
                  <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Every revision is immutably logged to the permanent audit trail with your verified name, timestamp, and justification.
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveReview}>
              {/* Label Selector Grid */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Select Ground Truth Classification Label:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  {labelOptions.map((opt) => {
                    const isSelected = selectedLabel === opt.id;
                    const Icon = opt.icon;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setSelectedLabel(opt.id)}
                        style={{
                          cursor: 'pointer',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: `2px solid ${isSelected ? opt.color : 'var(--border-subtle)'}`,
                          background: isSelected ? opt.bg : 'var(--bg-secondary)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <Icon size={16} style={{ color: opt.color }} />
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: isSelected ? opt.color : 'var(--text-main)' }}>
                            {opt.label}
                          </span>
                          {isSelected && <Check size={14} style={{ color: opt.color, marginLeft: 'auto' }} />}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                          {opt.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reviewer Name */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Reviewing Analyst Name / Department:
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  required
                  placeholder="e.g. Dr. A. Patel (State Disaster Management Authority)"
                  className="clean-search-input"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.84rem' }}
                />
              </div>

              {/* Review Notes */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Audit Evidence &amp; Verification Remarks:
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Document satellite verification rationale, industrial register citations, local dispatch call logs, or camera cross-check evidence..."
                  className="clean-search-input"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.84rem', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleCloseReview}
                  className="filter-btn-text"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-black-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem' }}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={14} className="spin-anim" />
                      Saving Label...
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      Save Verified Ground Truth
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};

export default GroundTruthReviewPage;
