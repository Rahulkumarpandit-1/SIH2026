import React, { useState, useMemo, useEffect } from 'react';
import { 
  MapContainer, TileLayer, CircleMarker, GeoJSON, Popup, 
  Tooltip, useMap 
} from 'react-leaflet';
import L from 'leaflet';
import { Eye, Layers, RotateCcw, ArrowRight, MapPin, Radio, Activity, Clock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useRegion } from '../context/RegionContext';
import { MAP_PROVIDERS } from '../services/mapConfig';
import MapLayerControl from '../components/MapLayerControl';
import { getDataStatus, deriveConsistentTemporalMetrics } from '../utils/dataProvenance';
import { OperationalPriorityBadge, calculateOperationalPriority, compareOperationalPriority } from '../utils/priorityEngine';
import { formatToIST } from '../utils/dateUtils';

const MapFocusController = ({ targetCoords, triggerFitAll, clusters = [], regionCenter, regionZoom, regionCode }) => {
  const map = useMap();
  const centerLat = regionCenter?.[0];
  const centerLon = regionCenter?.[1];

  // Whenever corridor switches, ALWAYS fly to the selected region center & default zoom
  useEffect(() => {
    if (centerLat !== undefined && centerLon !== undefined && !isNaN(centerLat) && !isNaN(centerLon)) {
      map.flyTo([centerLat, centerLon], regionZoom ?? 5, { duration: 1.4 });
    }
  }, [regionCode, centerLat, centerLon, regionZoom, map]);

  // When targetCoords is specified (user clicked cluster), fly to that cluster
  useEffect(() => {
    if (targetCoords && targetCoords.length === 2 && !isNaN(targetCoords[0]) && !isNaN(targetCoords[1])) {
      map.flyTo(targetCoords, 13, { duration: 1.2 });
    }
  }, [targetCoords, map]);

  useEffect(() => {
    if (triggerFitAll && clusters.length > 0) {
      const bounds = L.latLngBounds(
        clusters.map((c) => [c.centroid_latitude, c.centroid_longitude])
      );
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [triggerFitAll, clusters, map]);

  return null;
};

export const GISExplorerPage = ({
  observations = [],
  clusters = [],
  riskData = [],
  industrialPolygons,
  onOpenIncidentDetail
}) => {
  const { isDark } = useTheme();
  const { currentRegion } = useRegion();
  const [layerType, setLayerType] = useState('satellite');

  const activeProvider = MAP_PROVIDERS[layerType] || MAP_PROVIDERS.streets;
  const safeObs = Array.isArray(observations) ? observations : [];
  const safeClusters = Array.isArray(clusters) ? clusters : [];
  const safeRisk = Array.isArray(riskData) ? riskData : [];

  const [showHotspots, setShowHotspots] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [showPolygons, setShowPolygons] = useState(true);
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  // Default startup: OPERATIONAL (LIVE + RECENT)
  const [statusFilter, setStatusFilter] = useState('OPERATIONAL');
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [targetCoords, setTargetCoords] = useState(null);
  const [triggerFitAll, setTriggerFitAll] = useState(0);
  const [secondsAgo, setSecondsAgo] = useState(0);
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

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset seconds ago when observations change
  useEffect(() => {
    setSecondsAgo(0);
  }, [observations.length]);

  // When active monitored corridor changes, reset targetCoords so map flies to the corridor view
  useEffect(() => {
    setTargetCoords(null);
    if (safeRisk.length > 0) {
      const sorted = [...safeRisk].sort(compareOperationalPriority);
      setSelectedCluster(sorted[0]);
    } else {
      setSelectedCluster(null);
    }
  }, [currentRegion?.region_code]);

  const defaultCenter = currentRegion?.center || [21.7679, 78.8718];
  const defaultZoom = currentRegion?.default_zoom || 5;

  const filteredClusters = useMemo(() => {
    return safeClusters.filter((item) => {
      const riskMeta = safeRisk.find((r) => r.cluster_id === item.cluster_id) || item;
      if (selectedRisk !== 'ALL' && riskMeta?.risk_level !== selectedRisk) return false;
      const { status } = getDataStatus(riskMeta);
      if (statusFilter === 'OPERATIONAL') return status === 'LIVE' || status === 'RECENT';
      if (statusFilter === 'LIVE') return status === 'LIVE';
      if (statusFilter === 'RECENT') return status === 'RECENT';
      if (statusFilter === 'HISTORICAL') return status === 'HISTORICAL';
      if (statusFilter === 'DEMO') return status === 'DEMO';
      return true;
    }).sort((a, b) => {
      const riskA = safeRisk.find((r) => r.cluster_id === a.cluster_id) || a;
      const riskB = safeRisk.find((r) => r.cluster_id === b.cluster_id) || b;
      return compareOperationalPriority(riskA, riskB);
    });
  }, [safeClusters, safeRisk, selectedRisk, statusFilter]);

  const filteredObservations = useMemo(() => {
    return safeObs.filter((item) => {
      if (selectedRisk !== 'ALL' && item.risk_level !== selectedRisk) return false;
      return true;
    });
  }, [safeObs, selectedRisk]);

  const handleClusterClick = (clusterItem) => {
    const fullRisk = safeRisk.find((r) => r.cluster_id === clusterItem.cluster_id) || clusterItem;
    setSelectedCluster(fullRisk);
    setTargetCoords([clusterItem.centroid_latitude, clusterItem.centroid_longitude]);
  };

  const getRiskColor = (level, score) => {
    const normalized = String(level || '').toUpperCase();
    if (normalized === 'CRITICAL' || (score !== undefined && score >= 75)) return '#EF4444';
    if (normalized === 'HIGH' || (score !== undefined && score >= 50)) return '#F97316';
    if (normalized === 'MODERATE' || (score !== undefined && score >= 25)) return '#F59E0B';
    return '#10B981';
  };

  return (
    <div className="gis-page">
      {/* Top Toolbar */}
      <div className="table-toolbar-clean">
        <div>
          <div className="section-tag">GEOSPATIAL INTELLIGENCE WORKSPACE</div>
          <h1 className="section-heading-lg" style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>
            GIS Explorer &bull; {currentRegion?.name || 'National Industrial Corridors'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <span>Interactive geospatial analysis with NASA satellite pixels, DBSCAN centroids, and 3,970 OSM boundary polygons.</span>
            <span className="font-mono text-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
              <Clock size={12} />
              <span>Telemetry updated {secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}</span>
            </span>
          </div>
        </div>

        {/* Live Filter Controls */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`filter-btn-text ${selectedRisk === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedRisk('ALL')}
          >
            All Severities ({safeClusters.length})
          </button>
          <button
            className={`filter-btn-text ${selectedRisk === 'CRITICAL' ? 'active' : ''}`}
            onClick={() => setSelectedRisk('CRITICAL')}
          >
            Critical Only
          </button>
          <button
            className={`filter-btn-text ${selectedRisk === 'HIGH' ? 'active' : ''}`}
            onClick={() => setSelectedRisk('HIGH')}
          >
            High Risk
          </button>
          <button
            className={`filter-btn-text ${selectedRisk === 'MODERATE' ? 'active' : ''}`}
            onClick={() => setSelectedRisk('MODERATE')}
          >
            Moderate
          </button>

          <button
            className="btn-outline-small"
            onClick={() => setTriggerFitAll((v) => v + 1)}
            title="Reset Map Zoom to all clusters"
          >
            <RotateCcw size={12} />
            <span>Fit All</span>
          </button>
        </div>
      </div>

      {/* Full Layout */}
      <div className="gis-full-layout">
        {/* Map Viewport */}
        <div className="gis-map-viewport" style={{ position: 'relative' }}>
          {/* Floating Basemap Selector */}
          <MapLayerControl
            activeLayer={layerType}
            onSelectLayer={setLayerType}
          />

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
            key={`gis-explorer-${currentRegion?.region_code || 'ALL_INDIA'}-${layerType}`}
            center={defaultCenter}
            zoom={defaultZoom}
            preferCanvas={true}
            style={{ width: '100%', height: '100%', minHeight: isMobile ? '72vh' : '82vh' }}
            scrollWheelZoom={true}
          >
            <MapFocusController 
              targetCoords={targetCoords} 
              triggerFitAll={triggerFitAll}
              clusters={filteredClusters}
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

            {/* Industrial Polygons Layer (Filtered: polygons only, no point pins) */}
            {showPolygons && industrialPolygons && (
              <GeoJSON
                key={`poly-${industrialPolygons.features?.length || 0}-${isDark ? 'dark' : 'light'}`}
                data={industrialPolygons}
                style={{
                  color: isDark ? '#00E5FF' : '#175CD3',
                  weight: 1.5,
                  fillColor: isDark ? '#00E5FF' : '#175CD3',
                  fillOpacity: isDark ? 0.12 : 0.09,
                  dashArray: '4, 4'
                }}
                filter={(feature) => feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')}
                pointToLayer={() => null}
                onEachFeature={(feature, layer) => {
                  const props = feature.properties || {};
                  const name = props.name || 'Industrial Facility';
                  layer.bindTooltip(`<strong>${name}</strong>`, { sticky: true });
                }}
              />
            )}

            {/* Hotspot Observation Points */}
            {showHotspots && filteredObservations.map((obs) => {
              const rColor = getRiskColor(obs.risk_level);
              return (
                <CircleMarker
                  key={`obs-${obs.observation_id}`}
                  center={[obs.latitude, obs.longitude]}
                  radius={5}
                  pathOptions={{
                    fillColor: rColor,
                    fillOpacity: 0.8,
                    color: isDark ? '#161B22' : '#FFFFFF',
                    weight: 1
                  }}
                >
                  <Tooltip sticky>
                    <div style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                      <strong>Observation #{obs.observation_id}</strong> &bull; {obs.frp} MW<br />
                      Cluster: {obs.cluster_id} &bull; {obs.acq_date}<br />
                      Stream: {obs.stream_type || 'historical'}
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}

            {/* Physical Cluster Centroids — Priority-first, LIVE pulsing, HISTORICAL muted */}
            {showClusters && filteredClusters.map((cluster) => {
              const riskMeta = safeRisk.find((r) => r.cluster_id === cluster.cluster_id) || cluster;
              const priority = calculateOperationalPriority(riskMeta);
              const temporal = deriveConsistentTemporalMetrics(riskMeta);
              const isDemo = temporal.status === 'DEMO';
              const isLive = temporal.status === 'LIVE';
              const isHistorical = temporal.status === 'HISTORICAL';
              const isSelected = selectedCluster?.cluster_id === cluster.cluster_id;

              const markerColor =
                priority.level === 'CRITICAL' ? '#EF4444' :
                priority.level === 'HIGH'     ? '#F97316' :
                priority.level === 'MEDIUM'   ? '#EAB308' : '#10B981';

              // Mute historical clusters visually
              const fillOpacity = isHistorical ? 0.30 : 0.95;
              const rColor = markerColor;
              const rScore = riskMeta?.risk_score ?? cluster.risk_score ?? 0;
              const rLevel = riskMeta?.risk_level ?? cluster.risk_level ?? 'LOW';

              const radius = priority.level === 'CRITICAL' ? 10 : priority.level === 'HIGH' ? 8.5 : priority.level === 'MEDIUM' ? 7 : 5.5;

              const ringConfig = {
                LIVE:       { color: '#10B981', dashArray: null,  weight: 2.5, fillOpacity: 0.18, radius: radius + 4,   className: 'gis-pulse-ring-live' },
                RECENT:     { color: '#3B82F6', dashArray: null,  weight: 2.0, fillOpacity: 0.10, radius: radius + 3.2, className: '' },
                HISTORICAL: { color: '#6B7280', dashArray: '4,4', weight: 1.0, fillOpacity: 0,    radius: radius + 2.5, className: '' },
                DEMO:       { color: '#F59E0B', dashArray: '3,3', weight: 1.8, fillOpacity: 0.10, radius: radius + 3,   className: '' },
              };
              const ring = ringConfig[temporal.status] || ringConfig.HISTORICAL;

              return (
                <React.Fragment key={`cluster-group-${cluster.cluster_id}`}>
                  {/* CRITICAL + LIVE only: Pulsing red halo */}
                  {priority.level === 'CRITICAL' && isLive && (
                    <CircleMarker
                      center={[cluster.centroid_latitude, cluster.centroid_longitude]}
                      radius={radius + 8}
                      pathOptions={{
                        fillColor: '#EF4444',
                        fillOpacity: 0.40,
                        color: '#DC2626',
                        weight: 2,
                        className: 'gis-pulse-halo-crit',
                        interactive: false,
                      }}
                    />
                  )}

                  {/* HIGH + LIVE only: Orange halo */}
                  {priority.level === 'HIGH' && isLive && (
                    <CircleMarker
                      center={[cluster.centroid_latitude, cluster.centroid_longitude]}
                      radius={radius + 6}
                      pathOptions={{
                        fillColor: '#F97316',
                        fillOpacity: 0.30,
                        color: '#EA580C',
                        weight: 1.8,
                        className: 'gis-pulse-halo-high',
                        interactive: false,
                      }}
                    />
                  )}

                  {/* Outer status ring — clear visual recency tier */}
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
                      weight: isSelected ? 2.5 : 1.5,
                    }}
                    eventHandlers={{ click: () => handleClusterClick(cluster) }}
                  >
                  <Popup>
                    <div className="gis-clean-popup">
                      {isDemo && (
                        <div className="gis-popup-demo-banner">
                          <span>⚠ DEMO DATA</span>
                        </div>
                      )}
                      <div className="gis-popup-header">
                        <div className="gis-popup-facility-name">
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: rColor, display: 'inline-block' }} />
                          <strong>{cluster.nearest_facility_name || cluster.cluster_id}</strong>
                        </div>
                        <OperationalPriorityBadge incident={riskMeta} size="sm" />
                      </div>
                      <div className="gis-popup-grid">
                        <div className="gis-popup-row">
                          <span className="gis-popup-k">Risk Score</span>
                          <span className="gis-popup-v" style={{ color: rColor, fontWeight: 700 }}>
                            {rScore.toFixed(1)}/100 ({rLevel})
                          </span>
                        </div>
                        <div className="gis-popup-row">
                          <span className="gis-popup-k">Status</span>
                          <span className="gis-popup-v" style={{ color: temporal.config.color, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                            {isLive && <span className="dsb-live-dot" style={{ width: 5, height: 5 }} />}
                            {temporal.config.label}
                          </span>
                        </div>
                        <div className="gis-popup-row">
                          <span className="gis-popup-k">Last Detection</span>
                          <span className="gis-popup-v font-mono" style={{ fontSize: '0.72rem' }}>
                            {temporal.lastDetectedStr ? formatToIST(temporal.lastDetectedStr) : 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <button 
                        className="btn-black-primary gis-popup-cta"
                        onClick={() => onOpenIncidentDetail(riskMeta || cluster)}
                      >
                        Inspect Report &rarr;
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            );
          })}
          </MapContainer>
        </div>

        {/* Clean Synchronized Sidebar */}
        <div className="gis-sidebar-clean">
          <div className="section-tag">SELECTED INCIDENT TELEMETRY</div>

          {selectedCluster ? (
            <>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {selectedCluster.cluster_id}
                </h3>
                <div className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '0.15rem' }}>
                  {selectedCluster.nearest_facility_name}
                </div>
              </div>

              <div className="sidebar-data-list">
                <div className="sidebar-row">
                  <span className="text-muted">Risk Score:</span>
                  <strong className={selectedCluster.risk_level === 'CRITICAL' ? 'text-critical font-mono' : 'font-mono'}>
                    {selectedCluster.risk_score?.toFixed(1)} / 100
                  </strong>
                </div>

                <div className="sidebar-row">
                  <span className="text-muted">Risk Tier:</span>
                  <span className={`status-indicator-tag ${selectedCluster.risk_level === 'CRITICAL' ? 'critical' : selectedCluster.risk_level === 'MODERATE' ? 'warning' : 'success'}`}>
                    {selectedCluster.risk_level}
                  </span>
                </div>

                <div className="sidebar-row">
                  <span className="text-muted">Action Code:</span>
                  <strong className="font-mono">{selectedCluster.action_code}</strong>
                </div>

                <div className="sidebar-row">
                  <span className="text-muted">Distance to Industry:</span>
                  <span className="font-mono">
                    {(selectedCluster.telemetry?.distance_to_industry_meters ?? 0) === 0 
                      ? '0.0 m (Inside)' 
                      : `${selectedCluster.telemetry?.distance_to_industry_meters} m`}
                  </span>
                </div>

                <div className="sidebar-row">
                  <span className="text-muted">Peak FRP:</span>
                  <span className="font-mono">{(selectedCluster.telemetry?.max_frp ?? 0).toFixed(1)} MW</span>
                </div>

                <div className="sidebar-row">
                  <span className="text-muted">Active Days:</span>
                  <span className="font-mono">{selectedCluster.telemetry?.active_days_count ?? 1} Days</span>
                </div>

                <div className="sidebar-row">
                  <span className="text-muted">Persistence Ratio:</span>
                  <span className="font-mono">{((selectedCluster.telemetry?.persistence_ratio ?? 0) * 100).toFixed(0)}%</span>
                </div>

                <div className="sidebar-row">
                  <span className="text-muted">Anomaly Spike:</span>
                  <span className={selectedCluster.telemetry?.is_anomaly_spike ? 'text-critical font-mono font-bold' : 'font-mono'}>
                    {selectedCluster.telemetry?.is_anomaly_spike ? 'YES (SPIKE)' : 'NO'}
                  </span>
                </div>

                <div className="sidebar-row">
                  <span className="text-muted">Detection Status:</span>
                  <span className="pill-badge pill-neutral font-mono">DETECTED</span>
                </div>

                {selectedCluster.weather_context && (
                  <div className="sidebar-row">
                    <span className="text-muted">Atmospheric Weather:</span>
                    <span className="font-mono" style={{ fontSize: '0.8rem' }}>
                      {selectedCluster.weather_context.wind_speed_kmh?.toFixed(0)} km/h {selectedCluster.weather_context.wind_cardinal} &bull; {selectedCluster.weather_context.temperature_c?.toFixed(0)}°C ({selectedCluster.weather_context.observation_confidence} Conf)
                    </span>
                  </div>
                )}

                {selectedCluster.exposure_context && (
                  <div className="sidebar-row">
                    <span className="text-muted">Exposure Impact:</span>
                    <span className="font-mono" style={{ fontSize: '0.8rem' }}>
                      Pop: <strong className={selectedCluster.exposure_context.population_exposure === 'HIGH' ? 'text-critical' : ''}>{selectedCluster.exposure_context.population_exposure}</strong> &bull; Downwind: <strong className={selectedCluster.exposure_context.downwind_exposure === 'HIGH' ? 'text-critical' : ''}>{selectedCluster.exposure_context.downwind_exposure}</strong>
                    </span>
                  </div>
                )}

                {selectedCluster.facility_fingerprint && selectedCluster.facility_fingerprint.thermal_status && (
                  <div className="sidebar-row">
                    <span className="text-muted">Thermal Baseline:</span>
                    <span className="font-mono" style={{ fontSize: '0.8rem' }}>
                      <strong className={
                        selectedCluster.facility_fingerprint.thermal_status === 'CRITICAL' ? 'text-critical' : 
                        selectedCluster.facility_fingerprint.thermal_status === 'ABNORMAL' ? 'text-warning' : ''
                      }>
                        {selectedCluster.facility_fingerprint.thermal_status}
                      </strong> ({selectedCluster.facility_fingerprint.anomaly_ratio}x Baseline)
                    </span>
                  </div>
                )}

                {selectedCluster.abnormality_detection && selectedCluster.abnormality_detection.abnormality_status && (
                  <div className="sidebar-row">
                    <span className="text-muted">Abnormality Status:</span>
                    <span className={`status-indicator-tag ${
                      selectedCluster.abnormality_detection.abnormality_status === 'SEVERELY_ABNORMAL' ? 'critical' :
                      selectedCluster.abnormality_detection.abnormality_status === 'ABNORMAL' ? 'high' :
                      selectedCluster.abnormality_detection.abnormality_status === 'ELEVATED' ? 'warning' : 'success'
                    }`} style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}>
                      {selectedCluster.abnormality_detection.abnormality_status.replace('_', ' ')} ({selectedCluster.abnormality_detection.abnormality_score?.toFixed(0)}/100)
                    </span>
                  </div>
                )}
              </div>

              <button 
                className="btn-black-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => onOpenIncidentDetail(selectedCluster)}
              >
                <span>View Full Incident Report &rarr;</span>
              </button>
            </>
          ) : (
            <p className="text-muted" style={{ fontSize: '0.84rem' }}>
              Click any cluster centroid marker or hotspot pixel on the map to inspect telemetry.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GISExplorerPage;
