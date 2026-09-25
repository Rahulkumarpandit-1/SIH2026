import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Radio, Clock, Gauge, ShieldAlert, AlertTriangle, CheckCircle2, HelpCircle, Wind, CloudRain, Compass, Users, Building2, Trees, Activity, TrendingUp, Zap, History, FileCheck2, Database } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, GeoJSON } from 'react-leaflet';
import { useTheme } from '../context/ThemeContext';
import { MAP_PROVIDERS } from '../services/mapConfig';
import { apiService } from '../services/api';
import MapLayerControl from '../components/MapLayerControl';
import IncidentTemporalPanel from '../components/IncidentTemporalPanel';
import IncidentTimeline from '../components/IncidentTimeline';
import IncidentTemporalBanner from '../components/IncidentTemporalBanner';
import ObservationLimitationsPanel from '../components/ObservationLimitationsPanel';
import FacilityHistoryCard from '../components/FacilityHistoryCard';
import FacilityRiskProfileCard from '../components/FacilityRiskProfileCard';
import ExecutiveSummaryCard from '../components/ExecutiveSummaryCard';
import RiskAttributionCard from '../components/RiskAttributionCard';
import AbnormalityBreakdownCard from '../components/AbnormalityBreakdownCard';
import SimilarIncidentsCard from '../components/SimilarIncidentsCard';
import { ReviewAuditTimeline } from '../components/ReviewAuditTimeline';
import DataStatusBadge from '../components/DataStatusBadge';
import DataProvenancePanel from '../components/DataProvenancePanel';
import { OperationalPriorityBadge } from '../utils/priorityEngine';
import { formatToIST, formatRelativeAge, formatTimestampWithRelative, deriveConsistentTemporalMetrics } from '../utils/dateUtils';

