import React from 'react';
import { ArrowLeft, MapPin, Radio, Clock, Gauge, ShieldAlert, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, GeoJSON } from 'react-leaflet';

export const IncidentDetailPage = ({ incident, industrialPolygons, onBack }) => {
  if (!incident) return null;

  const {
    cluster_id = 'CLUSTER_001',
    risk_score = 0.0,
    risk_level = 'LOW',
    action_code = 'BACKGROUND_LOG',
    incident_classification = 'INDUSTRIAL_ANOMALY',
    subscores = {},
    telemetry = {},
    nearest_facility_name = 'Industrial Facility',
    nearest_facility_type = 'Industrial Zone',
    spatial_context = 'INDUSTRIAL_PERIMETER',
    centroid_latitude = 22.0,
    centroid_longitude = 71.0
  } = incident;

  const thermalSub = subscores.thermal_subscore ?? 0.0;
  const proxSub = subscores.proximity_subscore ?? 0.0;
  const persSub = subscores.persistence_subscore ?? 0.0;
  const confSub = subscores.confidence_subscore ?? 0.0;

  const maxFrp = telemetry.max_frp ?? 0.0;
  const avgFrp = telemetry.avg_frp ?? telemetry.max_frp ?? 0.0;
  const maxBrightness = telemetry.max_brightness ?? 300.0;
  const thermalContrast = telemetry.thermal_contrast ?? (maxBrightness - 290.0);
  const totalDetections = telemetry.total_detections ?? 1;
  const distMeters = telemetry.distance_to_industry_meters ?? 0.0;
  const persistenceRatio = telemetry.persistence_ratio ?? 0.0;
  const activeDays = telemetry.active_days_count ?? 1;
  const isSpike = telemetry.is_anomaly_spike ?? false;

  const mapCenter = [centroid_latitude, centroid_longitude];
  const isCrit = risk_level === 'CRITICAL';
  const isHigh = risk_level === 'HIGH';

  return (
    <div className="incident-report-page">
      {/* Back Button */}
      <button className="btn-text-link" onClick={onBack} style={{ width: 'fit-content', textDecoration: 'none' }}>
        <ArrowLeft size={14} />
        <span>&larr; Back to Incident Queue</span>
      </button>

      {/* Incident Header Block */}
      <div className="report-header-block">
        <div className="section-tag">INCIDENT INTELLIGENCE REPORT &bull; SIH26162</div>
        <div className="report-title-row">
          <h1 className="report-cluster-id font-mono">{cluster_id}</h1>
          <div className="report-score-pill">
            <span className={isCrit ? 'text-critical' : isHigh ? 'text-warning' : ''}>
              {risk_score.toFixed(2)}
            </span>
            <span className="text-muted" style={{ fontSize: '0.9rem', fontWeight: 500 }}> / 100</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          <span className={`status-indicator-tag ${isCrit ? 'critical' : risk_level.toLowerCase()}`}>
            {risk_level}
          </span>
          <span className="text-muted">&bull;</span>
          <span className="font-bold">{nearest_facility_name}</span>
          <span className="text-muted">&bull;</span>
          <span className="font-mono text-critical font-bold">{action_code}</span>
        </div>

        <div className="text-secondary" style={{ fontSize: '0.88rem' }}>
          Centroid Coordinates: {centroid_latitude?.toFixed(4)}°N, {centroid_longitude?.toFixed(4)}°E &bull; Context: {spatial_context}
        </div>
      </div>

      {/* VERIFICATION & EVIDENCE STATE BREAKDOWN */}
      <section className="spacious-section" style={{ padding: '0 0 1rem 0' }}>
        <div className="section-tag">VERIFICATION &amp; TELEMETRY PROVENANCE STATUS</div>
        <div className="situation-strip" style={{ margin: '0.75rem 0' }}>
          <div className="stat-node">
            <span className="stat-value font-mono text-info">DETECTED</span>
            <span className="stat-label">Satellite Detection</span>
          </div>
          <div className="stat-separator" />
          <div className="stat-node">
            <span className="stat-value font-mono text-secondary">UNLABELED</span>
            <span className="stat-label">Ground Truth Status</span>
          </div>
          <div className="stat-separator" />
          <div className="stat-node">
            <span className="stat-value font-mono text-warning">NOT READY</span>
            <span className="stat-label">Machine Learning</span>
          </div>
          <div className="stat-separator" />
          <div className="stat-node">
            <span className="stat-value font-mono">{risk_score.toFixed(1)} / 100</span>
            <span className="stat-label">Rule Engine Risk</span>
          </div>
        </div>
      </section>

      <div className="divider-sm" />

      {/* SECTION A: LOCATION INTELLIGENCE */}
      <section className="report-section">
        <span className="report-section-heading">01 &bull; Location Intelligence &amp; Geospatial Alignment</span>
        
        <div className="report-data-grid">
          <div className="report-data-item">
            <span className="report-data-label">Centroid Coordinates</span>
            <span className="report-data-val font-mono">{centroid_latitude?.toFixed(4)}°N, {centroid_longitude?.toFixed(4)}°E</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Nearest Identified Facility</span>
            <span className="report-data-val">{nearest_facility_name}</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Facility Landuse Type</span>
            <span className="report-data-val font-mono">{nearest_facility_type}</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Distance to Boundary</span>
            <span className={`report-data-val ${distMeters === 0 ? 'text-critical' : ''}`}>
              {distMeters === 0 ? '0.0 m (Inside Polygon)' : `${distMeters.toLocaleString()} m`}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Spatial Context Tier</span>
            <span className="report-data-val font-mono">{spatial_context}</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Geofence Registry</span>
            <span className="report-data-val">3,970 OSM Industrial Features</span>
          </div>
        </div>

        {/* Mini Interactive Map */}
        <div style={{ height: '280px', border: '1px solid var(--border-divider)', borderRadius: '4px', overflow: 'hidden', marginTop: '0.5rem' }}>
          <MapContainer
            center={mapCenter}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            {industrialPolygons && (
              <GeoJSON
                data={industrialPolygons}
                style={{
                  color: '#175CD3',
                  weight: 1.2,
                  fillColor: '#175CD3',
                  fillOpacity: 0.1
                }}
              />
            )}
            <CircleMarker
              center={mapCenter}
              radius={10}
              pathOptions={{
                fillColor: isCrit ? '#D92D20' : '#B7791F',
                fillOpacity: 0.9,
                color: '#FFFFFF',
                weight: 2
              }}
            />
          </MapContainer>
        </div>
      </section>

      {/* SECTION B: THERMAL EVIDENCE */}
      <section className="report-section">
        <span className="report-section-heading">02 &bull; Thermal Evidence &amp; Radiative Power</span>

        <div className="report-data-grid">
          <div className="report-data-item">
            <span className="report-data-label">Maximum FRP (Peak)</span>
            <span className="report-data-val font-mono text-critical">{maxFrp.toFixed(1)} MW</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Average FRP</span>
            <span className="report-data-val font-mono">{avgFrp.toFixed(1)} MW</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Peak Brightness (Channel I4)</span>
            <span className="report-data-val font-mono">{maxBrightness.toFixed(1)} K</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Thermal Contrast (ΔT)</span>
            <span className="report-data-val font-mono">{thermalContrast.toFixed(1)} K</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Sensor Detections</span>
            <span className="report-data-val font-mono">{totalDetections} Pixel Cluster</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Thermal Combustion Flux</span>
            <span className="report-data-val">{maxFrp >= 50 ? 'Severe Combustion' : maxFrp >= 20 ? 'Moderate Heat Output' : 'Low Radiative Flux'}</span>
          </div>
        </div>

        <p className="text-secondary" style={{ fontSize: '0.85rem', lineHeight: 1.55 }}>
          <strong>Physical Interpretation:</strong> Fire Radiative Power (FRP) measures instantaneous radiative energy emitted by combustion.
          Values exceeding 50 MW indicate intense industrial thermal flux significantly above routine background emissions.
        </p>
      </section>

      {/* SECTION C: TEMPORAL EVIDENCE */}
      <section className="report-section">
        <span className="report-section-heading">03 &bull; Temporal Persistence &amp; Anomaly Surge Evidence</span>

        <div className="report-data-grid">
          <div className="report-data-item">
            <span className="report-data-label">Active Detection Days</span>
            <span className="report-data-val font-mono">{activeDays} Days</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Persistence Ratio (Pratio)</span>
            <span className="report-data-val font-mono">{(persistenceRatio * 100).toFixed(0)}%</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Anomaly Surge Flag</span>
            <span className={`report-data-val ${isSpike ? 'text-critical' : ''}`}>
              {isSpike ? 'YES (UNPRECEDENTED SPIKE)' : 'NORMAL BASELINE'}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Temporal Behavior</span>
            <span className="report-data-val">
              {persistenceRatio >= 0.5 ? 'Continuous Multi-Day Flare' : isSpike ? 'Acute Sudden Outbreak' : 'Transient Thermal Hotspot'}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Flaring Discount</span>
            <span className="report-data-val font-mono">
              {persistenceRatio >= 0.5 ? 'APPLIED (Suppresses Alarm)' : 'NOT APPLIED'}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Persistence Subscore</span>
            <span className="report-data-val font-mono">{persSub.toFixed(2)} pts</span>
          </div>
        </div>

        <p className="text-secondary" style={{ fontSize: '0.85rem', lineHeight: 1.55 }}>
          <strong>Temporal Persistence Rationale:</strong> Routine petrochemical refinery flares burn continuously day-after-day (Pratio &ge; 0.5) and receive an operational discount to suppress false alerts. Sudden unprecedented thermal events trigger an anomaly surge penalty.
        </p>
      </section>

      {/* SECTION D: RISK ENGINE CALCULATION */}
      <section className="report-section">
        <span className="report-section-heading">04 &bull; Multi-Signal Risk Score Math (Phase 4 Deterministic Engine)</span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div className="bar-row-clean">
            <span>Thermal Intensity Subscore (35%)</span>
            <div className="track-clean">
              <div className={`fill-clean ${thermalSub >= 70 ? 'critical' : ''}`} style={{ width: `${Math.min(thermalSub, 100)}%` }} />
            </div>
            <strong className="font-mono">{thermalSub.toFixed(2)}</strong>
          </div>

          <div className="bar-row-clean">
            <span>Industrial Proximity Subscore (30%)</span>
            <div className="track-clean">
              <div className={`fill-clean ${proxSub >= 70 ? 'critical' : ''}`} style={{ width: `${Math.min(proxSub, 100)}%` }} />
            </div>
            <strong className="font-mono">{proxSub.toFixed(2)}</strong>
          </div>

          <div className="bar-row-clean">
            <span>Persistence &amp; Anomaly Subscore (25%)</span>
            <div className="track-clean">
              <div className={`fill-clean ${persSub >= 70 ? 'critical' : ''}`} style={{ width: `${Math.min(persSub, 100)}%` }} />
            </div>
            <strong className="font-mono">{persSub.toFixed(2)}</strong>
          </div>

          <div className="bar-row-clean">
            <span>Sensor Detection Quality (10%)</span>
            <div className="track-clean">
              <div className="fill-clean" style={{ width: `${Math.min(confSub, 100)}%` }} />
            </div>
            <strong className="font-mono">{confSub.toFixed(2)}</strong>
          </div>
        </div>

        <div className="formula-display-block" style={{ marginTop: '0.5rem' }}>
          Composite Risk Score = (0.35 &times; {thermalSub.toFixed(2)}) + (0.30 &times; {proxSub.toFixed(2)}) + (0.25 &times; {persSub.toFixed(2)}) + (0.10 &times; {confSub.toFixed(2)}) = <strong>{risk_score.toFixed(2)} / 100</strong>
        </div>
      </section>

      {/* SECTION E: OPERATIONAL DIRECTIVE */}
      <section className="report-section">
        <span className="report-section-heading">05 &bull; Operational Recommendation</span>

        <div className="report-action-box">
          <div>
            <span className="report-data-label">Mandated Action Directive</span>
            <div className="font-mono text-critical font-bold" style={{ fontSize: '1.4rem' }}>
              {action_code}
            </div>
          </div>

          <div className="text-secondary" style={{ fontSize: '0.85rem', maxWidth: '480px', lineHeight: 1.55 }}>
            {risk_level === 'CRITICAL' 
              ? 'High-priority emergency protocol: Immediate plant safety officer contact, emergency dispatch alert, and coordinated drone reconnaissance.'
              : risk_level === 'HIGH'
              ? 'Priority inspection directive: CCTV sensor verification and facility perimeter patrol within 30 minutes.'
              : risk_level === 'MODERATE'
              ? 'Operational background logging: Multi-day flare stack activity monitored for thermal deviations.'
              : 'Standard remote monitoring: Low-risk thermal signal in rural/agricultural boundary.'}
          </div>
        </div>
      </section>

      {/* SECTION F: SCIENTIFIC DISCLAIMER */}
      <section className="report-section" style={{ borderBottom: 'none' }}>
        <span className="report-section-heading">06 &bull; Scientific Disclaimer &amp; Verification Protocol</span>
        
        <div className="alert-callout-neutral">
          <div className="callout-icon text-muted"><HelpCircle size={22} /></div>
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: '0.3rem' }}>Decision Support vs Legal Confirmation</h4>
            <p className="text-secondary" style={{ fontSize: '0.84rem', lineHeight: 1.55 }}>
              A satellite infrared pixel represents an approximate 375m &times; 375m (VIIRS) or 1km &times; 1km (MODIS) spatial footprint. 
              The Risk Score is a <strong>decision-support prioritization metric</strong> to assist disaster management and fire authorities in allocating physical inspection resources. It does not constitute autonomous legal confirmation of an accident without independent human or ground-truth verification.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default IncidentDetailPage;
