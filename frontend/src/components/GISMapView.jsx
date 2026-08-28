import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

// Helper component to smoothly animate/focus the map when selected cluster changes
const MapFocusController = ({ targetCoords }) => {
  const map = useMap();
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

export const GISMapView = ({
  observations = [],
  clusters = [],
  industrialPolygons = null,
  selectedCluster,
  onSelectCluster,
  onSelectObservation
}) => {
  const defaultCenter = [22.2587, 71.1924];
  const defaultZoom = 7;

  const targetCoords = useMemo(() => {
    if (selectedCluster?.centroid_latitude && selectedCluster?.centroid_longitude) {
      return [selectedCluster.centroid_latitude, selectedCluster.centroid_longitude];
    }
    return null;
  }, [selectedCluster]);

  const polygonStyle = {
    color: '#175CD3',
    weight: 1,
    opacity: 0.7,
    fillColor: '#175CD3',
    fillOpacity: 0.08,
    dashArray: '3, 3'
  };

  const onEachPolygon = (feature, layer) => {
    if (feature.properties) {
      const name = feature.properties.name || 'Industrial Facility';
      const type = feature.properties.industrial || feature.properties.landuse || 'Industrial Zone';
      layer.bindTooltip(`<strong>${name}</strong><br/>${type}`, {
        sticky: true
      });
    }
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
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ width: '100%', height: '100%', minHeight: '480px' }}
        scrollWheelZoom={true}
      >
        <MapFocusController targetCoords={targetCoords} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={18}
        />

        {/* Industrial Polygons */}
        {industrialPolygons && industrialPolygons.features && industrialPolygons.features.length > 0 && (
          <GeoJSON
            key={industrialPolygons.features.length}
            data={industrialPolygons}
            style={polygonStyle}
            onEachFeature={onEachPolygon}
          />
        )}

        {/* Hotspot observations */}
        {observations.slice(0, 150).map((obs) => (
          <CircleMarker
            key={`map-obs-${obs.observation_id}`}
            center={[obs.latitude, obs.longitude]}
            radius={4}
            pathOptions={{
              fillColor: getRiskColor(obs.risk_level),
              fillOpacity: 0.75,
              color: '#FFFFFF',
              weight: 1
            }}
          >
            <Tooltip sticky>
              <div style={{ fontSize: '0.78rem' }}>
                Obs #{obs.observation_id} &bull; {obs.frp} MW<br />
                {obs.nearest_facility_name}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Physical Clusters */}
        {clusters.map((cluster) => {
          const isCrit = cluster.risk_level === 'CRITICAL';
          const rColor = getRiskColor(cluster.risk_level);
          const isSelected = selectedCluster?.cluster_id === cluster.cluster_id;

          return (
            <CircleMarker
              key={`map-cluster-${cluster.cluster_id}`}
              center={[cluster.centroid_latitude, cluster.centroid_longitude]}
              radius={isCrit ? 12 : 8}
              pathOptions={{
                fillColor: rColor,
                fillOpacity: 0.9,
                color: isSelected ? '#111111' : '#FFFFFF',
                weight: isSelected ? 2.5 : 1.5
              }}
              eventHandlers={{
                click: () => onSelectCluster(cluster)
              }}
            >
              <Popup>
                <div style={{ fontSize: '0.8rem', lineHeight: '1.45', padding: '2px' }}>
                  <strong>{cluster.cluster_id}</strong> &bull; {(cluster.risk_score ?? 0).toFixed(1)}/100<br />
                  <span>{cluster.nearest_facility_name || 'Industrial Facility'}</span><br />
                  <span className="font-mono text-muted" style={{ fontSize: '0.72rem' }}>
                    {cluster.spatial_context} &bull; Max FRP: {(cluster.max_frp ?? 0).toFixed(1)} MW
                  </span>
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
                      onClick={() => onSelectCluster(cluster)}
                    >
                      Inspect Cluster &rarr;
                    </button>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default GISMapView;
