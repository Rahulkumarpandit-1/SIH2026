import React, { useState, useMemo, useEffect } from 'react';
import { 
  MapContainer, TileLayer, CircleMarker, GeoJSON, Popup, 
  Tooltip, useMap 
} from 'react-leaflet';
import L from 'leaflet';
import { Eye, Layers, RotateCcw, ArrowRight, MapPin, Radio, Activity, Clock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { MAP_PROVIDERS } from '../services/mapConfig';
import MapLayerControl from '../components/MapLayerControl';

const MapFocusController = ({ targetCoords, triggerFitAll, clusters = [] }) => {
  const map = useMap();

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
  const [layerType, setLayerType] = useState(() => (isDark ? 'dark' : 'streets'));

  useEffect(() => {
    setLayerType(isDark ? 'dark' : 'streets');
  }, [isDark]);

  const activeProvider = MAP_PROVIDERS[layerType] || MAP_PROVIDERS.streets;
  const safeObs = Array.isArray(observations) ? observations : [];
  const safeClusters = Array.isArray(clusters) ? clusters : [];
  const safeRisk = Array.isArray(riskData) ? riskData : [];

  const [showHotspots, setShowHotspots] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [showPolygons, setShowPolygons] = useState(true);
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [targetCoords, setTargetCoords] = useState(null);
  const [triggerFitAll, setTriggerFitAll] = useState(0);
  const [secondsAgo, setSecondsAgo] = useState(0);

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

  useEffect(() => {
    if (safeRisk.length > 0 && !selectedCluster) {
      setSelectedCluster(safeRisk[0]);
    }
  }, [safeRisk, selectedCluster]);

  const defaultCenter = [22.2587, 71.1924];
  const defaultZoom = 7;

  const filteredClusters = useMemo(() => {
    return safeClusters.filter((item) => {
      const riskMeta = safeRisk.find((r) => r.cluster_id === item.cluster_id);
      if (selectedRisk !== 'ALL' && riskMeta?.risk_level !== selectedRisk) return false;
      return true;
    });
  }, [safeClusters, safeRisk, selectedRisk]);

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
            GIS Explorer &bull; Gujarat Industrial Corridor
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
            isDark={isDark}
          />

          {/* Floating Map Legend */}
          <div className="map-legend-float">
            <div className="map-legend-title">Thermal Sensor Legend</div>
            <div className="map-legend-items">
              <span className="map-legend-item">
                <span className="legend-dot" style={{ background: '#EF4444' }} /> Critical (&ge;75)
              </span>
              <span className="map-legend-item">
                <span className="legend-dot" style={{ background: '#F97316' }} /> High (50-75)
              </span>
              <span className="map-legend-item">
                <span className="legend-dot" style={{ background: '#F59E0B' }} /> Moderate (25-50)
              </span>
              <span className="map-legend-item">
                <span className="legend-dot" style={{ background: '#10B981' }} /> Routine (&lt;25)
              </span>
              <span className="map-legend-item">
                <span className="legend-poly-box" /> Industrial Perimeter
              </span>
            </div>
          </div>

          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ width: '100%', height: '100%', minHeight: '640px' }}
            scrollWheelZoom={true}
          >
            <MapFocusController 
              targetCoords={targetCoords} 
              triggerFitAll={triggerFitAll}
              clusters={filteredClusters}
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

            {/* Industrial Polygons Layer */}
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

            {/* Physical Cluster Centroids */}
            {showClusters && filteredClusters.map((cluster) => {
              const riskMeta = safeRisk.find((r) => r.cluster_id === cluster.cluster_id);
              const rLevel = riskMeta?.risk_level ?? 'LOW';
              const rScore = riskMeta?.risk_score ?? 0.0;
              const rColor = getRiskColor(rLevel);
              const isSelected = selectedCluster?.cluster_id === cluster.cluster_id;

              return (
                <CircleMarker
                  key={`cluster-${cluster.cluster_id}`}
                  center={[cluster.centroid_latitude, cluster.centroid_longitude]}
                  radius={rLevel === 'CRITICAL' ? 12 : 8}
                  pathOptions={{
                    fillColor: rColor,
                    fillOpacity: 0.9,
                    color: isSelected ? (isDark ? '#F0F4F8' : '#111111') : (isDark ? '#161B22' : '#FFFFFF'),
                    weight: isSelected ? 2.5 : 1.5
                  }}
                  eventHandlers={{
                    click: () => handleClusterClick(cluster)
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: '0.8rem', lineHeight: '1.45', padding: '2px' }}>
                      <strong>{cluster.cluster_id}</strong> &bull; {rScore.toFixed(1)}/100<br />
                      <span>{cluster.nearest_facility_name}</span><br />
                      <span className="font-mono text-muted" style={{ fontSize: '0.72rem' }}>{cluster.spatial_context}</span>
                      <div style={{ marginTop: '0.4rem' }}>
                        <button 
                          className="btn-black-primary"
                          style={{
                            padding: '0.28rem 0.6rem',
                            borderRadius: '3px',
                            fontSize: '0.74rem',
                            fontWeight: 600
                          }}
                          onClick={() => onOpenIncidentDetail(riskMeta || cluster)}
                        >
                          Inspect Report &rarr;
                        </button>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
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
