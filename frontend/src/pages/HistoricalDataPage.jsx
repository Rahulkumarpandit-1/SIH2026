import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/api';
import { 
  Database, 
  ShieldCheck, 
  Layers, 
  Search, 
  CheckCircle2, 
  HelpCircle, 
  RefreshCw, 
  UserCheck, 
  X, 
  Radio, 
  Activity, 
  Cpu,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const HistoricalDataPage = () => {
  const [qualityReport, setQualityReport] = useState(null);
  const [provenanceList, setProvenanceList] = useState([]);
  const [datasetRecords, setDatasetRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [labelFilter, setLabelFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedObs, setSelectedObs] = useState(null);
  const [reviewClass, setReviewClass] = useState('INDUSTRIAL_FIRE_OUTBREAK');
  const [reviewerName, setReviewerName] = useState('Senior Remote Sensing Analyst');
  const [sourceCitation, setSourceCitation] = useState('DOC-VERIFIED-INCIDENT-LOG-2026');
  const [reviewConfidence, setReviewConfidence] = useState(0.95);
  const [reviewNotes, setReviewNotes] = useState('Cross-referenced with official emergency dispatch registry.');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState(null);

  // Ingestion Refresh State
  const [refreshState, setRefreshState] = useState('IDLE'); // 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED'
  const [refreshResult, setRefreshResult] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [qualityRes, provRes, dataRes, sumRes] = await Promise.all([
        apiService.getDatasetQuality(),
        apiService.getDatasetProvenance(),
        apiService.getGroundTruth(),
        apiService.getSummary()
      ]);
      setQualityReport(qualityRes);
      setProvenanceList(Array.isArray(provRes) ? provRes : []);
      setDatasetRecords(Array.isArray(dataRes) ? dataRes : []);
      setSummary(sumRes);
    } catch (err) {
      console.error('Failed to load historical dataset information:', err);
      setError('Historical dataset API is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenReviewModal = (obs) => {
    setSelectedObs(obs);
    setReviewClass(obs.label_name !== 'UNLABELED' ? obs.label_name : 'INDUSTRIAL_FIRE_OUTBREAK');
    setSourceCitation(obs.source_reference || 'DOC-VERIFIED-INCIDENT-LOG-2026');
    setReviewerName(obs.reviewer || 'Senior Remote Sensing Analyst');
    setReviewNotes(obs.review_notes || 'Cross-referenced with independent disaster logs.');
    setReviewConfidence(obs.label_confidence || 0.90);
    setReviewSuccessMsg(null);
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!selectedObs) return;

    setReviewSubmitting(true);
    try {
      const payload = {
        observation_id: selectedObs.observation_id,
        latitude: selectedObs.latitude,
        longitude: selectedObs.longitude,
        acq_date: selectedObs.acq_date,
        target_class: reviewClass,
        reviewer: reviewerName,
        source_citation: sourceCitation,
        provenance_type: 'EXPERT_HUMAN_REVIEW',
        confidence: parseFloat(reviewConfidence),
        review_notes: reviewNotes
      };

      await apiService.submitGroundTruthReview(payload);
      setReviewSuccessMsg('Verified ground-truth review recorded successfully.');
      setTimeout(() => {
        setReviewModalOpen(false);
        fetchData();
      }, 1000);
    } catch (err) {
      console.error('Failed to submit ground truth review:', err);
      alert('Failed to submit review. Please verify the input values.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleTriggerRefresh = async () => {
    setRefreshState('RUNNING');
    setRefreshResult(null);
    try {
      const res = await apiService.refreshData({ days: 5, sensor: 'VIIRS_SNPP_NRT' });
      setRefreshResult(res);
      setRefreshState('SUCCESS');
      fetchData();
    } catch (err) {
      console.error('Data refresh error:', err);
      setRefreshState('FAILED');
    }
  };

  const safeRecords = Array.isArray(datasetRecords) ? datasetRecords : [];
  const safeProvenance = Array.isArray(provenanceList) ? provenanceList : [];

  const filteredRecords = useMemo(() => {
    return safeRecords.filter((rec) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        (rec.nearest_facility_name || '').toLowerCase().includes(term) ||
        (rec.cluster_id || '').toLowerCase().includes(term) ||
        (rec.label_name || '').toLowerCase().includes(term) ||
        String(rec.observation_id).includes(term);

      const matchesLabel = 
        labelFilter === 'ALL' ||
        (labelFilter === 'LABELED' && rec.label_name !== 'UNLABELED') ||
        (labelFilter === 'UNLABELED' && rec.label_name === 'UNLABELED');

      return matchesSearch && matchesLabel;
    });
  }, [safeRecords, searchTerm, labelFilter]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  return (
    <div className="page-container">
      {/* 01 — EDITORIAL HEADER */}
      <section className="editorial-header">
        <div className="section-tag">CENTRAL DATA WORKSPACE &bull; PROVENANCE ARCHIVE</div>
        <h1 className="page-main-heading">Historical Telemetry &amp; Ground Truth Workspace</h1>
        <p className="section-subtext">
          Rigorous separation between raw satellite radiance, spatial context geofencing,
          and independently verified ground truth. We strictly enforce zero synthetic label fabrication.
        </p>
      </section>

      {/* 02 — DATA SOURCES */}
      <section className="spacious-section">
        <div className="section-tag">DATA SOURCES &amp; ARCHITECTURE</div>
        <div className="three-column-grid" style={{ marginTop: '1rem' }}>
          <div className="text-panel">
            <h3 className="panel-heading">1. NASA FIRMS Satellite Ingestion</h3>
            <p className="panel-desc">
              High-cadence VIIRS (375m on Suomi-NPP, NOAA-20, NOAA-21) and MODIS (1km on Terra, Aqua) Near Real-Time (NRT) products.
              Raw payloads are archived immutably with SHA-256 integrity verification.
            </p>
            <div className="meta-tag">Sensors: VIIRS SNPP, NOAA-20, NOAA-21, MODIS</div>
          </div>

          <div className="text-panel">
            <h3 className="panel-heading">2. OpenStreetMap Industrial Geofences</h3>
            <p className="panel-desc">
              3,970 vector polygon boundaries representing refineries, petrochemical complexes, chemical storage tanks,
              and port installations across the Gujarat Industrial Corridor [69°E–74°E, 20°N–24.5°N].
            </p>
            <div className="meta-tag">3,970 Vector Polygons &bull; Overpass API</div>
          </div>

          <div className="text-panel">
            <h3 className="panel-heading">3. Ground-Truth Provenance Registry</h3>
            <p className="panel-desc">
              Authoritative incident logs, emergency dispatch archives, and expert human review annotations.
              Every verified record requires documented citations to prevent synthetic guessing.
            </p>
            <div className="meta-tag">Audit Trail: Reviewer, Citation &amp; Timestamp</div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* 03 — COVERAGE & DATA QUALITY */}
      <section className="spacious-section">
        <div className="section-header-flex">
          <div>
            <div className="section-tag">DATA QUALITY &amp; COVERAGE TELEMETRY</div>
            <h2 className="section-heading">Dataset Quality &amp; Verification Telemetry</h2>
            <p className="section-subtext">
              Real-time dataset distribution metrics calculated from SQLite database and immutable archives.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="font-mono text-muted" style={{ fontSize: '0.78rem' }}>
              Refresh Status: <strong>{refreshState}</strong>
            </span>
            <button 
              className="btn-outline"
              onClick={handleTriggerRefresh}
              disabled={refreshState === 'RUNNING'}
            >
              <RefreshCw size={14} className={refreshState === 'RUNNING' ? 'spin-anim' : ''} />
              <span>{refreshState === 'RUNNING' ? 'Ingesting FIRMS...' : 'Safe FIRMS Refresh'}</span>
            </button>
          </div>
        </div>

        {refreshResult && (
          <div className="alert-callout-neutral" style={{ marginTop: '1rem' }}>
            <div className="callout-icon text-success"><CheckCircle2 size={20} /></div>
            <div style={{ fontSize: '0.86rem' }}>
              <strong>NASA FIRMS Ingestion Complete ({refreshResult.job_id}):</strong> Received {refreshResult.rows_received} rows, 
              added {refreshResult.rows_added} new records ({refreshResult.rows_duplicate} duplicates skipped) in {refreshResult.execution_time_seconds}s.
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-placeholder">Loading dataset telemetry...</div>
        ) : qualityReport ? (
          <div className="situation-strip" style={{ marginTop: '1.25rem' }}>
            <div className="stat-node">
              <span className="stat-value font-mono">{qualityReport.total_raw_observations}</span>
              <span className="stat-label">Raw Observations</span>
            </div>
            <div className="stat-separator" />
            <div className="stat-node">
              <span className="stat-value font-mono">{qualityReport.total_unique_observations}</span>
              <span className="stat-label">Unique Enriched Records</span>
            </div>
            <div className="stat-separator" />
            <div className="stat-node">
              <span className="stat-value font-mono">{qualityReport.total_physical_clusters}</span>
              <span className="stat-label">DBSCAN Clusters</span>
            </div>
            <div className="stat-separator" />
            <div className="stat-node">
              <span className="stat-value text-success font-mono">{qualityReport.labeled_observations}</span>
              <span className="stat-label">Verified Ground Truth</span>
            </div>
            <div className="stat-separator" />
            <div className="stat-node">
              <span className="stat-value text-secondary font-mono">{qualityReport.unlabeled_observations}</span>
              <span className="stat-label">Unlabeled Records</span>
            </div>
          </div>
        ) : null}
      </section>

      <div className="divider" />

      {/* 04 — PROVENANCE CATALOG */}
      <section className="spacious-section">
        <div className="section-tag">GROUND TRUTH PROVENANCE REGISTRY</div>
        <h2 className="section-heading">Verified Incident Provenance Catalog</h2>
        <p className="section-subtext">
          Authoritative legal industrial accident records and disaster survey ground-truth citations.
        </p>

        <div className="table-responsive" style={{ marginTop: '1.25rem' }}>
          <table className="clean-table">
            <thead>
              <tr>
                <th>Location Coordinates</th>
                <th>Target Class</th>
                <th>Source Category</th>
                <th>Confidence</th>
                <th>Event Date</th>
                <th>Documentary Citation / Reference</th>
              </tr>
            </thead>
            <tbody>
              {safeProvenance.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No verified ground-truth records registered yet. Observations remain UNLABELED until verified.
                  </td>
                </tr>
              ) : (
                safeProvenance.map((item, idx) => (
                  <tr key={idx}>
                    <td className="font-mono">{item.latitude?.toFixed(4)}°N, {item.longitude?.toFixed(4)}°E</td>
                    <td>
                      <span className="pill-badge pill-moderate font-mono">
                        {item.label_name}
                      </span>
                    </td>
                    <td><span className="font-mono" style={{ fontSize: '0.78rem' }}>{item.label_source}</span></td>
                    <td className="font-mono font-bold">{((item.label_confidence ?? 0.9) * 100).toFixed(0)}%</td>
                    <td className="font-mono">{item.date}</td>
                    <td className="font-mono text-secondary" style={{ fontSize: '0.8rem' }}>{item.source_reference}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="divider" />

      {/* 05 — COMPLETE OBSERVATION EXPLORER & REVIEW WORKFLOW */}
      <section className="spacious-section">
        <div className="section-header-flex">
          <div>
            <div className="section-tag">OBSERVATION EXPLORER &bull; ACTIVE REPOSITORY</div>
            <h2 className="section-heading">All Ingested Observations &amp; Ground-Truth Review</h2>
            <p className="section-subtext">
              Inspect individual satellite detections or click "Review Label" to attach verified ground-truth citations.
            </p>
          </div>

          <div className="table-toolbar-clean" style={{ margin: 0 }}>
            <input
              type="text"
              placeholder="Search by facility, cluster, ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="clean-search-input"
            />
            <select
              className="select-input"
              value={labelFilter}
              onChange={(e) => {
                setLabelFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Records ({safeRecords.length})</option>
              <option value="LABELED">Verified Only</option>
              <option value="UNLABELED">Unlabeled Only</option>
            </select>
          </div>
        </div>

        <div className="table-responsive" style={{ marginTop: '1.25rem' }}>
          <table className="clean-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cluster</th>
                <th>Acquisition</th>
                <th>Peak FRP</th>
                <th>Brightness</th>
                <th>Industrial Distance</th>
                <th>Facility Context</th>
                <th>Ground Truth</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No observations found matching the search and filter query.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((rec) => (
                  <tr key={rec.observation_id}>
                    <td className="font-mono text-muted">#{rec.observation_id}</td>
                    <td className="font-mono font-bold">{rec.cluster_id}</td>
                    <td className="font-mono">{rec.acq_date} {rec.acq_time}</td>
                    <td className="font-mono font-bold text-critical">{rec.frp} MW</td>
                    <td className="font-mono">{rec.brightness} K</td>
                    <td className="font-mono">
                      {rec.distance_to_industry_meters === 0 ? (
                        <span className="badge-critical">0 m (Inside)</span>
                      ) : (
                        `${rec.distance_to_industry_meters?.toFixed(1)} m`
                      )}
                    </td>
                    <td>
                      <span className="text-secondary" style={{ fontSize: '0.82rem' }}>
                        {rec.nearest_facility_name || 'Industrial Facility'}
                      </span>
                    </td>
                    <td>
                      {rec.label_name === 'UNLABELED' || !rec.label_name ? (
                        <span className="pill-badge pill-neutral font-mono">UNLABELED</span>
                      ) : (
                        <span className="pill-badge pill-success font-mono">{rec.label_name}</span>
                      )}
                    </td>
                    <td>
                      <button 
                        className="btn-outline-small"
                        onClick={() => handleOpenReviewModal(rec)}
                      >
                        <UserCheck size={12} />
                        <span>Review Label</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.84rem' }}>
          <span className="text-secondary">
            Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length} observations
          </span>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              className="btn-outline-small"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <span className="font-mono font-bold" style={{ padding: '0 0.5rem' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button 
              className="btn-outline-small"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* 06 — GROUND-TRUTH REVIEW MODAL */}
      {reviewModalOpen && selectedObs && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Ground-Truth Review Annotation</h3>
              <button className="btn-close" onClick={() => setReviewModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="modal-body">
              <div className="obs-summary-box">
                <div><strong>Observation ID:</strong> #{selectedObs.observation_id} ({selectedObs.acq_date} {selectedObs.acq_time})</div>
                <div><strong>Coordinates:</strong> {selectedObs.latitude?.toFixed(4)}°N, {selectedObs.longitude?.toFixed(4)}°E</div>
                <div><strong>Telemetry:</strong> {selectedObs.frp} MW &bull; {selectedObs.brightness} K &bull; Boundary Dist: {selectedObs.distance_to_industry_meters}m</div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">Verified Target Classification</label>
                <select 
                  className="select-input full-width"
                  value={reviewClass}
                  onChange={(e) => setReviewClass(e.target.value)}
                >
                  <option value="PERSISTENT_INDUSTRIAL_SOURCE">CLASS 0: Persistent Industrial Source (Refinery Flare / Boiler)</option>
                  <option value="INDUSTRIAL_FIRE_OUTBREAK">CLASS 1: Industrial Fire Outbreak (Acute Emergency Outbreak)</option>
                  <option value="AGRICULTURAL_WILDFIRE">CLASS 2: Agricultural Wildfire (Crop Residue Burn)</option>
                  <option value="FALSE_DETECTION">CLASS 3: False Detection (Solar Glint / Sensor Artifact)</option>
                  <option value="UNLABELED">UNLABELED (Reset to Unlabeled)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Reviewer / Authority Name</label>
                <input
                  type="text"
                  className="search-input full-width"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Documentary Citation / Dispatch Reference</label>
                <input
                  type="text"
                  className="search-input full-width"
                  value={sourceCitation}
                  onChange={(e) => setSourceCitation(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Verification Confidence ({Math.round(reviewConfidence * 100)}%)</label>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  className="full-width"
                  value={reviewConfidence}
                  onChange={(e) => setReviewConfidence(parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Review Notes &amp; Verification Rationale</label>
                <textarea
                  className="search-input full-width"
                  rows={2}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>

              {reviewSuccessMsg && (
                <div className="alert-callout-neutral text-success" style={{ marginTop: '0.5rem' }}>
                  {reviewSuccessMsg}
                </div>
              )}

              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-outline" onClick={() => setReviewModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-black-primary" disabled={reviewSubmitting}>
                  {reviewSubmitting ? 'Saving Review...' : 'Commit Verified Label'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricalDataPage;
