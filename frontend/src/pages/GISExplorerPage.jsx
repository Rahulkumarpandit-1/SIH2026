import React, { useState, useMemo, useEffect } from 'react';
import { 
  MapContainer, TileLayer, CircleMarker, GeoJSON, Popup, 
  Tooltip, useMap 
} from 'react-leaflet';
import L from 'leaflet';
import { Eye, Layers, RotateCcw, ArrowRight, MapPin, Radio, Activity } from 'lucide-react';

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
  const [showHotspots, setShowHotspots] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [showPolygons, setShowPolygons] = useState(true);
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [targetCoords, setTargetCoords] = useState(null);
  const [triggerFitAll, setTriggerFitAll] = useState(0);

  useEffect(() => {
    if (riskData.length > 0 && !selectedCluster) {
      setSelectedCluster(riskData[0]);
    }
  }, [riskData, selectedCluster]);

  const defaultCenter = [22.2587, 71.1924];
  const defaultZoom = 7;

  const filteredClusters = useMemo(() => {
    return clusters.filter((item) => {
      const riskMeta = riskData.find((r) => r.cluster_id === item.cluster_id);
      if (selectedRisk !== 'ALL' && riskMeta?.risk_level !== selectedRisk) return false;
      return true;
    });
  }, [clusters, riskData, selectedRisk]);

  const filteredObservations = useMemo(() => {
    return observations.filter((item) => {
      if (selectedRisk !== 'ALL' && item.risk_level !== selectedRisk) return false;
      return true;
    });
  }, [observations, selectedRisk]);

  const handleClusterClick = (clusterItem) => {
    const fullRisk = riskData.find((r) => r.cluster_id === clusterItem.cluster_id) || clusterItem;
    setSelectedCluster(fullRisk);
    setTargetCoords([clusterItem.centroid_latitude, clusterItem.centroid_longitude]);
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'CRITICAL': return '#D92D20';
      case 'HIGH': return '#B7791F';
      case 'MODERATE': return '#B7791F';
      default: return '#287A4B';
    }
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
          <p className="text-secondary" style={{ fontSize: '0.84rem' }}>
            Interactive multi-layer geospatial analysis with NASA satellite pixels, DBSCAN centroids, and 3,970 OSM boundary polygons.
          </p>
        </div>

        <div className="filter-button-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', marginRight: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showHotspots}
              onChange={(e) => setShowHotspots(e.target.checked)}
            />
            <span>Hotspots ({filteredObservations.length})</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', marginRight: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showClusters}
              onChange={(e) => setShowClusters(e.target.checked)}
            />
            <span>Centroids ({filteredClusters.length})</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', marginRight: '0.8rem', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showPolygons}
              onChange={(e) => setShowPolygons(e.target.checked)}
            />
            <span>3,970 Industrial Polygons</span>
          </label>

          <button className="filter-btn-text" onClick={() => setTriggerFitAll((p) => p + 1)}>
            Fit All
          </button>
          <button className="filter-btn-text" onClick={() => setTargetCoords(defaultCenter)}>
            Reset View
          </button>
        </div>
      </div>

      {/* Full Layout */}
      <div className="gis-full-layout">
        {/* Map Viewport */}
        <div className="gis-map-viewport">
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

            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              maxZoom={18}
            />

            {/* Industrial Polygons Layer */}
            {showPolygons && industrialPolygons && (
              <GeoJSON
                data={industrialPolygons}
                style={{
                  color: '#175CD3',
                  weight: 1,
                  fillColor: '#175CD3',
                  fillOpacity: 0.08,
                  dashArray: '3, 3'
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
                    color: '#FFFFFF',
                    weight: 1
                  }}
                >
                  <Tooltip sticky>
                    <div style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                      <strong>Observation #{obs.observation_id}</strong> &bull; {obs.frp} MW<br />
                      Cluster: {obs.cluster_id} &bull; {obs.acq_date}
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}

            {/* Physical Cluster Centroids */}
            {showClusters && filteredClusters.map((cluster) => {
              const riskMeta = riskData.find((r) => r.cluster_id === cluster.cluster_id);
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
                    color: isSelected ? '#111111' : '#FFFFFF',
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
                          style={{
                            background: '#111111',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '3px',
                            cursor: 'pointer',
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
                  <span className="text-muted">Ground Truth:</span>
                  <span className="pill-badge pill-neutral font-mono">UNLABELED</span>
                </div>
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