export const IncidentDetailPage = ({ incident, industrialPolygons, onBack }) => {
  const { isDark } = useTheme();
  const [layerType, setLayerType] = useState('satellite');
  const [incidentAuditLogs, setIncidentAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const activeProvider = MAP_PROVIDERS[layerType] || MAP_PROVIDERS.satellite || MAP_PROVIDERS.streets;
  if (!incident) return null;

  const {
    cluster_id = 'CLUSTER_001',
    risk_score = 0.0,
    risk_level = 'LOW',
    action_code = 'BACKGROUND_LOG',
    incident_classification = 'INDUSTRIAL_ANOMALY',
    subscores = {},
    telemetry = {},
    weather_context = null,
    exposure_context = null,
    facility_fingerprint = null,
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

  const wx = weather_context || incident.weather_context || null;
  const windSpeed = wx?.wind_speed_kmh ?? null;
  const windDirDeg = wx?.wind_direction_deg ?? null;
  const windCardinal = wx?.wind_cardinal ?? 'N/A';
  const plumeDispersion = wx?.plume_dispersion_heading ?? 'N/A';
  const temperatureC = wx?.temperature_c ?? null;
  const cloudCover = wx?.cloud_cover_pct ?? null;
  const precipitationMm = wx?.precipitation_mm ?? null;
  const obsConfidence = wx?.observation_confidence ?? 'UNKNOWN';
  const spreadConcern = wx?.spread_concern ?? 'NORMAL_MONITORING';

  const exp = exposure_context || incident.exposure_context || null;
  const popExp = exp?.population_exposure ?? 'LOW';
  const infraExp = exp?.infrastructure_exposure ?? 'LOW';
  const envExp = exp?.environmental_exposure ?? 'LOW';
  const downwindExp = exp?.downwind_exposure ?? 'LOW';
  const expSummary = exp?.exposure_summary ?? '';
  const nearbyAssets = exp?.nearby_assets ?? [];
  const downwindConeGeoJson = exp?.downwind_cone_geojson ?? null;

  const fp = facility_fingerprint || incident.facility_fingerprint || null;
  const baselineFrp = fp?.baseline_frp ?? null;
  const currentFpFrp = fp?.current_frp ?? maxFrp;
  const anomalyRatio = fp?.anomaly_ratio ?? (baselineFrp ? (currentFpFrp / baselineFrp).toFixed(2) : null);
  const thermalStatus = fp?.thermal_status ?? 'NORMAL';
  const fpExplanation = fp?.explanation ?? '';
  const maxHistFrp = fp?.max_historical_frp ?? 25.0;
  const fpPersistenceDays = fp?.persistence_days ?? activeDays;
  const fpFrequency = fp?.event_frequency ?? 'RECURRING_OPERATIONAL';
  const fpSeasonality = fp?.seasonal_behavior ?? 'Consistent Year-Round Emissions';

  const ab = incident.abnormality_detection || null;
  const abScore = ab?.abnormality_score ?? null;
  const abStatus = ab?.abnormality_status ?? 'NORMAL';
  const abIntensity = ab?.intensity_anomaly ?? null;
  const abPersistence = ab?.persistence_anomaly ?? null;
  const abGrowth = ab?.growth_anomaly ?? null;
  const abRecurrence = ab?.recurrence_anomaly ?? null;
  const abExplanation = ab?.explanation ?? [];
  const abNarrative = ab?.narrative ?? '';

  const mapCenter = [centroid_latitude, centroid_longitude];
  const isCrit = risk_level === 'CRITICAL';
  const isHigh = risk_level === 'HIGH';

  const incidentUuid = incident.incident_uuid || cluster_id;
  const currentStatus = incident.status || 'NEW';

  // Mathematically derive 100% consistent temporal data
  const rawTemporal = incident.temporal_intelligence || incident;
  const consistentTemporal = deriveConsistentTemporalMetrics({
    ...rawTemporal,
    first_detected: incident.first_detected || rawTemporal.first_detected,
    last_detected: incident.last_detected || rawTemporal.last_detected,
    observation_freshness_minutes: incident.observation_freshness_minutes ?? rawTemporal.observation_freshness_minutes
  });

  const temporalData = {
    first_detected: consistentTemporal.first_detected,
    last_detected: consistentTemporal.last_detected,
    incident_age_hours: consistentTemporal.incident_age_hours,
    active_duration_hours: consistentTemporal.active_duration_hours,
    detection_count: telemetry.total_detections ?? incident.detection_count ?? 1,
    observation_freshness_minutes: consistentTemporal.freshness_minutes,
    temporal_status: consistentTemporal.temporal_status,
    is_recently_observed: consistentTemporal.temporal_status === 'RECENTLY_OBSERVED',
    scientific_disclosure: rawTemporal.scientific_disclosure || 'Incident status is derived strictly from the latest available satellite infrared overpass (NASA FIRMS) and does not represent real-time physical ground truth.'
  };

  useEffect(() => {
    if (!incidentUuid) return;
    let isMounted = true;
    const fetchAudit = async () => {
      setLoadingAudit(true);
      try {
        const data = await apiService.getReviewAudit(incidentUuid);
        if (isMounted) setIncidentAuditLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load incident review audit:', err);
      } finally {
        if (isMounted) setLoadingAudit(false);
      }
    };
    fetchAudit();
    return () => { isMounted = false; };
  }, [incidentUuid]);

  const latestAudit = incidentAuditLogs.length > 0 ? incidentAuditLogs[0] : null;
  const assignedLabel = incident.assigned_label || (latestAudit?.new_label || 'UNLABELED');
  const isEdited = incident.is_edited || incidentAuditLogs.filter(l => l.action_type === 'UPDATE').length > 0;
  const editCount = incident.edit_count || incidentAuditLogs.filter(l => l.action_type === 'UPDATE').length;

  return (
    <div className="incident-report-page">
      {/* Back Button */}
      <button className="btn-text-link" onClick={onBack} style={{ width: 'fit-content', textDecoration: 'none', marginBottom: '0.75rem' }}>
        <ArrowLeft size={14} />
        <span>&larr; Back to Incident Queue</span>
      </button>

      {/* Incident Temporal Clarity Banner (Phase 13.1D — Precedes all analytics sections) */}
      <IncidentTemporalBanner
        lastDetected={temporalData.last_detected}
        temporalStatus={temporalData.temporal_status}
        isDemo={incident._isDemo || consistentTemporal.status === 'DEMO'}
      />

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
          {/* Operational Priority Badge (Multi-signal synthesis) */}
          <OperationalPriorityBadge incident={incident} size="md" showTooltip={true} />
          {/* Data Provenance Status Badge */}
          <DataStatusBadge incident={incident} size="lg" showSource={true} />
          <span className="text-muted">&bull;</span>
          <span className="font-bold">{nearest_facility_name}</span>
          <span className="text-muted">&bull;</span>
          <span className="font-mono text-critical font-bold">{action_code}</span>
          {assignedLabel !== 'UNLABELED' && (
            <>
              <span className="text-muted">&bull;</span>
              <span className="font-mono font-bold text-success" style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10B981', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                {assignedLabel.replace(/_/g, ' ')}
              </span>
            </>
          )}
          {isEdited && (
            <span 
              className="font-mono"
              title={`Label modified ${editCount} time(s)`}
              style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <History size={11} />
              Edited ({editCount})
            </span>
          )}
        </div>

        <div className="text-secondary" style={{ fontSize: '0.88rem' }}>
          Centroid Coordinates: {centroid_latitude?.toFixed(4)}°N, {centroid_longitude?.toFixed(4)}°E &bull; Context: {spatial_context}
        </div>
      </div>

      {/* 5-Field Operational Intelligence & Provenance Card */}
      <section className="spacious-section" style={{ padding: '0 0 1rem 0' }}>
        <div className="section-tag">OPERATIONAL DECISION SUPPORT &bull; DATA PROVENANCE</div>
        
        {consistentTemporal.status === 'DEMO' && (
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px dashed #F59E0B', borderRadius: '6px', padding: '0.75rem 1rem', margin: '0.65rem 0', color: '#B45309', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>⚠</span>
            <div>
              <strong>DEMO DATA &mdash; Seeded Demonstration Record</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                This record originates from seeded fallback demonstration data. It is not an active real satellite observation.
              </div>
            </div>
          </div>
        )}

        <div className="report-data-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', margin: '0.75rem 0' }}>
          <div className="report-data-item">
            <span className="report-data-label">Data Status</span>
            <span className="report-data-val" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <DataStatusBadge incident={incident} size="md" />
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Recency Classification</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Last Detection</span>
            <span className="report-data-val font-mono" style={{ fontSize: '0.82rem' }}>
              {temporalData.last_detected ? formatToIST(temporalData.last_detected) : 'Unknown'}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Exact satellite overpass</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Observation Age</span>
            <span className="report-data-val font-mono">
              {consistentTemporal.formatted_freshness || formatRelativeAge(temporalData.last_detected, '')}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Elapsed time since overpass</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Data Source</span>
            <span className="report-data-val font-mono" style={{ fontSize: '0.8rem' }}>
              {consistentTemporal.status === 'DEMO' ? 'Seeded Demonstration Dataset' : (consistentTemporal.source || 'NASA FIRMS VIIRS (NRT)')}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sensor data provenance</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Operational Priority</span>
            <span className="report-data-val">
              <OperationalPriorityBadge incident={incident} size="md" />
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Multi-signal operational tier</span>
          </div>
        </div>
      </section>

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
            <span className={`stat-value font-mono ${assignedLabel !== 'UNLABELED' ? 'text-success' : 'text-secondary'}`}>
              {assignedLabel.replace(/_/g, ' ')}
            </span>
            <span className="stat-label">Ground Truth {isEdited ? `(Edited ×${editCount})` : ''}</span>
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
        <div style={{ height: '320px', border: '1px solid var(--border-divider)', borderRadius: '4px', overflow: 'hidden', marginTop: '0.5rem', position: 'relative' }}>
          {/* Floating Basemap Selector */}
          <MapLayerControl
            activeLayer={layerType}
            onSelectLayer={setLayerType}
          />

          <MapContainer
            center={mapCenter}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={false}
          >
            {/* Base Map Tiles */}
            <TileLayer
              key={`base-${layerType}`}
              attribution={activeProvider.attribution}
              url={activeProvider.base}
              maxZoom={activeProvider.maxZoom || 18}
            />

            {/* Optional Reference Labels Layer */}
            {activeProvider.labels && (
              <TileLayer
                key={`labels-${layerType}`}
                attribution=""
                url={activeProvider.labels}
                maxZoom={activeProvider.maxZoom || 18}
              />
            )}

            {industrialPolygons && (
              <GeoJSON
                key={`detail-poly-${isDark ? 'dark' : 'light'}`}
                data={industrialPolygons}
                style={{
                  color: isDark ? '#00E5FF' : '#175CD3',
                  weight: 1.5,
                  fillColor: isDark ? '#00E5FF' : '#175CD3',
                  fillOpacity: isDark ? 0.14 : 0.1
                }}
              />
            )}
            {/* Downwind Hazard Plume Cone */}
            {downwindConeGeoJson && (
              <GeoJSON
                key={JSON.stringify(downwindConeGeoJson.properties || {})}
                data={downwindConeGeoJson}
                style={{
                  color: '#D92D20',
                  weight: 1.5,
                  dashArray: '4, 4',
                  fillColor: '#F04438',
                  fillOpacity: 0.18
                }}
              />
            )}
            {/* 2.0 km Exposure Radius Buffer */}
            <CircleMarker
              center={mapCenter}
              radius={24}
              pathOptions={{
                color: '#E04F16',
                weight: 1,
                dashArray: '3, 6',
                fillOpacity: 0.04
              }}
            />
            {/* Incident Centroid Marker */}
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
            {/* Nearby Sensitive Receptor Assets */}
            {nearbyAssets.map((asset, idx) => (
              <CircleMarker
                key={asset.asset_id || idx}
                center={[asset.latitude, asset.longitude]}
                radius={asset.is_downwind ? 7 : 5}
                pathOptions={{
                  fillColor: asset.is_downwind ? '#D92D20' : asset.category === 'POPULATION' ? '#7A5AF8' : asset.category === 'INFRASTRUCTURE' ? '#027A48' : '#0BA5EC',
                  fillOpacity: 0.9,
                  color: '#FFFFFF',
                  weight: 1.5
                }}
              />
            ))}
          </MapContainer>
        </div>

        {/* Interactive Map Visual Legend */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.45rem', fontSize: '0.74rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#D92D20', display: 'inline-block' }} /> Incident Centroid
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 12, height: 10, borderRadius: '2px', background: 'rgba(240, 68, 56, 0.25)', border: '1px dashed #D92D20', display: 'inline-block' }} /> Downwind Plume Sector
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7A5AF8', display: 'inline-block' }} /> Population
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#027A48', display: 'inline-block' }} /> Infrastructure
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0BA5EC', display: 'inline-block' }} /> Environmental
          </span>
        </div>
      </section>

      {/* SECTION 01B: DATA PROVENANCE */}
      <section className="report-section">
        <span className="report-section-heading">
          <Database size={13} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
          01B &bull; Data Source &amp; Observation Provenance
        </span>
        <DataProvenancePanel incident={incident} compact={false} />
      </section>

      <div className="divider-sm" />

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

        {/* Facility Thermal Fingerprint Baseline Comparison */}
        {fp && (
          <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: 'var(--bg-secondary, #F8FAFC)', borderRadius: '6px', border: '1px solid var(--border-divider, #E2E8F0)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Gauge size={16} className="text-secondary" />
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                  Facility Thermal Fingerprint &bull; Baseline Excursion Analysis
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`status-indicator-tag ${
                  thermalStatus === 'CRITICAL' ? 'critical' : thermalStatus === 'ABNORMAL' ? 'high' : thermalStatus === 'ELEVATED' ? 'warning' : 'success'
                }`} style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem' }}>
                  {thermalStatus} EXCURSION ({anomalyRatio}x BASELINE)
                </span>
              </div>
            </div>

            {/* Comparative Visual Bars: Baseline vs Current vs Historical Max */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', margin: '0.75rem 0' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.2rem' }}>
                  <span className="text-muted">Facility Historical Emission Baseline</span>
                  <span className="font-mono font-bold">{baselineFrp?.toFixed(1)} MW</span>
                </div>
                <div className="track-clean" style={{ height: '8px', background: 'var(--border-subtle)' }}>
                  <div className="fill-clean" style={{ width: `${Math.min(((baselineFrp || 10) / 100) * 100, 100)}%`, background: '#64748B' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.2rem' }}>
                  <span className="text-secondary font-bold">Observed Peak Incident FRP</span>
                  <span className={`font-mono font-bold ${thermalStatus === 'CRITICAL' || thermalStatus === 'ABNORMAL' ? 'text-critical' : ''}`}>
                    {currentFpFrp?.toFixed(1)} MW ({anomalyRatio}x)
                  </span>
                </div>
                <div className="track-clean" style={{ height: '10px', background: 'var(--border-subtle)' }}>
                  <div className={`fill-clean ${thermalStatus === 'CRITICAL' || thermalStatus === 'ABNORMAL' ? 'critical' : ''}`} style={{ width: `${Math.min(((currentFpFrp || 10) / 100) * 100, 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Facility Historical Fingerprint Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-divider, #E2E8F0)' }}>
              <div>
                <span className="report-data-label" style={{ fontSize: '0.7rem' }}>Historical Peak</span>
                <span className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{maxHistFrp?.toFixed(1)} MW</span>
              </div>
              <div>
                <span className="report-data-label" style={{ fontSize: '0.7rem' }}>Persistence Duration</span>
                <span className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{fpPersistenceDays} Days</span>
              </div>
              <div>
                <span className="report-data-label" style={{ fontSize: '0.7rem' }}>Event Recurrence</span>
                <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>{fpFrequency}</span>
              </div>
              <div>
                <span className="report-data-label" style={{ fontSize: '0.7rem' }}>Seasonal Dynamics</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{fpSeasonality}</span>
              </div>
            </div>

            {fpExplanation && (
              <p className="text-secondary" style={{ fontSize: '0.8rem', lineHeight: 1.5, margin: '0.65rem 0 0 0', fontStyle: 'italic' }}>
                {fpExplanation}
              </p>
            )}
          </div>
        )}
      </section>

      {/* SECTION 03: TEMPORAL INTELLIGENCE & OBSERVATION FRESHNESS */}
      <IncidentTemporalPanel
        temporalData={temporalData}
        incidentUuid={incidentUuid}
        currentStatus={currentStatus}
      />

      {/* SECTION 04: CHRONOLOGICAL INCIDENT TIMELINE */}
      <IncidentTimeline
        incidentUuid={incidentUuid}
      />

      {/* SECTION 05: FACILITY HISTORICAL INTELLIGENCE & LONGITUDINAL PROFILE */}
      <FacilityHistoryCard
        facilityName={nearest_facility_name}
      />
      <FacilityRiskProfileCard
        facilityName={nearest_facility_name}
      />

      {/* SECTION 06: EXECUTIVE INCIDENT SUMMARY & DECISION SUPPORT DIRECTIVE */}
      <ExecutiveSummaryCard
        incidentUuid={incidentUuid}
      />

      {/* SATELLITE OBSERVATION LIMITATIONS (Phase 13.1E) */}
      <ObservationLimitationsPanel />

      {/* SECTION 07: EXPLAINABLE RISK ATTRIBUTION BREAKDOWN */}
      <RiskAttributionCard
        incidentUuid={incidentUuid}
      />

      {/* SECTION 08: MULTI-DIMENSIONAL ABNORMALITY BREAKDOWN */}
      <AbnormalityBreakdownCard
        incidentUuid={incidentUuid}
      />

      {/* SECTION 09: HISTORICALLY SIMILAR INCIDENT PRECEDENTS */}
      <SimilarIncidentsCard
        incidentUuid={incidentUuid}
      />

      {/* SECTION D: WEATHER CONTEXT & ATMOSPHERIC DISPERSION */}
      <section className="report-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span className="report-section-heading" style={{ marginBottom: 0 }}>
            10 &bull; Real-Time Weather Context &amp; Atmospheric Dispersion
          </span>
          {wx && (
            <span className={`status-indicator-tag ${
              obsConfidence === 'HIGH' ? 'success' : obsConfidence === 'MEDIUM' ? 'warning' : 'critical'
            }`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
              Optical Observation Confidence: {obsConfidence}
            </span>
          )}
        </div>

        {wx ? (
          <>
            <div className="report-data-grid">
              <div className="report-data-item">
                <span className="report-data-label">Wind Velocity (10m)</span>
                <span className="report-data-val font-mono">
                  {windSpeed !== null ? `${windSpeed.toFixed(1)} km/h` : 'N/A'}
                </span>
              </div>

              <div className="report-data-item">
                <span className="report-data-label">Wind Direction</span>
                <span className="report-data-val font-mono">
                  {windDirDeg !== null ? `${windDirDeg}° (${windCardinal})` : 'N/A'}
                </span>
              </div>

              <div className="report-data-item">
                <span className="report-data-label">Downwind Dispersion Heading</span>
                <span className="report-data-val font-mono text-warning font-bold">
                  {plumeDispersion}
                </span>
              </div>

              <div className="report-data-item">
                <span className="report-data-label">Ambient Temperature (2m)</span>
                <span className="report-data-val font-mono">
                  {temperatureC !== null ? `${temperatureC.toFixed(1)} °C` : 'N/A'}
                </span>
              </div>

              <div className="report-data-item">
                <span className="report-data-label">Cloud Cover Fraction</span>
                <span className="report-data-val font-mono">
                  {cloudCover !== null ? `${cloudCover}%` : 'N/A'}
                </span>
              </div>

              <div className="report-data-item">
                <span className="report-data-label">Precipitation Rate</span>
                <span className={`report-data-val font-mono ${precipitationMm > 0 ? 'text-info' : ''}`}>
                  {precipitationMm !== null ? `${precipitationMm.toFixed(1)} mm/h` : '0.0 mm/h'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-secondary, #F8FAFC)', borderRadius: '6px', border: '1px solid var(--border-divider, #E2E8F0)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Wind size={16} className="text-secondary" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Plume Dispersion &amp; Fire Propagation Assessment</span>
              </div>
              <p className="text-secondary" style={{ fontSize: '0.82rem', lineHeight: 1.5, margin: 0 }}>
                {spreadConcern === 'PRECIPITATION_SUPPRESSION'
                  ? 'Active precipitation detected (> 0.5 mm/h). Atmospheric moisture actively suppresses ember propagation and reduces thermal runaway risk.'
                  : spreadConcern === 'CRITICAL_WIND_DRIVEN_SPREAD'
                  ? `High wind velocity (${windSpeed?.toFixed(1)} km/h) detected. Extreme risk of rapid downwind toxic plume and flame propagation towards ${plumeDispersion}.`
                  : spreadConcern === 'ELEVATED_SPREAD_POTENTIAL'
                  ? `Moderate wind velocity (${windSpeed?.toFixed(1)} km/h) detected. Enhanced risk of fire extension along downwind axis towards ${plumeDispersion}.`
                  : 'Low wind conditions (< 20 km/h) and dry conditions. Minimal wind-driven flame propagation; localized plume stagnation likely.'}
              </p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                <span className="text-muted">Cloud Attenuation: <strong>{cloudCover <= 30 ? 'Minimal (Clear Sky)' : cloudCover <= 70 ? 'Moderate (Partial Haze/Cloud)' : 'High (Dense Obscuration)'}</strong></span>
                <span className="text-muted">&bull;</span>
                <span className="text-muted">Observation Confidence: <strong>{obsConfidence}</strong> ({cloudCover <= 30 ? '0-30% Cloud' : cloudCover <= 70 ? '31-70% Cloud' : '71-100% Cloud'})</span>
                <span className="text-muted">&bull;</span>
                <span className="text-muted">Data Source: <strong>Open-Meteo Atmospheric Model (15m Cache)</strong></span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-muted" style={{ padding: '1rem 0', fontSize: '0.85rem' }}>
            Atmospheric weather context is currently unavailable or coordinates are outside coverage area.
          </div>
        )}
      </section>

      {/* SECTION E: EXPOSURE ANALYSIS & POTENTIAL IMPACT ZONE */}
      <section className="report-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span className="report-section-heading" style={{ marginBottom: 0 }}>
            11 &bull; Geospatial Exposure Analysis &amp; Potential Consequence Zone
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span className={`status-indicator-tag ${
              downwindExp === 'HIGH' ? 'critical' : downwindExp === 'MEDIUM' ? 'warning' : 'success'
            }`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
              Downwind Plume Hazard: {downwindExp}
            </span>
          </div>
        </div>

        <div className="report-data-grid">
          <div className="report-data-item">
            <span className="report-data-label">Population Settlement Exposure</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
              <span className={`status-indicator-tag ${
                popExp === 'HIGH' ? 'critical' : popExp === 'MEDIUM' ? 'warning' : 'success'
              }`}>
                {popExp} EXPOSURE
              </span>
            </div>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Critical Infrastructure Exposure</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
              <span className={`status-indicator-tag ${
                infraExp === 'HIGH' ? 'critical' : infraExp === 'MEDIUM' ? 'warning' : 'success'
              }`}>
                {infraExp} EXPOSURE
              </span>
            </div>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Environmental &amp; Ecological Exposure</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
              <span className={`status-indicator-tag ${
                envExp === 'HIGH' ? 'critical' : envExp === 'MEDIUM' ? 'warning' : 'success'
              }`}>
                {envExp} EXPOSURE
              </span>
            </div>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Atmospheric Downwind Sector</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
              <span className={`status-indicator-tag ${
                downwindExp === 'HIGH' ? 'critical' : downwindExp === 'MEDIUM' ? 'warning' : 'success'
              }`}>
                {downwindExp} SECTOR
              </span>
            </div>
          </div>
        </div>

        {/* Explainable Risk Impact Narrative */}
        {expSummary && (
          <div style={{ 
            marginTop: '0.75rem', 
            padding: '0.75rem 1rem', 
            background: downwindExp === 'HIGH' ? 'rgba(217, 45, 32, 0.05)' : 'var(--bg-secondary, #F8FAFC)', 
            borderRadius: '6px', 
            border: downwindExp === 'HIGH' ? '1px solid rgba(217, 45, 32, 0.25)' : '1px solid var(--border-divider, #E2E8F0)' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <ShieldAlert size={16} className={downwindExp === 'HIGH' ? 'text-critical' : 'text-secondary'} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Explainable Risk Consequence Narrative
              </span>
            </div>
            <p className="text-secondary" style={{ fontSize: '0.82rem', lineHeight: 1.55, margin: 0 }}>
              {expSummary}
            </p>
          </div>
        )}

        {/* Nearby & Downwind Receptor Assets Table */}
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
              Identified Assets in Incident Hazard Buffer ({nearbyAssets.length})
            </span>
          </div>

          {nearbyAssets.length > 0 ? (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-divider, #E2E8F0)', borderRadius: '6px' }}>
              <table className="data-table-clean" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary, #F8FAFC)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Asset Name</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Domain</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Distance</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Bearing / Axis</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Plume Status</th>
                  </tr>
                </thead>
                <tbody>
                  {nearbyAssets.map((asset, idx) => (
                    <tr key={asset.asset_id || idx} style={{ borderTop: '1px solid var(--border-divider, #E2E8F0)' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>
                        {asset.name}
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                          {asset.sub_type?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 600,
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          background: asset.category === 'POPULATION' ? 'rgba(122, 90, 248, 0.1)' : asset.category === 'INFRASTRUCTURE' ? 'rgba(2, 122, 72, 0.1)' : 'rgba(11, 165, 236, 0.1)',
                          color: asset.category === 'POPULATION' ? '#6938EF' : asset.category === 'INFRASTRUCTURE' ? '#027A48' : '#0BA5EC'
                        }}>
                          {asset.category}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }} className="font-mono">
                        {asset.distance_km < 1.0 
                          ? `${(asset.distance_km * 1000).toFixed(0)} m`
                          : `${asset.distance_km.toFixed(2)} km`}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }} className="font-mono text-secondary">
                        {asset.cardinal_direction} ({asset.bearing_deg.toFixed(0)}°)
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {asset.is_downwind ? (
                          <span className="status-indicator-tag critical" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}>
                            DOWNWIND HAZARD
                          </span>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.74rem' }}>
                            Lateral / Upwind
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted" style={{ fontSize: '0.82rem', margin: '0.5rem 0' }}>
              No documented sensitive receptors within 12 km search radius.
            </p>
          )}
        </div>
      </section>

      {/* SECTION F: RISK ENGINE CALCULATION */}
      <section className="report-section">
        <span className="report-section-heading">12 &bull; Multi-Signal Risk Score Math (Phase 4 Deterministic Engine)</span>

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

      {/* SECTION G: OPERATIONAL DIRECTIVE */}
      <section className="report-section">
        <span className="report-section-heading">13 &bull; Operational Recommendation &amp; Mandated Action Directive</span>

        <div className="report-action-box">
          <div>
            <span className="report-data-label">Recommended Operational Directive</span>
            <div className="font-mono text-critical font-bold" style={{ fontSize: '1.2rem', wordBreak: 'break-word' }}>
              {action_code}
            </div>
          </div>

          <div className="text-secondary" style={{ fontSize: '0.85rem', maxWidth: '480px', lineHeight: 1.55 }}>
            {risk_level === 'CRITICAL' 
              ? 'High Priority Investigation Required: Rapid site review, visual verification, and facility safety contact recommended. Ground verification is required before operational response decisions.'
              : risk_level === 'HIGH'
              ? 'Escalated Investigation Recommended: Check plant flaring logs and verify against historical thermal baseline.'
              : risk_level === 'MODERATE'
              ? 'Analyst Review Recommended: Automated tracking of known operational flares and persistent thermal sources.'
              : 'Routine Monitoring Recommended: Standard background observation of rural/agricultural thermal signatures.'}
          </div>
        </div>
      </section>

      {/* SECTION H: HUMAN INTELLIGENCE GROUND TRUTH & AUDIT TRAIL (Phase 14) */}
      <section className="report-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span className="report-section-heading">14 &bull; Human Intelligence Ground Truth &amp; Verification Audit Trail</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`status-indicator-tag ${assignedLabel !== 'UNLABELED' ? 'success' : 'neutral'} font-mono font-bold`} style={{ fontSize: '0.74rem' }}>
              LABEL: {assignedLabel.replace(/_/g, ' ')}
            </span>
            {isEdited && (
              <span 
                className="font-mono"
                style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 700, 
                  padding: '0.15rem 0.45rem', 
                  borderRadius: '4px', 
                  background: 'rgba(245, 158, 11, 0.12)', 
                  color: '#d97706', 
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <History size={11} />
                {editCount} Revision(s)
              </span>
            )}
          </div>
        </div>

        <p className="text-secondary" style={{ fontSize: '0.84rem', marginBottom: '1rem', lineHeight: 1.5 }}>
          Immutable verification trail recorded by certified human analysts. In strict compliance with scientific integrity standards,
          only verified human classifications form training truth for downstream ML models.
        </p>

        <ReviewAuditTimeline
          auditLogs={incidentAuditLogs}
          incidentFilter={incidentUuid}
          loading={loadingAudit}
        />
      </section>

      {/* SECTION I: SCIENTIFIC DISCLAIMER */}
      <section className="report-section" style={{ borderBottom: 'none' }}>
        <span className="report-section-heading">15 &bull; Scientific Disclaimer &amp; Verification Protocol</span>
        
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
