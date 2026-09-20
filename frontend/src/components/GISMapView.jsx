import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup, useMap, CircleMarker, Tooltip } from 'react-leaflet';
import { useTheme } from '../context/ThemeContext';
import { useRegion } from '../context/RegionContext';
import { MAP_PROVIDERS } from '../services/mapConfig';
import MapLayerControl from './MapLayerControl';

// Helper component to smoothly animate/focus the map when selected cluster changes or corridor switches
const MapFocusController = ({ targetCoords, regionCenter, regionZoom, regionCode }) => {
  const map = useMap();
  const centerLat = regionCenter?.[0];
  const centerLon = regionCenter?.[1];

  // Whenever corridor switches, ALWAYS fly to the selected region center & default zoom
  useEffect(() => {
    if (centerLat !== undefined && centerLon !== undefined && !isNaN(centerLat) && !isNaN(centerLon)) {
      map.flyTo([centerLat, centerLon], regionZoom || 6, {
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
  if (normalized === 'CRITICAL' || (score !== undefined && score >= 75)) return '#EF4444'; // Vibrant Red
  if (normalized === 'HIGH' || (score !== undefined && score >= 50)) return '#F97316';     // Safety Orange
  if (normalized === 'MODERATE' || (score !== undefined && score >= 25)) return '#F59E0B'; // Amber Gold
  return '#10B981';                                                                        // Emerald Green
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
        risk_score,
        risk_level,
        action_code: risk?.action_code ?? cluster.action_code ?? 'ROUTINE_MONITORING',
        incident_classification: risk?.incident_classification ?? cluster.incident_classification,
        nearest_facility_name: risk?.nearest_facility_name || cluster.nearest_facility_name || 'Industrial Facility'
      };
    });
  }, [clusters, riskData]);

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
    <div className="gis-map-viewport" style={{ width: '100%', height: '100%', minHeight: '480px', position: 'relative' }}>
      {/* Floating Basemap Selector */}
      <MapLayerControl
        activeLayer={layerType}
        onSelectLayer={setLayerType}
        isDark={isDark}
      />

      {/* Floating Map Legend */}
      <div className="map-legend-float">
        <div className="map-legend-title">Thermal Intelligence Legend</div>
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
        key={`gis-map-${currentRegion?.region_code || 'ALL_INDIA'}-${layerType}`}
        center={defaultCenter}
        zoom={defaultZoom}
        preferCanvas={true}
        style={{ width: '100%', height: '100%', minHeight: '480px' }}
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

        {/* Industrial Polygons */}
        {industrialPolygons && industrialPolygons.features && industrialPolygons.features.length > 0 && (
          <GeoJSON
            key={`poly-${industrialPolygons.features.length}-${isDark ? 'dark' : 'light'}`}
            data={industrialPolygons}
            style={polygonStyle}
            onEachFeature={onEachPolygon}
          />
        )}

        {/* Hotspot observations (raw sensor pixels) */}
        {observations.slice(0, 150).map((obs) => {
          const obsColor = getRiskColor(obs.risk_level, obs.risk_score);
          return (
            <CircleMarker
              key={`map-obs-${obs.observation_id}`}
              center={[obs.latitude, obs.longitude]}
              radius={3.5}
              pathOptions={{
                fillColor: obsColor,
                fillOpacity: 0.75,
                color: isDark ? '#0D1117' : '#FFFFFF',
                weight: 0.8
              }}
            >
              <Tooltip sticky>
                <div style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                  <strong>Obs #{obs.observation_id}</strong> &bull; {obs.frp} MW<br />
                  Level: <span style={{ color: obsColor, fontWeight: 700 }}>{obs.risk_level}</span><br />
                  {obs.nearest_facility_name}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Physical Cluster Centroids (enriched with risk severity) */}
        {enrichedClusters.map((cluster) => {
          const isCrit = cluster.risk_level === 'CRITICAL';
          const isHigh = cluster.risk_level === 'HIGH';
          const isMod = cluster.risk_level === 'MODERATE';
          const rColor = getRiskColor(cluster.risk_level, cluster.risk_score);
          const isSelected = selectedCluster?.cluster_id === cluster.cluster_id;
          const radius = isCrit ? 12 : isHigh ? 9 : isMod ? 7.5 : 6;

          return (
            <React.Fragment key={`map-cluster-group-${cluster.cluster_id}`}>
              {/* Pulsing Warning Halo for Critical Incidents */}
              {isCrit && (
                <CircleMarker
                  center={[cluster.centroid_latitude, cluster.centroid_longitude]}
                  radius={18}
                  pathOptions={{
                    fillColor: '#EF4444',
                    fillOpacity: 0.18,
                    color: '#EF4444',
                    weight: 1.5,
                    dashArray: '3, 4'
                  }}
                />
              )}

              <CircleMarker
                center={[cluster.centroid_latitude, cluster.centroid_longitude]}
                radius={radius}
                pathOptions={{
                  fillColor: rColor,
                  fillOpacity: 0.95,
                  color: isSelected ? '#00E5FF' : (isDark ? '#0D1117' : '#FFFFFF'),
                  weight: isSelected ? 3 : 1.8
                }}
                eventHandlers={{
                  click: () => onSelectCluster(cluster)
                }}
              >
                <Popup>
                  <div style={{ fontSize: '0.8rem', lineHeight: '1.45', padding: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                      <span 
                        style={{ 
                          width: 9, 
                          height: 9, 
                          borderRadius: '50%', 
                          background: rColor, 
                          display: 'inline-block' 
                        }} 
                      />
                      <strong>{cluster.cluster_id}</strong> &bull; <span style={{ color: rColor, fontWeight: 700 }}>{(cluster.risk_score ?? 0).toFixed(1)}/100</span> ({cluster.risk_level})
                    </div>
                    <span>{cluster.nearest_facility_name}</span><br />
                    <span className="font-mono text-muted" style={{ fontSize: '0.72rem' }}>
                      {cluster.spatial_context} &bull; Max FRP: {(cluster.max_frp ?? 0).toFixed(1)} MW
                    </span>
                    <div style={{ marginTop: '0.5rem' }}>
                      <button 
                        className="btn-black-primary"
                        style={{
                          padding: '0.32rem 0.65rem',
                          borderRadius: '3px',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          width: '100%',
                          justifyContent: 'center'
                        }}
                        onClick={() => onSelectCluster(cluster)}
                      >
                        Inspect Deep Dive Report &rarr;
                      </button>
                    </div>
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
