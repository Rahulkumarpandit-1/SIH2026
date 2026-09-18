import React from 'react';
import { Layers, Globe, Map as MapIcon, Moon, Sun } from 'lucide-react';

export const MapLayerControl = ({ activeLayer, onSelectLayer, isDark }) => {
  const options = [
    {
      id: isDark ? 'dark' : 'light',
      label: isDark ? 'Dark GIS' : 'Light Canvas',
      icon: isDark ? Moon : Sun
    },
    {
      id: 'streets',
      label: 'Detailed Streets',
      icon: MapIcon
    },
    {
      id: 'satellite',
      label: 'Satellite Imagery',
      icon: Globe
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
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MapLayerControl;
