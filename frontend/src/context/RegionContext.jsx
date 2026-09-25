import React, { createContext, useContext, useState } from 'react';

const RegionContext = createContext();

export const WHOLE_INDIA_REGION = {
  region_code: 'ALL_INDIA',
  name: 'Whole India (National Grid)',
  short_name: 'Whole India',
  states_covered: 'All Indian Industrial Corridors & States',
  center: [22.0, 79.5],
  default_zoom: 5,
  icon: '🇮🇳',
  badge: 'National Grid'
};

export const DEFAULT_REGIONS = [WHOLE_INDIA_REGION];

export const RegionProvider = ({ children }) => {
  const [currentRegion] = useState(WHOLE_INDIA_REGION);
  const [currentRegionCode] = useState('ALL_INDIA');

  const setRegion = () => {
    // Permanent Whole India mode - state selection disabled per user requirement
  };

  return (
    <RegionContext.Provider
      value={{
        currentRegion,
        currentRegionCode,
        setRegion,
        regions: [WHOLE_INDIA_REGION],
        isAllIndia: true,
        isGujaratOnly: false
      }}
    >
      {children}
    </RegionContext.Provider>
  );
};

export const useRegion = () => {
  const context = useContext(RegionContext);
  if (!context) {
    throw new Error('useRegion must be used within a RegionProvider');
  }
  return context;
};

export default RegionContext;
