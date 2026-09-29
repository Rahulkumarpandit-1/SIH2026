import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Radio, 
  Clock, 
  Gauge, 
  ShieldAlert, 
  AlertTriangle, 
  AlertOctagon,
  CheckCircle2, 
  HelpCircle, 
  Wind, 
  CloudSun, 
  Compass, 
  Users, 
  Building2, 
  Trees, 
  Activity, 
  TrendingUp, 
  Zap, 
  History, 
  FileCheck2, 
  Database,
  Cpu,
  Layers,
  Thermometer,
  ShieldCheck,
  Info
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, GeoJSON, Tooltip } from 'react-leaflet';
import { useTheme } from '../context/ThemeContext';
import { MAP_PROVIDERS } from '../services/mapConfig';
import { apiService } from '../services/api';
import MapLayerControl from '../components/MapLayerControl';
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
import { OperationalPriorityBadge, calculateOperationalPriority } from '../utils/priorityEngine';
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
    action_directive = null,
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
    centroid_longitude = 71.0,
    state = 'Gujarat',
    region_code = 'WEST_GUJARAT'
  } = incident;

  // Subscores
  const thermalSub = subscores.thermal_subscore ?? 0.0;
  const proxSub = subscores.proximity_subscore ?? 0.0;
  const persSub = subscores.persistence_subscore ?? 0.0;
  const confSub = subscores.confidence_subscore ?? 0.0;

  // Telemetry
  const maxFrp = telemetry.max_frp ?? incident.peak_frp ?? 0.0;
  const avgFrp = telemetry.avg_frp ?? (maxFrp > 0 ? maxFrp * 0.75 : 0.0);
  const maxBrightness = telemetry.max_brightness ?? 335.0;
  const thermalContrast = telemetry.thermal_contrast ?? (maxBrightness > 300 ? maxBrightness - 295.0 : 18.5);
  const totalDetections = telemetry.total_detections ?? incident.detection_count ?? 1;
  const distMeters = telemetry.distance_to_industry_meters ?? incident.distance_to_industry_meters ?? 0.0;
  const persistenceRatio = telemetry.persistence_ratio ?? incident.persistence_ratio ?? 0.0;
  const activeDays = telemetry.active_days_count ?? 1;
  const isSpike = telemetry.is_anomaly_spike ?? false;

  // CRITICAL LOGIC: Facility Association Threshold Rule (Section 6)
  // Outside 1,000m threshold -> Facility Association is strictly NONE
  const isFacilityAssociated = distMeters <= 1000;
  const associatedFacilityName = isFacilityAssociated ? nearest_facility_name : 'NONE';
  const associationMethod = isFacilityAssociated 
    ? (distMeters === 0 ? 'OSM Geofence In-Polygon' : 'Buffer Perimeter (<= 1,000m)')
    : 'Outside 1,000m association radius';

  // Weather Context (Section 10)
  const wx = weather_context || incident.weather_context || null;
  const windSpeed = wx?.wind_speed_kmh ?? null;
  const windDirDeg = wx?.wind_direction_deg ?? null;
  const windCardinal = wx?.wind_cardinal ?? 'N/A';
  const downwindHeading = wx?.plume_dispersion_heading || wx?.downwind_heading || 'N/A';
  const temperatureC = wx?.temperature_c ?? null;
  const cloudCover = wx?.cloud_cover_pct ?? null;
  const precipitationMm = wx?.precipitation_mm ?? null;
  const obsConfidence = wx?.observation_confidence ?? 'UNKNOWN';

  // Exposure Context (Section 10)
  const exp = exposure_context || incident.exposure_context || null;
  const popExp = exp?.population_exposure ?? 'LOW';
  const infraExp = exp?.infrastructure_exposure ?? 'LOW';
  const envExp = exp?.environmental_exposure ?? 'LOW';
  const downwindExp = exp?.downwind_exposure ?? 'LOW';
  const expSummary = exp?.exposure_summary ?? '';
  const nearbyAssets = exp?.nearby_assets ?? [];
  const downwindConeGeoJson = exp?.downwind_cone_geojson ?? null;

  // Facility Fingerprint Baseline (Section 7)
  // Only applicable if facility is actually associated!
  const fp = (isFacilityAssociated && (facility_fingerprint || incident.facility_fingerprint)) || null;
  const baselineFrp = fp?.baseline_frp ?? null;
  const maxHistFrp = fp?.max_historical_frp ?? null;
  const excursionRatio = (baselineFrp && baselineFrp > 0 && maxFrp) ? (maxFrp / baselineFrp).toFixed(2) : null;
  const fpPersistenceDays = fp?.persistence_days ?? activeDays;
  const fpFrequency = fp?.event_frequency ?? 'Routine Operational Monitoring';
  const fpSeasonality = fp?.seasonal_behavior ?? 'Nominal Year-Round Radiance Profile';
  const hasBaselineAvailable = isFacilityAssociated && baselineFrp !== null;

  // Abnormality
  const ab = incident.abnormality_detection || null;
  const abScore = ab?.abnormality_score ?? null;
  const abStatus = ab?.abnormality_status ?? 'NORMAL';

  const mapCenter = [centroid_latitude, centroid_longitude];
  const incidentUuid = incident.incident_uuid || cluster_id;

  // Derive temporal classification and operational priority
  const consistentTemporal = deriveConsistentTemporalMetrics(incident);
  const operationalPriority = calculateOperationalPriority(incident);

  const temporalData = {
    first_detected: consistentTemporal.first_detected,
    last_detected: consistentTemporal.last_detected,
    incident_age_hours: consistentTemporal.incident_age_hours,
    active_duration_hours: consistentTemporal.active_duration_hours,
    detection_count: totalDetections,
    observation_freshness_minutes: consistentTemporal.freshness_minutes,
    temporal_status: consistentTemporal.temporal_status,
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
      {/* 1. Back Navigation Button */}
      <button 
        type="button"
        className="btn-text-link" 
        onClick={onBack} 
        style={{ width: 'fit-content', textDecoration: 'none', marginBottom: '0.75rem' }}
      >
        <ArrowLeft size={14} />
        <span>&larr; Back to Incident Queue</span>
      </button>

      {/* 2. Temporal Recency Banner */}
      <IncidentTemporalBanner
        lastDetected={temporalData.last_detected}
        temporalStatus={temporalData.temporal_status}
        isDemo={incident._isDemo || consistentTemporal.status === 'DEMO'}
      />

      {/* 
        ========================================================================
        HEADER: [PRIORITY] [RISK SCORE] [STATUS]
        Followed immediately by dense metadata matrix
        ========================================================================
      */}
      <div className="report-header-block" style={{ padding: '1.25rem 1.5rem', background: 'var(--bg-primary, #FFFFFF)', border: '1px solid var(--border-divider, #E2E8F0)', borderRadius: '4px', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
          {/* Left: Priority + Risk Score + Status Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* PRIORITY */}
            <OperationalPriorityBadge incident={incident} size="lg" showLabel={true} />

            {/* RISK SCORE */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: '0.25rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              border: '1px solid var(--border-divider, #CBD5E1)',
              background: 'var(--bg-secondary, #F8FAFC)',
              fontFamily: 'var(--font-mono)'
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>RISK</span>
              <strong style={{ fontSize: '1.1rem', color: risk_score >= 70 ? '#DC2626' : risk_score >= 45 ? '#EA580C' : '#059669' }}>
                {risk_score.toFixed(1)}
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 100</span>
            </div>

            {/* STATUS */}
            <DataStatusBadge incident={incident} size="lg" showSource={true} />
          </div>

          {/* Right: Operational Directive */}
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', display: 'block' }}>
              MANDATED OPERATIONAL DIRECTIVE
            </span>
            <strong className="font-mono" style={{ fontSize: '0.9rem', color: '#DC2626' }}>
              {action_directive || action_code?.replace(/_/g, ' ') || 'URGENT GROUND VERIFICATION'}
            </strong>
          </div>
        </div>

        {/* 
          Dense Metadata Matrix:
          Incident ID | First Detection | Latest Detection | Observation Age | Data Source | Sensor | Ground Truth | ML Readiness
        */}
        <div className="dense-meta-matrix">
          <div className="dense-meta-cell">
            <span className="dense-meta-label">Incident ID</span>
            <span className="dense-meta-val">{incidentUuid}</span>
          </div>

          <div className="dense-meta-cell">
            <span className="dense-meta-label">First Detection</span>
            <span className="dense-meta-val" style={{ fontSize: '0.78rem' }}>
              {formatToIST(temporalData.first_detected)}
            </span>
          </div>

          <div className="dense-meta-cell">
            <span className="dense-meta-label">Latest Detection</span>
            <span className="dense-meta-val" style={{ fontSize: '0.78rem' }}>
              {formatToIST(temporalData.last_detected)}
            </span>
          </div>

          <div className="dense-meta-cell">
            <span className="dense-meta-label">Observation Age</span>
            <span className="dense-meta-val">
              {consistentTemporal.formatted_freshness || formatRelativeAge(temporalData.last_detected, 'ago')}
            </span>
          </div>

          <div className="dense-meta-cell">
            <span className="dense-meta-label">Data Source</span>
            <span className="dense-meta-val">NASA FIRMS (NRT)</span>
          </div>

          <div className="dense-meta-cell">
            <span className="dense-meta-label">Sensor</span>
            <span className="dense-meta-val">VIIRS (375m) / MODIS (1km)</span>
          </div>

          <div className="dense-meta-cell">
            <span className="dense-meta-label">Ground Truth</span>
            <span className="dense-meta-val" style={{ color: assignedLabel !== 'UNLABELED' ? '#059669' : '#64748B' }}>
              {assignedLabel.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="dense-meta-cell">
            <span className="dense-meta-label">ML Readiness</span>
            <span className="dense-meta-val" style={{ color: '#D97706', fontSize: '0.78rem' }}>
              NOT READY (Data Gaps)
            </span>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        SECTION 1: THERMAL EVIDENCE SECTION (Section 5 of prompt)
        ========================================================================
      */}
      <section className="report-section" aria-label="Thermal Radiative Evidence">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <h2 className="report-section-heading" style={{ margin: 0 }}>
            01 &bull; Thermal Radiative Evidence
          </h2>
          <span className="font-mono text-secondary" style={{ fontSize: '0.75rem' }}>
            Sensory Telemetry Extraction
          </span>
        </div>

        <div className="report-data-grid" style={{ marginBottom: '0.85rem' }}>
          <div className="report-data-item">
            <span className="report-data-label">Peak Fire Radiative Power (FRP)</span>
            <span className="report-data-val font-mono" style={{ color: '#DC2626' }}>
              {maxFrp.toFixed(1)} MW
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Maximum detected radiative flux</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Average FRP</span>
            <span className="report-data-val font-mono">
              {avgFrp.toFixed(1)} MW
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mean cluster radiance</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Brightness Temperature</span>
            <span className="report-data-val font-mono">
              {maxBrightness.toFixed(1)} K
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Channel 4 mid-infrared (3.9&mu;m)</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Thermal Contrast (&Delta;T)</span>
            <span className="report-data-val font-mono">
              +{thermalContrast.toFixed(1)} K
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>T4 minus ambient T31</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Satellite Detections</span>
            <span className="report-data-val font-mono">
              {totalDetections} Overpass Passes
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Orbital multi-pixel footprint</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Observation Span</span>
            <span className="report-data-val font-mono">
              {activeDays} Day(s) ({((persistenceRatio) * 100).toFixed(0)}% Pratio)
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Multi-day temporal window</span>
          </div>
        </div>

        {/* CURRENT OBSERVATION vs HISTORICAL BASELINE Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '0.75rem',
          padding: '0.85rem 1rem',
          background: 'var(--bg-secondary, #F8FAFC)',
          border: '1px solid var(--border-divider, #E2E8F0)',
          borderRadius: '4px',
          marginBottom: '0.75rem'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              CURRENT SATELLITE OBSERVATION
            </div>
            <div className="font-mono font-bold" style={{ fontSize: '1.05rem', color: '#DC2626' }}>
              {maxFrp.toFixed(1)} MW Peak FRP &bull; {maxBrightness.toFixed(1)} K
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              Acute sensor detection during orbital overpass ({consistentTemporal.formatted_freshness || 'recent'}).
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              HISTORICAL BASELINE COMPARISON
            </div>
            {hasBaselineAvailable ? (
              <>
                <div className="font-mono font-bold" style={{ fontSize: '1.05rem', color: excursionRatio && excursionRatio > 2.0 ? '#DC2626' : '#059669' }}>
                  {baselineFrp.toFixed(1)} MW Baseline &bull; {excursionRatio}x Excursion Ratio
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  Authoritative historical operational baseline for {associatedFacilityName}.
                </div>
              </>
            ) : (
              <>
                <div className="font-mono font-bold" style={{ fontSize: '0.92rem', color: 'var(--text-muted)' }}>
                  NO FACILITY BASELINE AVAILABLE
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  Observation is unassociated with an industrial facility (&gt;1,000m). Facility baseline withheld.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mandatory Scientific Note */}
        <div className="op-scientific-note">
          <strong>Scientific Notice:</strong> Satellite thermal observations indicate detected radiative anomalies during orbital overpasses and do not independently confirm an active fire or emergency condition.
        </div>
      </section>

      {/* 
        ========================================================================
        SECTION 2: INDUSTRIAL / LOCATION INTELLIGENCE (Section 6 of prompt)
        ========================================================================
      */}
      <section className="report-section" aria-label="Industrial and Location Intelligence">
        <h2 className="report-section-heading">
          02 &bull; Industrial &amp; Location Intelligence
        </h2>

        <div className="report-data-grid" style={{ marginBottom: '0.85rem' }}>
          <div className="report-data-item">
            <span className="report-data-label">Incident Coordinates</span>
            <span className="report-data-val font-mono">
              {centroid_latitude?.toFixed(4)}°N, {centroid_longitude?.toFixed(4)}°E
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Centroid geodesic point</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Associated Industrial Facility</span>
            <span className="report-data-val" style={{ color: isFacilityAssociated ? 'var(--text-main)' : 'var(--text-muted)' }}>
              {associatedFacilityName}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {isFacilityAssociated ? nearest_facility_type : 'Outside threshold'}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Distance to Boundary</span>
            <span className={`report-data-val font-mono ${distMeters === 0 ? 'text-critical' : ''}`}>
              {distMeters === 0 ? '0.0 m (Inside Polygon)' : `${distMeters.toLocaleString()} m`}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Haversine geodesic distance</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Association Method</span>
            <span className="report-data-val font-mono" style={{ fontSize: '0.78rem' }}>
              {associationMethod}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>1,000m geofence policy</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Land-Use Context Tier</span>
            <span className="report-data-val font-mono">{spatial_context}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OSM land-use classification</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Historical Baseline Available</span>
            <span className="report-data-val font-mono" style={{ color: hasBaselineAvailable ? '#059669' : '#64748B' }}>
              {hasBaselineAvailable ? 'YES (Authoritative Profile)' : 'NO (Withheld)'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Baseline association state</span>
          </div>
        </div>

        {/* Association Policy Callout */}
        {!isFacilityAssociated && (
          <div className="op-scientific-note" style={{ borderLeftColor: '#64748B', marginBottom: '0.85rem' }}>
            <strong>Facility Association Policy:</strong> This observation is located {distMeters.toLocaleString()} meters from the nearest recorded industrial boundary, exceeding the 1,000m association threshold. Consequently, <strong>Facility Association is designated as NONE</strong>, and no facility-specific historical thermal baseline is applied.
          </div>
        )}

        {/* Mini Interactive Map with Highlighted Incident and Receptors */}
        <div style={{ height: '340px', border: '1px solid var(--border-divider, #E2E8F0)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
          <MapLayerControl activeLayer={layerType} onSelectLayer={setLayerType} />

          <MapContainer
            center={mapCenter}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer attribution={activeProvider.attribution} url={activeProvider.base} maxZoom={activeProvider.maxZoom || 18} />
            {activeProvider.labels && <TileLayer attribution="" url={activeProvider.labels} maxZoom={activeProvider.maxZoom || 18} />}

            {/* Industrial Polygons */}
            {industrialPolygons && (
              <GeoJSON
                key={`detail-poly-${isDark ? 'dark' : 'light'}`}
                data={industrialPolygons}
                style={{
                  color: isDark ? '#38BDF8' : '#2563EB',
                  weight: 1.5,
                  fillColor: isDark ? '#38BDF8' : '#2563EB',
                  fillOpacity: isDark ? 0.14 : 0.08
                }}
              />
            )}

            {/* Downwind Exposure Sector Overlay */}
            {downwindConeGeoJson && (
              <GeoJSON
                key={JSON.stringify(downwindConeGeoJson.properties || {})}
                data={downwindConeGeoJson}
                style={{
                  color: '#DC2626',
                  weight: 1.5,
                  dashArray: '4, 4',
                  fillColor: '#EF4444',
                  fillOpacity: 0.15
                }}
              />
            )}

            {/* 1.0 km Facility Association Buffer */}
            <CircleMarker
              center={mapCenter}
              radius={24}
              pathOptions={{
                color: '#2563EB',
                weight: 1,
                dashArray: '3, 6',
                fillOpacity: 0.03
              }}
            />

            {/* Incident Centroid Marker */}
            <CircleMarker
              center={mapCenter}
              radius={9}
              pathOptions={{
                fillColor: risk_score >= 70 ? '#DC2626' : risk_score >= 45 ? '#EA580C' : '#059669',
                fillOpacity: 0.95,
                color: '#FFFFFF',
                weight: 2
              }}
            />

            {/* Nearby Sensitive Receptors */}
            {nearbyAssets.map((asset, idx) => (
              <CircleMarker
                key={asset.asset_id || idx}
                center={[asset.latitude, asset.longitude]}
                radius={asset.is_downwind ? 6 : 4}
                pathOptions={{
                  fillColor: asset.is_downwind ? '#DC2626' : asset.category === 'POPULATION' ? '#7A5AF8' : asset.category === 'INFRASTRUCTURE' ? '#059669' : '#0284C7',
                  fillOpacity: 0.9,
                  color: '#FFFFFF',
                  weight: 1.5
                }}
              >
                <Tooltip sticky>
                  <div style={{ fontSize: '0.74rem' }}>
                    <strong>{asset.name}</strong><br />
                    Category: {asset.category} ({asset.distance_km} km {asset.cardinal_direction})<br />
                    {asset.is_downwind ? '⚠️ DOWNWIND EXPOSURE' : 'Lateral / Upwind'}
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.45rem', fontSize: '0.72rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          <span><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} /> Incident Centroid</span>
          <span><span style={{ width: 12, height: 8, background: 'rgba(239, 68, 68, 0.2)', border: '1px dashed #DC2626', display: 'inline-block' }} /> Downwind Direction Sector</span>
          <span><span style={{ width: 10, height: 8, border: '1px dashed #2563EB', display: 'inline-block' }} /> 1km Association Buffer</span>
          <span><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7A5AF8', display: 'inline-block' }} /> Population Receptor</span>
          <span><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', display: 'inline-block' }} /> Infrastructure Receptor</span>
        </div>
      </section>

      {/* 
        ========================================================================
        SECTION 3: HISTORICAL THERMAL INTELLIGENCE (Section 7 of prompt)
        ========================================================================
      */}
      <section className="report-section" aria-label="Historical Thermal Intelligence">
        <h2 className="report-section-heading">
          03 &bull; Historical Thermal Intelligence
        </h2>

        <p className="text-secondary" style={{ fontSize: '0.82rem', marginBottom: '0.85rem' }}>
          Longitudinal comparison determining whether current thermal activity is normal for this location or represents an anomalous operational departure.
        </p>

        <div className="report-data-grid" style={{ marginBottom: '0.85rem' }}>
          <div className="report-data-item">
            <span className="report-data-label">Current Observed FRP</span>
            <span className="report-data-val font-mono" style={{ color: '#DC2626' }}>
              {maxFrp.toFixed(1)} MW
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Historical Baseline FRP</span>
            <span className="report-data-val font-mono">
              {hasBaselineAvailable ? `${baselineFrp.toFixed(1)} MW` : 'N/A (Unassociated)'}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Historical Peak FRP</span>
            <span className="report-data-val font-mono">
              {hasBaselineAvailable && maxHistFrp ? `${maxHistFrp.toFixed(1)} MW` : 'N/A'}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Excursion Ratio</span>
            <span className="report-data-val font-mono" style={{ color: excursionRatio && excursionRatio > 2.0 ? '#DC2626' : 'var(--text-main)' }}>
              {excursionRatio ? `${excursionRatio}x Nominal` : 'N/A'}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Persistence &amp; Recurrence</span>
            <span className="report-data-val font-mono">
              {((persistenceRatio) * 100).toFixed(0)}% ({activeDays} Days)
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Seasonal Behavior</span>
            <span className="report-data-val" style={{ fontSize: '0.78rem' }}>
              {hasBaselineAvailable ? fpSeasonality : 'Seasonal rural background'}
            </span>
          </div>
        </div>

        {/* Engineering Assessment Box */}
        <div style={{
          padding: '0.75rem 1rem',
          background: 'var(--bg-secondary, #F8FAFC)',
          border: '1px solid var(--border-divider, #E2E8F0)',
          borderRadius: '4px',
          fontSize: '0.82rem',
          lineHeight: 1.55
        }}>
          <strong>Operational Assessment: </strong>
          <span className="text-secondary">
            {hasBaselineAvailable ? (
              excursionRatio && excursionRatio >= 2.0 ? (
                `Thermal radiative power (${maxFrp.toFixed(1)} MW) is ${excursionRatio} times above the nominal historical baseline (${baselineFrp.toFixed(1)} MW) for ${associatedFacilityName}. This represents an acute thermal departure from routine operational flaring.`
              ) : (
                `Observed thermal radiance (${maxFrp.toFixed(1)} MW) is consistent with the established historical operational baseline (${baselineFrp.toFixed(1)} MW) for ${associatedFacilityName}. Nominal flaring behavior indicated.`
              )
            ) : (
              `This anomaly is located outside documented industrial facility boundaries (${distMeters.toLocaleString()}m to nearest structure). Evaluated against nominal rural background thresholds. No facility baseline applied.`
            )}
          </span>
        </div>

        {/* Facility History Cards (rendered only if facility is actually associated) */}
        {isFacilityAssociated && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <FacilityHistoryCard facilityName={associatedFacilityName} />
            <FacilityRiskProfileCard facilityName={associatedFacilityName} />
          </div>
        )}
      </section>

      {/* 
        ========================================================================
        SECTION 4: EXPLAINABLE RISK SCORE (Section 8 of prompt)
        ========================================================================
      */}
      <section className="report-section" aria-label="Explainable Risk Score Breakdown">
        <h2 className="report-section-heading">
          04 &bull; Explainable Risk Score Breakdown
        </h2>

        <p className="text-secondary" style={{ fontSize: '0.82rem', marginBottom: '0.85rem' }}>
          Deterministic mathematical factor decomposition explaining what is driving the 0–100 composite risk score.
        </p>

        {/* Clean Horizontal Contribution Visualization */}
        <div style={{
          background: 'var(--bg-secondary, #F8FAFC)',
          border: '1px solid var(--border-divider, #E2E8F0)',
          borderRadius: '4px',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--border-divider, #E2E8F0)', paddingBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              RISK SCORE: <strong className="font-mono" style={{ color: risk_score >= 70 ? '#DC2626' : risk_score >= 45 ? '#EA580C' : '#059669' }}>{risk_score.toFixed(1)} / 100</strong>
            </span>
            <span className="font-mono text-secondary" style={{ fontSize: '0.75rem' }}>
              Phase 4 Deterministic Engine
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {/* Factor 1: Thermal Intensity */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                <span>Thermal Intensity (35% weight)</span>
                <strong className="font-mono">+{((thermalSub * 0.35)).toFixed(1)} pts</strong>
              </div>
              <div className="track-clean" style={{ height: '6px' }}>
                <div className="fill-clean" style={{ width: `${Math.min(thermalSub, 100)}%`, background: '#DC2626' }} />
              </div>
            </div>

            {/* Factor 2: Industrial Proximity */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                <span>Industrial Proximity (30% weight)</span>
                <strong className="font-mono">+{((proxSub * 0.30)).toFixed(1)} pts</strong>
              </div>
              <div className="track-clean" style={{ height: '6px' }}>
                <div className="fill-clean" style={{ width: `${Math.min(proxSub, 100)}%`, background: '#EA580C' }} />
              </div>
            </div>

            {/* Factor 3: Persistence & Anomaly */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                <span>Persistence / Anomaly Spike (25% weight)</span>
                <strong className="font-mono">+{((persSub * 0.25)).toFixed(1)} pts</strong>
              </div>
              <div className="track-clean" style={{ height: '6px' }}>
                <div className="fill-clean" style={{ width: `${Math.min(persSub, 100)}%`, background: '#0D9488' }} />
              </div>
            </div>

            {/* Factor 4: Sensor Quality */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                <span>Sensor Confidence (10% weight)</span>
                <strong className="font-mono">+{((confSub * 0.10)).toFixed(1)} pts</strong>
              </div>
              <div className="track-clean" style={{ height: '6px' }}>
                <div className="fill-clean" style={{ width: `${Math.min(confSub, 100)}%`, background: '#2563EB' }} />
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-divider, #E2E8F0)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700 }}>
            <span>Total Calculated Composite Risk</span>
            <span className="font-mono">{risk_score.toFixed(1)} / 100</span>
          </div>
        </div>

        {/* Detailed Risk Attribution & Abnormality Cards */}
        <RiskAttributionCard incidentUuid={incidentUuid} />
        <AbnormalityBreakdownCard incidentUuid={incidentUuid} />
        <SimilarIncidentsCard incidentUuid={incidentUuid} />
      </section>

      {/* 
        ========================================================================
        SECTION 5: OPERATIONAL PRIORITY (Section 9 of prompt)
        ========================================================================
      */}
      <section className="report-section" aria-label="Operational Priority">
        <h2 className="report-section-heading">
          05 &bull; Operational Priority &amp; Recommended Action
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '0.75rem',
          padding: '0.85rem 1rem',
          background: 'var(--bg-secondary, #F8FAFC)',
          border: '1px solid var(--border-divider, #E2E8F0)',
          borderRadius: '4px',
          marginBottom: '0.85rem'
        }}>
          <div>
            <span className="dense-meta-label">Risk Score</span>
            <div className="font-mono font-bold" style={{ fontSize: '1.1rem', color: risk_score >= 70 ? '#DC2626' : risk_score >= 45 ? '#EA580C' : '#059669' }}>
              {risk_score.toFixed(1)} / 100
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Hazard severity metric</span>
          </div>

          <div>
            <span className="dense-meta-label">Operational Priority</span>
            <div style={{ marginTop: '0.15rem' }}>
              <OperationalPriorityBadge incident={incident} size="md" showLabel={true} />
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Resource allocation tier</span>
          </div>

          <div>
            <span className="dense-meta-label">Recency Status</span>
            <div style={{ marginTop: '0.15rem' }}>
              <DataStatusBadge incident={incident} size="md" />
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Satellite pass recency</span>
          </div>

          <div>
            <span className="dense-meta-label">Action Directive</span>
            <div className="font-mono font-bold" style={{ fontSize: '0.85rem', color: '#DC2626', marginTop: '0.2rem' }}>
              {action_directive || action_code?.replace(/_/g, ' ') || 'URGENT GROUND VERIFICATION'}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Standard operational procedure</span>
          </div>
        </div>

        <ExecutiveSummaryCard incidentUuid={incidentUuid} />
      </section>

      {/* 
        ========================================================================
        SECTION 6: DOWNWIND EXPOSURE RISK (Section 10 of prompt)
        NOT Toxic Plume Prediction!
        ========================================================================
      */}
      <section className="report-section" aria-label="Downwind Exposure Risk">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 className="report-section-heading" style={{ margin: 0 }}>
              06 &bull; Downwind Exposure Risk
            </h2>
            <p className="text-secondary" style={{ fontSize: '0.74rem', margin: '0.15rem 0 0 0' }}>
              Multi-domain receptor screening based on meteorological heading and mapped population, infrastructure, and environmental assets.
            </p>
          </div>
          <span className="op-badge-pill op-badge-info">
            Atmospheric Exposure Model
          </span>
        </div>

        {/* Meteorology & Heading Strip */}
        <div className="report-data-grid" style={{ marginBottom: '0.85rem' }}>
          <div className="report-data-item">
            <span className="report-data-label">Wind Velocity</span>
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
            <span className="report-data-label">Downwind Heading</span>
            <span className="report-data-val font-mono font-bold" style={{ color: '#DC2626' }}>
              {downwindHeading}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Ambient Temperature</span>
            <span className="report-data-val font-mono">
              {temperatureC !== null ? `${temperatureC.toFixed(1)} °C` : 'N/A'}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Cloud Cover</span>
            <span className="report-data-val font-mono">
              {cloudCover !== null ? `${cloudCover}%` : 'N/A'}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Precipitation Rate</span>
            <span className="report-data-val font-mono">
              {precipitationMm !== null ? `${precipitationMm.toFixed(1)} mm/h` : '0.0 mm/h'}
            </span>
          </div>
        </div>

        {/* Exposure Domains Breakdown */}
        <div className="report-data-grid" style={{ marginBottom: '0.85rem' }}>
          <div className="report-data-item">
            <span className="report-data-label">Population Settlement Exposure</span>
            <span className={`report-data-val font-bold ${popExp === 'HIGH' ? 'text-critical' : popExp === 'MEDIUM' ? 'text-warning' : 'text-success'}`}>
              {popExp}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Critical Infrastructure Exposure</span>
            <span className={`report-data-val font-bold ${infraExp === 'HIGH' ? 'text-critical' : infraExp === 'MEDIUM' ? 'text-warning' : 'text-success'}`}>
              {infraExp}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Environmental Zone Exposure</span>
            <span className={`report-data-val font-bold ${envExp === 'HIGH' ? 'text-critical' : envExp === 'MEDIUM' ? 'text-warning' : 'text-success'}`}>
              {envExp}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Overall Downwind Exposure Sector</span>
            <span className={`report-data-val font-bold ${downwindExp === 'HIGH' ? 'text-critical' : downwindExp === 'MEDIUM' ? 'text-warning' : 'text-success'}`}>
              {downwindExp}
            </span>
          </div>
        </div>

        {/* Narrative & Receptors Table */}
        {expSummary && (
          <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-secondary, #F8FAFC)', border: '1px solid var(--border-divider, #E2E8F0)', borderRadius: '4px', fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '0.85rem' }}>
            <strong>Exposure Assessment Summary: </strong>
            <span className="text-secondary">{expSummary}</span>
          </div>
        )}

        {nearbyAssets.length > 0 && (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-divider, #E2E8F0)', borderRadius: '4px', marginBottom: '0.85rem' }}>
            <table className="op-health-table">
              <thead>
                <tr>
                  <th>Receptor Asset</th>
                  <th>Domain</th>
                  <th>Distance</th>
                  <th>Compass Heading</th>
                  <th>Downwind Sector</th>
                </tr>
              </thead>
              <tbody>
                {nearbyAssets.map((asset, idx) => (
                  <tr key={asset.asset_id || idx}>
                    <td>
                      <strong>{asset.name}</strong>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{asset.sub_type?.replace(/_/g, ' ')}</span>
                    </td>
                    <td>
                      <span className="op-badge-pill" style={{ 
                        background: asset.category === 'POPULATION' ? 'rgba(122, 90, 248, 0.1)' : asset.category === 'INFRASTRUCTURE' ? 'rgba(5, 150, 105, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                        color: asset.category === 'POPULATION' ? '#7A5AF8' : asset.category === 'INFRASTRUCTURE' ? '#059669' : '#2563EB'
                      }}>
                        {asset.category}
                      </span>
                    </td>
                    <td className="font-mono">
                      {asset.distance_km < 1.0 ? `${(asset.distance_km * 1000).toFixed(0)} m` : `${asset.distance_km.toFixed(2)} km`}
                    </td>
                    <td className="font-mono text-secondary">
                      {asset.cardinal_direction} ({asset.bearing_deg?.toFixed(0)}°)
                    </td>
                    <td>
                      {asset.is_downwind ? (
                        <span className="op-badge-pill op-badge-crit">DOWNWIND RECEPTOR</span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>Lateral / Upwind</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Explicit Scientific Boundary Notice */}
        <div className="op-scientific-note">
          <strong>Modeling Boundary:</strong> This is an exposure assessment based on weather and mapped receptors. It is NOT a toxic chemical plume simulation.
        </div>
      </section>

      {/* 
        ========================================================================
        SECTION 7: HUMAN VERIFICATION (Section 11 of prompt)
        ========================================================================
      */}
      <section className="report-section" aria-label="Human Verification and Ground Truth">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 className="report-section-heading" style={{ margin: 0 }}>
              07 &bull; Human Verification &amp; Ground Truth Audit
            </h2>
            <p className="text-secondary" style={{ fontSize: '0.74rem', margin: '0.15rem 0 0 0' }}>
              Certified analyst ground-truth classification. Ground verification is required before operational emergency dispatch.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`op-badge-pill ${assignedLabel !== 'UNLABELED' ? 'op-badge-live' : 'op-badge-low'}`}>
              STATUS: {assignedLabel.replace(/_/g, ' ')}
            </span>
            {isEdited && (
              <span className="op-badge-pill op-badge-high">
                <History size={11} />
                Edited ({editCount})
              </span>
            )}
          </div>
        </div>

        {assignedLabel === 'UNLABELED' && (
          <div className="op-scientific-note" style={{ borderLeftColor: '#D97706', marginBottom: '0.85rem' }}>
            <strong>Operational Rule:</strong> Ground verification required before operational response. Platform telemetry provides automated decision-support prioritization, not autonomous emergency confirmation.
          </div>
        )}

        <ReviewAuditTimeline
          auditLogs={incidentAuditLogs}
          incidentFilter={incidentUuid}
          loading={loadingAudit}
        />
      </section>

      {/* 
        ========================================================================
        SECTION 8: MACHINE LEARNING STATUS (Section 12 of prompt)
        ========================================================================
      */}
      <section className="report-section" aria-label="Machine Learning Readiness Status">
        <h2 className="report-section-heading">
          08 &bull; Machine Learning Architectural Status
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0.75rem',
          padding: '0.85rem 1rem',
          background: 'var(--bg-secondary, #F8FAFC)',
          border: '1px solid var(--border-divider, #E2E8F0)',
          borderRadius: '4px',
          marginBottom: '0.75rem'
        }}>
          <div>
            <span className="dense-meta-label">SUPERVISED ML STATUS</span>
            <div className="font-mono font-bold" style={{ fontSize: '0.92rem', color: '#D97706', marginTop: '0.2rem' }}>
              NOT READY
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              Reason: Insufficient verified ground-truth labels across independent spatial clusters.
            </div>
          </div>

          <div>
            <span className="dense-meta-label">SPATIAL CLUSTERING</span>
            <div className="font-mono font-bold" style={{ fontSize: '0.92rem', color: '#059669', marginTop: '0.2rem' }}>
              DBSCAN — ACTIVE
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              750m haversine radius groups contiguous 375m pixels into coherent incidents.
            </div>
          </div>

          <div>
            <span className="dense-meta-label">RISK ENGINE</span>
            <div className="font-mono font-bold" style={{ fontSize: '0.92rem', color: '#2563EB', marginTop: '0.2rem' }}>
              DETERMINISTIC — ACTIVE
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              Phase 4 multi-signal mathematical prioritization formula active in production.
            </div>
          </div>
        </div>

        <div className="op-scientific-note">
          <strong>Scientific Disclosure:</strong> To avoid spatial memorization, latitude and longitude coordinates are strictly barred from ML feature vectors. GroupKFold cross-validation is enforced.
        </div>
      </section>

      {/* 
        ========================================================================
        SECTION 9: INCIDENT TIMELINE (Section 13 of prompt)
        ========================================================================
      */}
      <section className="report-section" aria-label="Incident Timeline">
        <h2 className="report-section-heading">
          09 &bull; Chronological Incident Timeline
        </h2>
        <IncidentTimeline incidentUuid={incidentUuid} />
      </section>

      {/* 
        ========================================================================
        SECTION 10: DATA PROVENANCE (Section 16 of prompt)
        ========================================================================
      */}
      <section className="report-section" aria-label="Data Provenance">
        <h2 className="report-section-heading">
          10 &bull; Satellite Data Provenance
        </h2>

        <div className="report-data-grid" style={{ marginBottom: '0.75rem' }}>
          <div className="report-data-item">
            <span className="report-data-label">Source</span>
            <span className="report-data-val font-mono">NASA FIRMS</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Sensor</span>
            <span className="report-data-val font-mono">VIIRS (375m) / MODIS (1km)</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Data Stream</span>
            <span className="report-data-val font-mono">Near Real Time (NRT)</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Detection Timestamp</span>
            <span className="report-data-val font-mono" style={{ fontSize: '0.78rem' }}>
              {temporalData.last_detected ? formatToIST(temporalData.last_detected) : 'Recorded in Archive'}
            </span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">Observation Age</span>
            <span className="report-data-val font-mono">
              {consistentTemporal.formatted_freshness || formatRelativeAge(temporalData.last_detected, 'ago')}
            </span>
          </div>
        </div>

        <div className="op-scientific-note">
          <strong>Observation Timing Distinction:</strong> Observation time represents the satellite overpass and is not continuous ground telemetry.
        </div>
      </section>

      {/* Satellite Limitations Disclosure */}
      <ObservationLimitationsPanel />
    </div>
  );
};

export default IncidentDetailPage;
