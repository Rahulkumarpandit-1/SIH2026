import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup, useMap, CircleMarker, Tooltip } from 'react-leaflet';
import { useTheme } from '../context/ThemeContext';
import { useRegion } from '../context/RegionContext';
import { MAP_PROVIDERS } from '../services/mapConfig';
import MapLayerControl from './MapLayerControl';
import { getDataStatus, deriveConsistentTemporalMetrics } from '../utils/dataProvenance';
import { OperationalPriorityBadge, calculateOperationalPriority, compareOperationalPriority } from '../utils/priorityEngine';
import { formatToIST } from '../utils/dateUtils';

// Helper component to smoothly animate/focus the map when selected cluster changes or corridor switches
const MapFocusController = ({ targetCoords, regionCenter, regionZoom, regionCode }) => {
  const map = useMap();
  const centerLat = regionCenter?.[0];
  const centerLon = regionCenter?.[1];

  // Whenever corridor switches, ALWAYS fly to the selected region center & default zoom
  useEffect(() => {
    if (centerLat !== undefined && centerLon !== undefined && !isNaN(centerLat) && !isNaN(centerLon)) {
      map.flyTo([centerLat, centerLon], regionZoom ?? 5, {
        duration: 1.4,
        easeLinearity: 0.25
      });
    }
  }, [regionCode, centerLat, centerLon, regionZoom, map]);

  // When targetCoords is specified (e.g. user clicked cluster), fly to target cluster
  useEffect(() => {
    if (targetCoords && targetCoords.length === 2 && !isNaN(targetCoords[0]) && !isNaN(targetCoords[1])) {
      map.flyTo(targetCoords, Math.max(map.getZoom(), 12), {
        duration: 1.2,
        easeLinearity: 0.25
      });
    }
  }, [targetCoords, map]);

  return null;
};

export const getRiskColor = (level, score) => {
  const normalized = String(level || '').toUpperCase();
  if (normalized === 'CRITICAL' || (score !== undefined && score >= 75)) return '#EF4444'; // Bright Red
  if (normalized === 'HIGH' || (score !== undefined && score >= 50)) return '#F97316';     // Safety Orange
  if (normalized === 'MEDIUM' || normalized === 'MODERATE' || (score !== undefined && score >= 25)) return '#EAB308'; // Bright Yellow
  return '#10B981'; // Operational Green
};

