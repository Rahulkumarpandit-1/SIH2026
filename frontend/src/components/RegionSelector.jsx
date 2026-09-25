import React from 'react';
import { useRegion } from '../context/RegionContext';

export const RegionSelector = () => {
  const { currentRegion } = useRegion();

  return (
    <div className="nav-scope-badge" title="National Scope: Monitoring All Indian Industrial Belts">
      <span className="scope-flag">{currentRegion?.icon || '🇮🇳'}</span>
      <span className="scope-text">{currentRegion?.short_name || 'Whole India'}</span>
      <span className="scope-tag">{currentRegion?.badge || 'National'}</span>
    </div>
  );
};

export default RegionSelector;
