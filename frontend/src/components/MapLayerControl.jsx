import React from 'react';
import { Globe, Map as MapIcon } from 'lucide-react';

export const MapLayerControl = ({ activeLayer, onSelectLayer }) => {
  const options = [
    {
      id: 'satellite',
      label: 'Satellite Imagery',
      icon: Globe
    },
    {
      id: 'streets',
      label: 'Detailed Streets',
      icon: MapIcon
    }
  ];

  return (
    <div className="map-layer-control-float">
      <div className="map-layer-pills">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = activeLayer === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={`map-layer-pill ${isActive ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectLayer(opt.id);
              }}
              title={`Switch to ${opt.label} basemap`}
            >
              <Icon size={12} />
              <span className="map-layer-pill-label">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MapLayerControl;