export const GISMapView = ({
  observations = [],
  clusters = [],
  riskData = [],
  industrialPolygons = null,
  selectedCluster,
  onSelectCluster,
  onSelectObservation
}) => {
  const { isDark } = useTheme();
  const { currentRegion } = useRegion();
  const [layerType, setLayerType] = useState('satellite');
  // Default startup: Show LIVE + RECENT ('OPERATIONAL'), hide HISTORICAL and DEMO
  const [statusFilter, setStatusFilter] = useState('OPERATIONAL'); // 'OPERATIONAL' | 'LIVE' | 'RECENT' | 'HISTORICAL' | 'DEMO' | 'ALL'
  const [telemetryFilter, setTelemetryFilter] = useState('ALL'); // 'ALL' | 'CLUSTERS' | 'LIVE_PIXELS'
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 1024 : false));
  // In default on mobile / tablet / split view (<= 1200px), map legend is ALWAYS collapsed (false)
  const [legendOpen, setLegendOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 1200 : false));
  const [legendMinimized, setLegendMinimized] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (mobile) {
        setLegendOpen(false); // Strictly auto-collapse on mobile/narrow viewports
      }
    };
    handleResize(); // Execute on initial mount so mobile view always starts completely clean
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeProvider = MAP_PROVIDERS[layerType] || MAP_PROVIDERS.streets;
  const defaultCenter = currentRegion?.center || [21.7679, 78.8718];
  const defaultZoom = currentRegion?.default_zoom || 5;

  // Enrich clusters with deterministic risk scores and levels
  const enrichedClusters = useMemo(() => {
    const riskMap = new Map((riskData || []).map((r) => [r.cluster_id, r]));
    return (clusters || []).map((cluster) => {
      const risk = riskMap.get(cluster.cluster_id);
      const risk_score = risk?.risk_score ?? cluster.risk_score ?? 0;
      let risk_level = risk?.risk_level ?? cluster.risk_level;
      if (!risk_level) {
        if (risk_score >= 75) risk_level = 'CRITICAL';
        else if (risk_score >= 50) risk_level = 'HIGH';
        else if (risk_score >= 25) risk_level = 'MODERATE';
        else risk_level = 'LOW';
      }
      return {
        ...cluster,
        stream_type: cluster.stream_type || risk?.stream_type || 'historical',
        live_detections_count: cluster.live_detections_count || risk?.live_detections_count || 0,
        risk_score,
        risk_level,
        action_code: risk?.action_code ?? cluster.action_code ?? 'ROUTINE_MONITORING',
        incident_classification: risk?.incident_classification ?? cluster.incident_classification,
        nearest_facility_name: risk?.nearest_facility_name || cluster.nearest_facility_name || 'Industrial Facility',
        last_detected: cluster.last_detected || risk?.last_detected,
        first_detected: cluster.first_detected || risk?.first_detected,
      };
    });
  }, [clusters, riskData]);

  // Operational breakdown counts
  const statusCounts = useMemo(() => {
    let live = 0;
    let recent = 0;
    let historical = 0;
    let demo = 0;

    enrichedClusters.forEach((c) => {
      const { status } = getDataStatus(c);
      if (status === 'LIVE') live++;
      else if (status === 'RECENT') recent++;
      else if (status === 'HISTORICAL') historical++;
      else if (status === 'DEMO') demo++;
    });

    return {
      live,
      recent,
      historical,
      demo,
      operational: live + recent,
      total: enrichedClusters.length,
    };
  }, [enrichedClusters]);

  // Filtered clusters based on active status filter
  const filteredClusters = useMemo(() => {
    return enrichedClusters.filter((c) => {
      const { status } = getDataStatus(c);
      if (statusFilter === 'OPERATIONAL') return status === 'LIVE' || status === 'RECENT';
      if (statusFilter === 'LIVE') return status === 'LIVE';
      if (statusFilter === 'RECENT') return status === 'RECENT';
      if (statusFilter === 'HISTORICAL') return status === 'HISTORICAL';
      if (statusFilter === 'DEMO') return status === 'DEMO';
      return true; // 'ALL'
    }).sort((a, b) => compareOperationalPriority(b, a));
  }, [enrichedClusters, statusFilter]);

  // Filtered observation pixels
  const filteredObservations = useMemo(() => {
    const validClusterIds = new Set(filteredClusters.map((c) => c.cluster_id));
    return observations.filter((obs) => {
      if (telemetryFilter === 'LIVE_PIXELS') {
        if (obs.stream_type !== 'near_real_time') return false;
      }
      if (statusFilter === 'ALL') return true;
      if (obs.cluster_id && !validClusterIds.has(obs.cluster_id)) {
        // Only show isolated observations if statusFilter is ALL or OPERATIONAL for NRT
        if (statusFilter === 'OPERATIONAL' && obs.stream_type === 'near_real_time') return true;
        return false;
      }
      return true;
    });
  }, [observations, filteredClusters, statusFilter, telemetryFilter]);

  const targetCoords = useMemo(() => {
    if (selectedCluster?.centroid_latitude && selectedCluster?.centroid_longitude) {
      return [selectedCluster.centroid_latitude, selectedCluster.centroid_longitude];
    }
    return null;
  }, [selectedCluster]);

  const polygonStyle = {
    color: isDark ? '#00E5FF' : '#175CD3',
    weight: 1.5,
    opacity: 0.85,
    fillColor: isDark ? '#00E5FF' : '#175CD3',
    fillOpacity: isDark ? 0.12 : 0.09,
    dashArray: '4, 4'
  };

  const onEachPolygon = (feature, layer) => {
    const props = feature.properties || {};
    const name = props.name || props['name:en'] || 'Industrial Facility';
    const fType = props.landuse || props.industrial || 'industrial zone';

    layer.bindTooltip(`
      <div style="font-family: inherit; font-size: 0.76rem; padding: 3px;">
        <strong style="color: ${isDark ? '#38BDF8' : '#175CD3'}">${name}</strong><br/>
        <span style="opacity: 0.75; text-transform: uppercase; font-size: 0.68rem;">${fType}</span>
      </div>
    `, { sticky: true });
  };

  return (
    <div className="gis-map-viewport" style={{ width: '100%', height: isMobile ? '65vh' : '82vh', minHeight: isMobile ? '65vh' : '82vh', position: 'relative' }}>
      {/* Floating Basemap Selector */}
      <MapLayerControl
        activeLayer={layerType}
        onSelectLayer={setLayerType}
      />

      {/* Incident Workflow Quick Filters: [ LIVE ] [ RECENT ] [ HISTORICAL ] [ DEMO ] [ ALL ] */}
      <div className="map-workflow-quick-filters">
        <button
          type="button"
          className={`map-wf-pill ${statusFilter === 'OPERATIONAL' ? 'active-operational' : ''}`}
          onClick={() => setStatusFilter('OPERATIONAL')}
          title="Default Operational Startup: Shows LIVE and RECENT incidents"
        >
          <span className="dsb-live-dot" style={{ width: 6, height: 6 }} />
          <span>OPERATIONAL ({statusCounts.operational})</span>
        </button>
        <button
          type="button"
          className={`map-wf-pill ${statusFilter === 'LIVE' ? 'active-live' : ''}`}
          onClick={() => setStatusFilter('LIVE')}
          title="Last detection <= 24 hours"
        >
          <span className="dsb-live-dot" style={{ width: 6, height: 6 }} />
          <span>LIVE ({statusCounts.live})</span>
        </button>
        <button
          type="button"
          className={`map-wf-pill ${statusFilter === 'RECENT' ? 'active-recent' : ''}`}
          onClick={() => setStatusFilter('RECENT')}
          title="Last detection > 24 hours and <= 7 days"
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', display: 'inline-block' }} />
          <span>RECENT ({statusCounts.recent})</span>
        </button>
        <button
          type="button"
          className={`map-wf-pill ${statusFilter === 'HISTORICAL' ? 'active-historical' : ''}`}
          onClick={() => setStatusFilter('HISTORICAL')}
          title="Last detection > 7 days (Historical archive)"
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6B7280', display: 'inline-block' }} />
          <span>HISTORICAL ({statusCounts.historical})</span>
        </button>
        <button
          type="button"
          className={`map-wf-pill ${statusFilter === 'DEMO' ? 'active-demo' : ''}`}
          onClick={() => setStatusFilter('DEMO')}
          title="Seeded / fallback demonstration records"
        >
          <span style={{ color: '#F59E0B', fontWeight: 700 }}>⚠</span>
          <span>DEMO ({statusCounts.demo})</span>
        </button>
        <button
          type="button"
          className={`map-wf-pill ${statusFilter === 'ALL' ? 'active-all' : ''}`}
          onClick={() => setStatusFilter('ALL')}
          title="Show all recorded incidents"
        >
          <span>ALL ({statusCounts.total})</span>
        </button>
      </div>

      {/* Floating Map Legend Toggle Pill Button (Re-opens legend when collapsed) */}
      {!legendOpen && (
        <button
          type="button"
          className="map-legend-toggle-btn"
          onClick={() => setLegendOpen(true)}
          aria-label="Open Map Legend"
          title="Open Map Legend"
        >
          <span>🗺️ Map Legend</span>
        </button>
      )}

      {/* Backdrop for mobile legend sheet */}
      {isMobile && legendOpen && (
        <div 
          className="map-legend-backdrop"
          onClick={() => setLegendOpen(false)}
        />
      )}

      {/* Floating Map Legend (Collapsible on mobile and desktop) */}
      {legendOpen && (
        <div className={`map-legend-float ${isMobile ? 'mobile-expanded' : ''} ${legendMinimized ? 'minimized' : ''}`}>
          <div className="map-legend-header">
            <div className="map-legend-title">🗺️ Map Legend</div>
            <div className="map-legend-actions">
              <button
                type="button"
                onClick={() => setLegendMinimized(prev => !prev)}
                className="legend-action-btn"
                aria-label={legendMinimized ? "Expand Legend" : "Minimize Legend"}
                title={legendMinimized ? "Expand Legend" : "Minimize Legend"}
              >
                {legendMinimized ? '▢' : '—'}
              </button>
              <button
                type="button"
                onClick={() => setLegendOpen(false)}
                className="legend-action-btn legend-close-btn"
                aria-label="Close Legend"
                title="Close Legend"
              >
                ✕
              </button>
            </div>
          </div>
          {!legendMinimized && (
            <>
              <div className="map-legend-subtitle">Operational Priority</div>
              <div className="map-legend-items">
                <span className="map-legend-item">
                  <span className="legend-dot" style={{ background: '#EF4444', boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.45)' }} /> 
                  <span><strong>Critical Priority</strong> (Bright Red &bull; Pulsing Halo &ge;75)</span>
                </span>
                <span className="map-legend-item">
                  <span className="legend-dot" style={{ background: '#F97316', boxShadow: '0 0 0 2px rgba(249, 115, 22, 0.35)' }} /> 
                  <span><strong>High Priority</strong> (Orange &bull; Orange Halo 50-75)</span>
                </span>
                <span className="map-legend-item">
                  <span className="legend-dot" style={{ background: '#EAB308' }} /> 
                  <span><strong>Medium Priority</strong> (Yellow 25-50)</span>
                </span>
                <span className="map-legend-item">
                  <span className="legend-dot" style={{ background: '#10B981' }} /> 
                  <span><strong>Low Priority</strong> (Green &lt;25)</span>
                </span>
              </div>

              <div className="map-legend-subtitle" style={{ marginTop: '0.4rem' }}>Incident Recency Tier</div>
              <div className="map-legend-items">
                <span className="map-legend-item">
                  <span className="legend-dot" style={{ background: '#10B981', boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.4)' }} /> 
                  <span><strong>LIVE</strong> (&le;24h Green Pulse Ring)</span>
                </span>
                <span className="map-legend-item">
                  <span className="legend-dot" style={{ background: 'transparent', border: '2px solid #3B82F6' }} /> 
                  <span><strong>RECENT</strong> (24h–7d Blue Ring)</span>
                </span>
                <span className="map-legend-item">
                  <span className="legend-dot" style={{ background: 'transparent', border: '1.5px dashed #6B7280' }} /> 
                  <span><strong>HISTORICAL</strong> (&gt;7d Gray Dashed Ring)</span>
                </span>
                <span className="map-legend-item">
                  <span className="legend-dot" style={{ background: 'transparent', border: '1.5px dashed #F59E0B' }} /> 
                  <span><strong>DEMO</strong> (Seeded Amber Dashed Ring)</span>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <MapContainer
        key={`gis-map-${currentRegion?.region_code || 'ALL_INDIA'}-${layerType}`}
        center={defaultCenter}
        zoom={defaultZoom}
        zoomControl={!isMobile}
        preferCanvas={true}
        style={{ width: '100%', height: '100%', minHeight: isMobile ? '65vh' : '82vh' }}
        scrollWheelZoom={true}
      >
        <MapFocusController 
          targetCoords={targetCoords} 
          regionCenter={currentRegion?.center}
          regionZoom={currentRegion?.default_zoom}
          regionCode={currentRegion?.region_code}
        />

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

        {/* Industrial Polygons (Filtered: only polygons/multipolygons, never default blue point markers) */}
        {industrialPolygons && industrialPolygons.features && industrialPolygons.features.length > 0 && (
          <GeoJSON
            key={`poly-${industrialPolygons.features.length}-${isDark ? 'dark' : 'light'}`}
            data={industrialPolygons}
            style={polygonStyle}
            onEachFeature={onEachPolygon}
            filter={(feature) => feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')}
            pointToLayer={() => null}
          />
        )}

        {/* Hotspot observations (raw sensor pixels) */}
        {(telemetryFilter === 'ALL' || telemetryFilter === 'LIVE_PIXELS') && filteredObservations.map((obs) => {
          const isLive = obs.stream_type === 'near_real_time';
          // Color based on risk level, score, or thermal FRP/temperature intensity
          const obsLevel = String(obs.risk_level || '').toUpperCase();
          const obsScore = obs.risk_score;
          const obsColor = (obsLevel === 'CRITICAL' || (obsScore !== undefined && obsScore >= 75) || (obs.frp && obs.frp >= 40) || (obs.brightness && obs.brightness >= 360))
            ? '#EF4444'
            : (obsLevel === 'HIGH' || (obsScore !== undefined && obsScore >= 50) || (obs.frp && obs.frp >= 20) || (obs.brightness && obs.brightness >= 340))
            ? '#F97316'
            : (obsLevel === 'MODERATE' || obsLevel === 'MEDIUM' || (obsScore !== undefined && obsScore >= 25) || (obs.frp && obs.frp >= 10) || (obs.brightness && obs.brightness >= 325))
            ? '#EAB308'
            : '#10B981';

          return (
            <CircleMarker
              key={`map-obs-${obs.observation_id || obs.id}-${obs.latitude}-${obs.longitude}`}
              center={[obs.latitude, obs.longitude]}
              radius={isLive ? 2.0 : 1.2}
              pathOptions={{
                fillColor: obsColor,
                fillOpacity: isLive ? 0.85 : 0.5,
                color: isLive ? '#047857' : (isDark ? '#0D1117' : '#FFFFFF'),
                weight: isLive ? 0.6 : 0.3
              }}
            >
              <Tooltip sticky>
                <div style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                  <strong>Satellite Obs #{obs.observation_id || obs.id}</strong><br />
                  Status: <span style={{ color: isLive ? '#10B981' : '#6B7280', fontWeight: 700 }}>
                    {isLive ? '🟢 LIVE (Near-Real-Time VIIRS)' : '⚪ Historical Record'}
                  </span><br />
                  FRP: <strong>{(obs.frp ?? 0).toFixed(1)} MW</strong> &bull; Temp: {obs.brightness} K<br />
                  Cluster: <strong>{obs.cluster_id || 'Isolated'}</strong><br />
                  {obs.nearest_facility_name}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Physical Cluster Centroids — Priority-first, LIVE pulsing only */}
        {(telemetryFilter === 'ALL' || telemetryFilter === 'CLUSTERS') && filteredClusters.map((cluster) => {
          const isSelected = selectedCluster?.cluster_id === cluster.cluster_id;

          // Synthesize operational priority & temporal metrics
          const priority = calculateOperationalPriority(cluster);
          const temporal = deriveConsistentTemporalMetrics(cluster);
          const isDemo = temporal.status === 'DEMO';
          const isLive = temporal.status === 'LIVE';
          const isHistorical = temporal.status === 'HISTORICAL';

          // Operational Color Coding: Reflect intrinsic risk severity (Red for Critical, Orange for High, Yellow for Medium, Green for Low)
          const cScore = cluster.risk_score ?? priority.score ?? 0;
          const cLevel = String(cluster.risk_level || priority.level || '').toUpperCase();
          const markerColor = getRiskColor(cLevel, cScore);

          // Historical: muted fill opacity to reduce visual clutter, but maintain clear color distinction
          const fillOpacity = isHistorical ? 0.60 : 0.90;

          // Crisp, professional radii scaled by operational priority (Critical: 5.5, High: 4.2, Medium: 3.2, Low: 2.5)
          const radius = priority.level === 'CRITICAL' ? 5.5 : priority.level === 'HIGH' ? 4.2 : priority.level === 'MEDIUM' ? 3.2 : 2.5;

          // Status Ring — Subtle radar outline without heavy fill tint
          const ringConfig = {
            LIVE:       { color: '#10B981', dashArray: null,  weight: 0.9, fillOpacity: 0, radius: radius + 1.8, className: 'gis-pulse-ring-live' },
            RECENT:     { color: '#3B82F6', dashArray: null,  weight: 0.8, fillOpacity: 0, radius: radius + 1.4, className: '' },
            HISTORICAL: { color: '#6B7280', dashArray: '2,3', weight: 0.6, fillOpacity: 0, radius: radius + 1.2, className: '' },
            DEMO:       { color: '#F59E0B', dashArray: '2,2', weight: 0.8, fillOpacity: 0, radius: radius + 1.4, className: '' },
          };
          const ring = ringConfig[temporal.status] || ringConfig.HISTORICAL;

          // For popup display
          const rColor = markerColor;

          return (
            <React.Fragment key={`map-cluster-group-${cluster.cluster_id}`}>
              {/* CRITICAL + LIVE only: Subtle pulsing red halo */}
              {priority.level === 'CRITICAL' && isLive && (
                <CircleMarker
                  center={[cluster.centroid_latitude, cluster.centroid_longitude]}
                  radius={radius + 3.2}
                  pathOptions={{
                    fillColor: '#EF4444',
                    fillOpacity: 0.16,
                    color: '#DC2626',
                    weight: 0.9,
                    className: 'gis-pulse-halo-crit',
                    interactive: false,
                  }}
                />
              )}

              {/* HIGH + LIVE only: Subtle orange halo */}
              {priority.level === 'HIGH' && isLive && (
                <CircleMarker
                  center={[cluster.centroid_latitude, cluster.centroid_longitude]}
                  radius={radius + 2.4}
                  pathOptions={{
                    fillColor: '#F97316',
                    fillOpacity: 0.12,
                    color: '#EA580C',
                    weight: 0.8,
                    className: 'gis-pulse-halo-high',
                    interactive: false,
                  }}
                />
              )}

              {/* Outer status ring */}
              <CircleMarker
                center={[cluster.centroid_latitude, cluster.centroid_longitude]}
                radius={ring.radius}
                pathOptions={{
                  fillColor: ring.color,
                  fillOpacity: ring.fillOpacity,
                  color: ring.color,
                  weight: ring.weight,
                  dashArray: ring.dashArray,
                  className: ring.className,
                  interactive: false,
                }}
              />

              {/* Cluster Centroid Dot */}
              <CircleMarker
                center={[cluster.centroid_latitude, cluster.centroid_longitude]}
                radius={radius}
                pathOptions={{
                  fillColor: markerColor,
                  fillOpacity,
                  color: isSelected ? '#00E5FF' : (isDark ? '#0D1117' : '#FFFFFF'),
                  weight: isSelected ? 2.0 : 0.6,
                }}
                eventHandlers={{ click: () => onSelectCluster(cluster) }}
              >
                {/* Compact 6-field popup */}
                <Popup>
                  <div className="gis-clean-popup">
                    {isDemo && (
                      <div className="gis-popup-demo-banner">
                        <span>⚠ DEMO DATA &mdash; Seeded Record</span>
                      </div>
                    )}
                    <div className="gis-popup-header">
                      <div className="gis-popup-facility-name">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: rColor, display: 'inline-block', flexShrink: 0 }} />
                        <strong title={cluster.nearest_facility_name || cluster.facility_name || cluster.cluster_id}>
                          {cluster.nearest_facility_name || cluster.facility_name || cluster.cluster_id}
                        </strong>
                      </div>
                      <OperationalPriorityBadge incident={cluster} size="sm" />
                    </div>
                    <div className="gis-popup-grid">
                      <div className="gis-popup-row">
                        <span className="gis-popup-k">Risk Score</span>
                        <span className="gis-popup-v" style={{ color: rColor, fontWeight: 700 }}>
                          {(cluster.risk_score ?? 0).toFixed(1)}/100 ({cluster.risk_level})
                        </span>
                      </div>
                      <div className="gis-popup-row">
                        <span className="gis-popup-k">Status</span>
                        <span className="gis-popup-v" style={{ color: temporal.config?.color, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          {isLive && <span className="dsb-live-dot" style={{ width: 5, height: 5 }} />}
                          {temporal.config?.label || temporal.status}
                        </span>
                      </div>
                      <div className="gis-popup-row">
                        <span className="gis-popup-k">Last Detection</span>
                        <span className="gis-popup-v font-mono" style={{ fontSize: '0.72rem' }}>
                          {temporal.lastDetectedStr ? formatToIST(temporal.lastDetectedStr) : 'Unknown'}
                          {temporal.freshnessLabel && ` (${temporal.freshnessLabel})`}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-black-primary gis-popup-cta"
                      onClick={() => onSelectCluster(cluster)}
                    >
                      View Details &rarr;
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default GISMapView;
