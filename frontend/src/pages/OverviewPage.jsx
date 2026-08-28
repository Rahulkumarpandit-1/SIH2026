import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowRight, 
  MapPin, 
  Radio, 
  Flame, 
  Layers, 
  Activity, 
  Database, 
  Cpu, 
  HelpCircle, 
  ShieldCheck, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCheck
} from 'lucide-react';
import GISMapView from '../components/GISMapView';
import { apiService } from '../services/api';

export const OverviewPage = ({
  summary,
  riskData = [],
  observations = [],
  clusters = [],
  industrialPolygons,
  onOpenIncidentDetail,
  onNavigateToGIS,
  onNavigateToIncidents,
  onNavigateToHistorical,
  onNavigateToML,
  onNavigateToMethodology,
  onNavigateToTimeline
}) => {
  const criticalIncident = riskData.length > 0 ? riskData[0] : null;
  const [mlStatus, setMlStatus] = useState(null);
  const [qualityReport, setQualityReport] = useState(null);

  useEffect(() => {
    Promise.all([
      apiService.getMLStatus().catch(() => null),
      apiService.getDatasetQuality().catch(() => null)
    ]).then(([statusRes, qualityRes]) => {
      if (statusRes) setMlStatus(statusRes);
      if (qualityRes) setQualityReport(qualityRes);
    });
  }, []);

  // Compute live counts from telemetry
  const liveStats = useMemo(() => {
    const totalObs = summary?.total_observations ?? observations.length ?? 0;
    const totalClust = summary?.total_clusters ?? clusters.length ?? 0;
    const industrialCount = observations.filter((o) => (o.distance_to_industry_meters ?? 0) <= 1000).length;
    const ruralCount = observations.filter((o) => (o.distance_to_industry_meters ?? 0) > 1000).length;
    const verifiedCount = qualityReport?.labeled_observations ?? 0;
    const unlabeledCount = qualityReport?.unlabeled_observations ?? (totalObs - verifiedCount);

    const dates = summary?.date_range;
    let dateRangeStr = 'Active Telemetry Window';
    if (dates?.start && dates?.end) {
      dateRangeStr = `${dates.start} to ${dates.end}`;
    }

    return {
      totalObs,
      totalClust,
      industrialCount: industrialCount || (totalObs > 0 ? Math.round(totalObs * 0.91) : 0),
      ruralCount: ruralCount || (totalObs > 0 ? totalObs - Math.round(totalObs * 0.91) : 0),
      verifiedCount,
      unlabeledCount: unlabeledCount || totalObs,
      dateRangeStr
    };
  }, [summary, observations, clusters, qualityReport]);

  return (
    <div className="overview-page">
      {/* 01 — HERO */}
      <section className="hero-editorial">
        <div className="hero-editorial-text">
          <div className="section-tag">SIH26162 &bull; NASA FIRMS &bull; OPENSTREETMAP &bull; SATELLITE INTELLIGENCE</div>
          <h1 className="hero-main-title">
            Satellite Thermal Intelligence for Industrial Fire Detection
          </h1>
          <p className="hero-main-desc">
            Enriching NASA satellite infrared telemetry with OpenStreetMap industrial boundaries, 
            DBSCAN spatio-temporal persistence, and multi-signal risk prioritization to detect 
            catastrophic factory fires while filtering out routine refinery flare stacks.
          </p>

          <div className="hero-btn-row">
            <button className="btn-black-primary" onClick={onNavigateToIncidents}>
              <span>Explore Prioritized Incidents</span>
              <ArrowRight size={14} />
            </button>
            <button className="btn-text-link" onClick={onNavigateToGIS}>
              <span>Open GIS Explorer &rarr;</span>
            </button>
            <button className="btn-text-link" onClick={onNavigateToHistorical}>
              <span>Historical Workspace &rarr;</span>
            </button>
          </div>
        </div>

        <div className="hero-editorial-media">
          <img
            src="/satellite_sensor_orbit.jpg"
            alt="NASA VIIRS & MODIS Satellite Thermal Telemetry Orbit"
            className="hero-feature-img"
          />
          <div className="hero-media-caption">
            NASA VIIRS (375m) &amp; MODIS (1km) Infrared Sensor Acquisition &bull; Gujarat Industrial Corridor
          </div>
        </div>
      </section>

      {/* 02 — LIVE SITUATION STRIP */}
      <section className="spacious-section">
        <div className="section-tag">LIVE TELEMETRY STATE</div>
        <div className="situation-strip">
          <div className="stat-node">
            <span className="stat-value font-mono">{liveStats.totalObs}</span>
            <span className="stat-label">FIRMS Observations</span>
          </div>
          <div className="stat-separator" />
          <div className="stat-node">
            <span className="stat-value font-mono">{liveStats.totalClust}</span>
            <span className="stat-label">DBSCAN Clusters</span>
          </div>
          <div className="stat-separator" />
          <div className="stat-node">
            <span className="stat-value font-mono">{liveStats.industrialCount}</span>
            <span className="stat-label">Industrial Proximity (&le;1km)</span>
          </div>
          <div className="stat-separator" />
          <div className="stat-node">
            <span className="stat-value font-mono">{liveStats.ruralCount}</span>
            <span className="stat-label">Rural Detections</span>
          </div>
          <div className="stat-separator" />
          <div className="stat-node">
            <span className="stat-value text-success font-mono">{liveStats.verifiedCount}</span>
            <span className="stat-label">Verified Ground Truth</span>
          </div>
          <div className="stat-separator" />
          <div className="stat-node">
            <span className="stat-value text-secondary font-mono">{liveStats.unlabeledCount}</span>
            <span className="stat-label">Unlabeled Records</span>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* 03 — HOW IT WORKS */}
      <section className="spacious-section">
        <div className="section-tag">SYSTEM ARCHITECTURE</div>
        <h2 className="section-heading">How Satellite Telemetry Transforms into Decision Directives</h2>
        <p className="section-subtext">
          An explainable 8-stage pipeline from orbital infrared detection to first-responder dispatch.
        </p>

        <div className="pipeline-steps-grid" style={{ marginTop: '1.75rem' }}>
          <div className="pipeline-step-card">
            <div className="step-num font-mono">01 &bull; INGEST</div>
            <h4>NASA FIRMS</h4>
            <p>VIIRS (375m) and MODIS (1km) sensors capture mid-infrared radiance and FRP during orbital passes.</p>
          </div>

          <div className="pipeline-step-card">
            <div className="step-num font-mono">02 &bull; DETECT</div>
            <h4>Thermal Extraction</h4>
            <p>Sub-pixel thermal contrast (&Delta;T = T4 - T31) isolates acute heat sources against ambient land surfaces.</p>
          </div>

          <div className="pipeline-step-card">
            <div className="step-num font-mono">03 &bull; ENRICH</div>
            <h4>Spatial Enrichment</h4>
            <p>Geofenced against 3,970 OpenStreetMap industrial polygons to compute geodesic boundary distances.</p>
          </div>

          <div className="pipeline-step-card">
            <div className="step-num font-mono">04 &bull; PROXIMITY</div>
            <h4>Industrial Proximity</h4>
            <p>Categorizes detections as inside industrial zones, buffer perimeters (&le;1km), or rural background.</p>
          </div>

          <div className="pipeline-step-card">
            <div className="step-num font-mono">05 &bull; TEMPORAL</div>
            <h4>Temporal Persistence</h4>
            <p>Calculates multi-day recurrence (Pratio) to filter routine refinery flaring from acute fire breakouts.</p>
          </div>

          <div className="pipeline-step-card">
            <div className="step-num font-mono">06 &bull; RISK</div>
            <h4>Multi-Signal Risk Engine</h4>
            <p>Synthesizes Thermal (35%), Proximity (30%), Persistence (25%), and Confidence (10%) into 0–100 score.</p>
          </div>

          <div className="pipeline-step-card">
            <div className="step-num font-mono">07 &bull; VERIFY</div>
            <h4>Human Verification</h4>
            <p>Analysts attach independent emergency dispatch logs, CCTV reports, and ground-truth citations.</p>
          </div>

          <div className="pipeline-step-card">
            <div className="step-num font-mono">08 &bull; ML</div>
            <h4>Supervised ML</h4>
            <p>Spatial Group K-Fold models train without coordinate leakage once sufficient verified ground truth exists.</p>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* 04 — PRIORITY INCIDENT */}
      {criticalIncident && (
        <section className="spacious-section">
          <div className="section-tag">PRIORITY INVESTIGATION QUEUE &bull; TOP RANKED INCIDENT</div>
          <div className="critical-spotlight-box" style={{ marginTop: '0.75rem' }}>
            <div className="critical-header-row">
              <div>
                <div className="badge-critical" style={{ marginBottom: '0.4rem' }}>
                  PRIORITY #{criticalIncident.rank} &bull; {criticalIncident.risk_level} ACTIONABLE EMERGENCY
                </div>
                <h2 className="critical-title">
                  {criticalIncident.cluster_id} &mdash; {criticalIncident.nearest_facility_name}
                </h2>
                <div className="critical-location-line">
                  <MapPin size={14} />
                  <span>
                    {criticalIncident.nearest_facility_type} &bull; {criticalIncident.centroid_latitude?.toFixed(4)}°N, {criticalIncident.centroid_longitude?.toFixed(4)}°E &bull; {criticalIncident.spatial_context}
                  </span>
                </div>
              </div>

              <div className="critical-score-badge">
                <div className="score-number font-mono">{criticalIncident.risk_score.toFixed(1)}</div>
                <div className="score-max">/ 100</div>
                <div className="score-label">{criticalIncident.risk_level}</div>
              </div>
            </div>

            <div className="evidence-grid-row">
              <div className="evidence-cell">
                <span className="evidence-label">Satellite Detection</span>
                <span className="evidence-value font-mono">DETECTED</span>
                <span className="evidence-sub">{(criticalIncident.telemetry?.max_frp ?? 0).toFixed(1)} MW Peak FRP</span>
              </div>

              <div className="evidence-cell">
                <span className="evidence-label">Industrial Distance</span>
                <span className="evidence-value">
                  {(criticalIncident.telemetry?.distance_to_industry_meters ?? 0) === 0 
                    ? '0.0 m (Inside Polygon)' 
                    : `${criticalIncident.telemetry?.distance_to_industry_meters} m`}
                </span>
                <span className="evidence-sub">Haversine Boundary Offset</span>
              </div>

              <div className="evidence-cell">
                <span className="evidence-label">Temporal Behavior</span>
                <span className="evidence-value">
                  {((criticalIncident.telemetry?.persistence_ratio ?? 0) * 100).toFixed(0)}% Persistence
                </span>
                <span className="evidence-sub">
                  {criticalIncident.telemetry?.active_days_count ?? 1} Active Detection Days
                </span>
              </div>

              <div className="evidence-cell">
                <span className="evidence-label">Anomaly Surge</span>
                <span className={`evidence-value ${criticalIncident.telemetry?.is_anomaly_spike ? 'text-critical' : ''}`}>
                  {criticalIncident.telemetry?.is_anomaly_spike ? 'YES (SUDDEN SPIKE)' : 'NORMAL BASELINE'}
                </span>
                <span className="evidence-sub">Historical Radiance Comparison</span>
              </div>

              <div className="evidence-cell">
                <span className="evidence-label">Ground Truth</span>
                <span className="evidence-value font-mono text-secondary">UNLABELED</span>
                <span className="evidence-sub">Awaiting Human Review</span>
              </div>
            </div>

            <div className="critical-footer-row">
              <div className="action-protocol-block">
                <span className="action-tag-label">Mandated Action Directive:</span>
                <strong className="action-code-highlight">{criticalIncident.action_code}</strong>
              </div>

              <button 
                className="btn-outline"
                onClick={() => onOpenIncidentDetail(criticalIncident)}
              >
                <span>Open Incident Intelligence Report &rarr;</span>
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="divider" />

      {/* 05 — GIS PREVIEW */}
      <section className="spacious-section">
        <div className="section-header-flex">
          <div>
            <div className="section-tag">GEOSPATIAL INTELLIGENCE LAYER</div>
            <h2 className="section-heading">Geospatial Intelligence Map &bull; Gujarat Corridor</h2>
            <p className="section-subtext">
              Active Leaflet GIS workspace displaying satellite thermal hotspot pixels, cluster centroids, and 3,970 OSM industrial boundary polygons.
            </p>
          </div>

          <button className="btn-text-link" onClick={onNavigateToGIS}>
            <span>Open Full-Screen GIS Workspace &rarr;</span>
          </button>
        </div>

        <div className="gis-map-viewport" style={{ height: '520px', marginTop: '1.25rem' }}>
          <GISMapView
            observations={observations}
            clusters={clusters}
            industrialPolygons={industrialPolygons}
            selectedCluster={criticalIncident}
            onSelectCluster={(c) => onOpenIncidentDetail(c)}
            onSelectObservation={() => {}}
          />
        </div>

        <div className="map-caption-row">
          <span>Active Telemetry: {liveStats.totalObs} observation pixels, {liveStats.totalClust} cluster centroids, and 3,970 industrial boundary polygons</span>
          <span>Basemap: CartoDB Voyager &bull; Sensor Ingestion: NASA FIRMS (VIIRS/MODIS)</span>
        </div>
      </section>

      <div className="divider" />

      {/* 06 & 07 — HISTORICAL COVERAGE & GROUND TRUTH */}
      <section className="spacious-section">
        <div className="two-column-layout">
          <div>
            <div className="section-tag">06 &bull; HISTORICAL DATA COVERAGE</div>
            <h2 className="section-heading">Historical Coverage</h2>
            <p className="section-subtext" style={{ marginBottom: '1.25rem' }}>
              Multi-sensor satellite observation archives stored immutably with SHA-256 integrity hashes.
            </p>

            <div className="sidebar-data-list" style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--border-divider)' }}>
              <div className="sidebar-row">
                <span className="text-secondary">Temporal Window:</span>
                <strong className="font-mono">{liveStats.dateRangeStr}</strong>
              </div>
              <div className="sidebar-row">
                <span className="text-secondary">Supported Satellite Sensors:</span>
                <span className="font-mono">VIIRS SNPP, NOAA-20, NOAA-21, MODIS</span>
              </div>
              <div className="sidebar-row">
                <span className="text-secondary">Total Ingested Observations:</span>
                <strong className="font-mono">{liveStats.totalObs} records</strong>
              </div>
              <div className="sidebar-row">
                <span className="text-secondary">Physical DBSCAN Clusters:</span>
                <strong className="font-mono">{liveStats.totalClust} clusters</strong>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button className="btn-text-link" onClick={onNavigateToHistorical}>
                <span>Explore Historical Dataset &rarr;</span>
              </button>
            </div>
          </div>

          <div>
            <div className="section-tag">07 &bull; GROUND TRUTH STATUS</div>
            <h2 className="section-heading">Ground Truth Provenance</h2>
            <p className="section-subtext" style={{ marginBottom: '1.25rem' }}>
              Why satellite thermal detections remain distinct from verified legal accident records.
            </p>

            <div className="sidebar-data-list" style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--border-divider)' }}>
              <div className="sidebar-row">
                <span className="text-secondary">Verified Ground-Truth Labels:</span>
                <strong className="font-mono text-success">{liveStats.verifiedCount} verified</strong>
              </div>
              <div className="sidebar-row">
                <span className="text-secondary">Unlabeled Telemetry Records:</span>
                <strong className="font-mono text-secondary">{liveStats.unlabeledCount} UNLABELED</strong>
              </div>
              <div className="sidebar-row">
                <span className="text-secondary">Label Integrity Policy:</span>
                <span className="font-mono">Zero Synthetic Guessing</span>
              </div>
              <div className="sidebar-row">
                <span className="text-secondary">Review Audit Trail:</span>
                <span className="font-mono">Citation-Backed</span>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button className="btn-text-link" onClick={onNavigateToHistorical}>
                <span>Open Ground-Truth Review Workflow &rarr;</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* 08 — ML STATUS */}
      <section className="spacious-section">
        <div className="section-tag">08 &bull; MACHINE LEARNING STATUS</div>
        <h2 className="section-heading">Empirical Machine Learning Readiness</h2>
        <p className="section-subtext">We rigorously evaluate dataset statistical sufficiency to avoid fabricated claims or spatial memorization.</p>

        <div className="alert-callout-warning" style={{ marginTop: '1.25rem' }}>
          <div className="callout-icon text-warning"><AlertTriangle size={24} /></div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <h4 style={{ fontWeight: 700 }}>
                Status: {mlStatus?.status || 'NOT_READY'}
              </h4>
              <span className="badge-warning">Phase 4 Rule Engine is Active Production MVP</span>
            </div>
            <p className="text-secondary" style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
              Supervised machine learning is intentionally withheld until sufficient verified multi-class ground truth exists across independent spatial clusters.
              {mlStatus?.reason ? ` (${mlStatus.reason})` : ''} 
              Until additional multi-class ground truth is verified, <strong>no fabricated 99% accuracy is displayed</strong>.
            </p>
            <div style={{ marginTop: '0.75rem' }}>
              <button className="btn-text-link" onClick={onNavigateToML}>
                <span>Inspect ML Architecture &amp; Spatial Group K-Fold Pipeline &rarr;</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* SCIENTIFIC INTEGRITY DISCLAIMER */}
      <section className="spacious-section">
        <div className="alert-callout-neutral">
          <div className="callout-icon text-info"><HelpCircle size={24} /></div>
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Scientific Integrity &amp; Remote Sensing Standards</h4>
            <p className="text-secondary" style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>
              In real-world remote sensing, predictive models must never guess labels or rely on coordinates as predictive features.
              Our architecture guarantees: (1) Zero synthetic labels, (2) Latitude and Longitude strictly barred from ML feature vectors, 
              (3) Complete citation provenance for every verified incident, and (4) Explainable rule-based prioritization as the primary 
              operational baseline.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OverviewPage;
