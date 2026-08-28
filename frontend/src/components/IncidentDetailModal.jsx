import React from 'react';
import { 
  X, AlertOctagon, Flame, MapPin, Clock, Gauge, ShieldAlert, 
  CheckCircle2, ArrowRight, ShieldCheck, Activity, Layers, Radio
} from 'lucide-react';

export const IncidentDetailModal = ({ incident, isOpen, onClose }) => {
  if (!isOpen || !incident) return null;

  const {
    cluster_id = 'CLUSTER_UNKNOWN',
    risk_score = 0.0,
    risk_level = 'LOW',
    action_code = 'BACKGROUND_LOG',
    incident_classification = 'UNKNOWN',
    subscores = {},
    telemetry = {},
    nearest_facility_name = 'Unknown Facility',
    nearest_facility_type = 'industrial',
    spatial_context = 'UNKNOWN',
    centroid_latitude = 0.0,
    centroid_longitude = 0.0
  } = incident;

  const thermalSub = subscores.thermal_subscore ?? 0.0;
  const proxSub = subscores.proximity_subscore ?? 0.0;
  const persSub = subscores.persistence_subscore ?? 0.0;
  const confSub = subscores.confidence_subscore ?? 0.0;

  const maxFrp = telemetry.max_frp ?? 0.0;
  const avgFrp = telemetry.avg_frp ?? 0.0;
  const maxBrightness = telemetry.max_brightness ?? 0.0;
  const distMeters = telemetry.distance_to_industry_meters ?? 0.0;
  const persistenceRatio = telemetry.persistence_ratio ?? 0.0;
  const activeDays = telemetry.active_days_count ?? 1;
  const totalDetections = telemetry.total_detections ?? 1;
  const isSpike = telemetry.is_anomaly_spike ?? false;

  const getRiskClass = (level) => {
    switch (level) {
      case 'CRITICAL': return 'critical';
      case 'HIGH': return 'high';
      case 'MODERATE': return 'moderate';
      default: return 'low';
    }
  };

  const riskClass = getRiskClass(risk_level);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="incident-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Header Bar */}
        <div className="modal-header-bar">
          <div className="modal-header-left">
            <div className="incident-title-group">
              <span className={`risk-badge-lg ${riskClass}`}>{risk_level}</span>
              <h2 className="incident-modal-id">{cluster_id}</h2>
              <span className="incident-modal-facility">&bull; {nearest_facility_name}</span>
            </div>
            <div className="incident-classification-tag">
              <code>{incident_classification}</code>
            </div>
          </div>

          <button className="btn-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Score Banner Hero */}
        <div className={`incident-score-hero ${riskClass}`}>
          <div className="score-hero-left">
            <div className="score-hero-val-group">
              <span className="score-hero-label">COMPOSITE RISK SCORE</span>
              <div className="score-hero-number">
                <strong>{risk_score.toFixed(1)}</strong>
                <span className="score-hero-max">/ 100</span>
              </div>
            </div>
            <div className="score-hero-action-pill">
              <ShieldAlert size={16} />
              <span>MANDATED ACTION: <strong>{action_code}</strong></span>
            </div>
          </div>

          <div className="score-hero-formula-summary">
            <div className="formula-mini-row">
              <span>(0.35 &times; {thermalSub.toFixed(1)}) + (0.30 &times; {proxSub.toFixed(1)}) + (0.25 &times; {persSub.toFixed(1)}) + (0.10 &times; {confSub.toFixed(1)}) = <strong>{risk_score.toFixed(1)}</strong></span>
            </div>
            <span className="formula-mini-sub">100% Deterministic &bull; Zero Black-Box Weights</span>
          </div>
        </div>

        {/* 5-Section Deep Dive Inspector Body */}
        <div className="modal-body-scroll">
          {/* Section A: Location Intelligence */}
          <div className="inspector-section">
            <div className="inspector-section-header">
              <MapPin size={16} className="text-cyan" />
              <h3>Section A &bull; Location Intelligence &amp; Industrial Boundaries</h3>
            </div>
            <div className="inspector-grid">
              <div className="inspector-card">
                <span className="ins-label">Centroid Coordinates</span>
                <span className="ins-val font-mono">{centroid_latitude.toFixed(6)}&deg;N, {centroid_longitude.toFixed(6)}&deg;E</span>
              </div>
              <div className="inspector-card">
                <span className="ins-label">Nearest OSM Industrial Facility</span>
                <span className="ins-val">{nearest_facility_name}</span>
                <span className="ins-sub">Type: {nearest_facility_type}</span>
              </div>
              <div className="inspector-card">
                <span className="ins-label">Geodesic Boundary Distance</span>
                <span className={`ins-val ${distMeters <= 500 ? 'text-critical' : ''}`}>
                  {distMeters === 0.0 ? '0.0 m (Inside Boundary)' : `${distMeters.toLocaleString()} m`}
                </span>
                <span className="ins-sub">Haversine Polygon Edge Distance</span>
              </div>
              <div className="inspector-card">
                <span className="ins-label">Spatial Context Tier</span>
                <span className="ins-val"><code>{spatial_context}</code></span>
                <span className="ins-sub">OSM Landuse Geofencing</span>
              </div>
            </div>
          </div>

          {/* Section B: Thermal Evidence */}
          <div className="inspector-section">
            <div className="inspector-section-header">
              <Flame size={16} className="text-critical" />
              <h3>Section B &bull; Thermal Infrared Telemetry (NASA FIRMS VIIRS/MODIS)</h3>
            </div>
            <div className="inspector-grid">
              <div className="inspector-card">
                <span className="ins-label">Peak Radiative Power (Max FRP)</span>
                <span className="ins-val text-critical">{maxFrp.toFixed(1)} MW</span>
                <span className="ins-sub">Physical Radiant Heat Flux</span>
              </div>
              <div className="inspector-card">
                <span className="ins-label">Average Thermal Power (Avg FRP)</span>
                <span className="ins-val">{avgFrp.toFixed(1)} MW</span>
                <span className="ins-sub">Mean Radiant Energy</span>
              </div>
              <div className="inspector-card">
                <span className="ins-label">Max Brightness Temp (Channel I4)</span>
                <span className="ins-val">{maxBrightness.toFixed(1)} K</span>
                <span className="ins-sub">3.74 &mu;m Mid-IR Sensor</span>
              </div>
              <div className="inspector-card">
                <span className="ins-label">Sensor Signal Quality</span>
                <span className="ins-val text-low">HIGH (Normalized: {(confSub / 100).toFixed(2)})</span>
                <span className="ins-sub">NASA S/N Quality Gate</span>
              </div>
            </div>
          </div>

          {/* Section C: Temporal Persistence Evidence */}
          <div className="inspector-section">
            <div className="inspector-section-header">
              <Clock size={16} className="text-moderate" />
              <h3>Section C &bull; Spatio-Temporal Persistence &amp; Anomaly Detection</h3>
            </div>
            <div className="inspector-grid">
              <div className="inspector-card">
                <span className="ins-label">Active Detection Days</span>
                <span className="ins-val">{activeDays} of 5 Window Days</span>
                <span className="ins-sub">Multi-Pass Satellite Coverage</span>
              </div>
              <div className="inspector-card">
                <span className="ins-label">Persistence Ratio (P<sub>ratio</sub>)</span>
                <span className="ins-val font-mono">{(persistenceRatio * 100).toFixed(1)}% ({persistenceRatio.toFixed(2)})</span>
                <span className="ins-sub">Recurrence Frequency</span>
              </div>
              <div className="inspector-card">
                <span className="ins-label">Acute Anomaly Surge Spike</span>
                <span className={`ins-val ${isSpike ? 'text-critical' : 'text-low'}`}>
                  {isSpike ? 'YES (UNPRECEDENTED HEAT SURGE)' : 'NO (STEADY BASELINE)'}
                </span>
                <span className="ins-sub">Statistical 2-Sigma Outlier Check</span>
              </div>
              <div className="inspector-card">
                <span className="ins-label">Total Clustered Pixels</span>
                <span className="ins-val">{totalDetections} Detections</span>
                <span className="ins-sub">750 m DBSCAN Core Group</span>
              </div>
            </div>
          </div>

          {/* Section D: Explainable Multi-Signal Sub-Scores */}
          <div className="inspector-section">
            <div className="inspector-section-header">
              <Gauge size={16} className="text-cyan" />
              <h3>Section D &bull; Explainable Multi-Signal Sub-Score Breakdown</h3>
            </div>
            <div className="subscore-progress-container">
              {/* Thermal Subscore */}
              <div className="subscore-item">
                <div className="subscore-header">
                  <span className="subscore-title">
                    <strong>Thermal Intensity Score (S<sub>thermal</sub>)</strong> &bull; Weight: 35%
                  </span>
                  <span className="subscore-points">{thermalSub.toFixed(1)} / 100</span>
                </div>
                <div className="subscore-track">
                  <div className="subscore-fill critical" style={{ width: `${Math.min(thermalSub, 100)}%` }} />
                </div>
                <span className="subscore-desc">Derived from FRP ({maxFrp} MW) &amp; Channel I4 Brightness ({maxBrightness} K).</span>
              </div>

              {/* Proximity Subscore */}
              <div className="subscore-item">
                <div className="subscore-header">
                  <span className="subscore-title">
                    <strong>Industrial Proximity Score (S<sub>prox</sub>)</strong> &bull; Weight: 30%
                  </span>
                  <span className="subscore-points">{proxSub.toFixed(1)} / 100</span>
                </div>
                <div className="subscore-track">
                  <div className="subscore-fill high" style={{ width: `${Math.min(proxSub, 100)}%` }} />
                </div>
                <span className="subscore-desc">Calculated via geodesic boundary distance ({distMeters} m) to {nearest_facility_name}.</span>
              </div>

              {/* Persistence Subscore */}
              <div className="subscore-item">
                <div className="subscore-header">
                  <span className="subscore-title">
                    <strong>Persistence &amp; Anomaly Score (S<sub>pers</sub>)</strong> &bull; Weight: 25%
                  </span>
                  <span className="subscore-points">{persSub.toFixed(1)} / 100</span>
                </div>
                <div className="subscore-track">
                  <div className="subscore-fill moderate" style={{ width: `${Math.min(persSub, 100)}%` }} />
                </div>
                <span className="subscore-desc">Recurrence ratio ({persistenceRatio.toFixed(2)}) combined with acute spike surge ({isSpike ? 'Spike = True' : 'Spike = False'}).</span>
              </div>

              {/* Confidence Subscore */}
              <div className="subscore-item">
                <div className="subscore-header">
                  <span className="subscore-title">
                    <strong>Sensor Confidence Score (S<sub>conf</sub>)</strong> &bull; Weight: 10%
                  </span>
                  <span className="subscore-points">{confSub.toFixed(1)} / 100</span>
                </div>
                <div className="subscore-track">
                  <div className="subscore-fill low" style={{ width: `${Math.min(confSub, 100)}%` }} />
                </div>
                <span className="subscore-desc">NASA FIRMS detection quality index.</span>
              </div>
            </div>
          </div>

          {/* Section E: Operational Decision Logic */}
          <div className="inspector-section">
            <div className="inspector-section-header">
              <ShieldCheck size={16} className="text-cyan" />
              <h3>Section E &bull; Operational Decision &amp; Incident Justification</h3>
            </div>
            <div className={`decision-justification-card ${riskClass}`}>
              <div className="decision-header">
                <strong>EVALUATION SUMMARY FOR {cluster_id}:</strong>
              </div>
              <p className="decision-text">
                {risk_level === 'CRITICAL' && (
                  <>
                    This incident exhibits <strong>extreme thermal power ({maxFrp.toFixed(1)} MW)</strong> directly within an industrial boundary zone ({distMeters.toFixed(1)} m from {nearest_facility_name}) with an <strong>acute unprecedented heat surge</strong>. 
                    Because this is not a routine daily recurring flare, the operational flaring discount is not applied, resulting in a critical score of <strong>{risk_score.toFixed(1)}/100</strong>.
                  </>
                )}
                {risk_level === 'HIGH' && (
                  <>
                    Elevated thermal energy observed in close proximity to an industrial facility ({distMeters.toFixed(1)} m from {nearest_facility_name}). 
                    Requires priority cross-examination against plant operational logs and drone inspection.
                  </>
                )}
                {risk_level === 'MODERATE' && (
                  <>
                    Thermal anomaly detected inside an industrial facility with continuous multi-day recurrence (P<sub>ratio</sub> = {persistenceRatio.toFixed(2)}). 
                    The operational flaring discount is active to suppress false alarms while continuing automated baseline tracking.
                  </>
                )}
                {risk_level === 'LOW' && (
                  <>
                    Thermal anomaly located in remote rural terrain ({distMeters.toFixed(1)} m from nearest industry) with low radiant energy. 
                    Safely classified as rural/agricultural background activity.
                  </>
                )}
              </p>
              <div className="decision-action-box">
                <span>MANDATED DISPATCH PROTOCOL:</span>
                <strong>{action_code}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentDetailModal;
