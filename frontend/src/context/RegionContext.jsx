import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/api';

const RegionContext = createContext();

const STORAGE_KEY = 'sih-active-region';

export const DEFAULT_REGIONS = [
  {
    region_code: 'ALL_INDIA',
    name: 'All India (National Overview)',
    short_name: 'All India',
    states_covered: 'National Coverage',
    center: [21.7679, 78.8718],
    default_zoom: 5,
    icon: '🇮🇳',
    badge: 'National'
  },
  {
    region_code: 'WEST_GUJARAT',
    name: 'Gujarat Industrial Corridor',
    short_name: 'Gujarat Corridor',
    states_covered: 'Gujarat',
    center: [22.2587, 71.1924],
    default_zoom: 7.5,
    icon: '🏭',
    badge: 'PCPIR / GIDC'
  },
  {
    region_code: 'WEST_MAHARASHTRA',
    name: 'Maharashtra Industrial Belt',
    short_name: 'Maharashtra Belt',
    states_covered: 'Maharashtra',
    center: [19.1000, 73.2000],
    default_zoom: 8,
    icon: '🏗️',
    badge: 'MIDC / Refineries'
  },
  {
    region_code: 'NORTH_NCR',
    name: 'NCR Industrial Corridor',
    short_name: 'NCR Corridor',
    states_covered: 'Delhi, Haryana, UP, Rajasthan',
    center: [28.4000, 77.1000],
    default_zoom: 8,
    icon: '🏙️',
    badge: 'Panipat / Mathura'
  },
  {
    region_code: 'EAST_MINERAL_BELT',
    name: 'Eastern Steel & Mineral Belt',
    short_name: 'Eastern Steel Belt',
    states_covered: 'Odisha, Jharkhand, WB, CG',
    center: [22.3000, 86.2000],
    default_zoom: 7.5,
    icon: '⚒️',
    badge: 'Paradip / Tata Steel'
  },
  {
    region_code: 'SOUTH_CORRIDOR',
    name: 'Southern Industrial Corridor',
    short_name: 'Southern Corridor',
    states_covered: 'TN, Karnataka, AP, Kerala',
    center: [12.8000, 78.8000],
    default_zoom: 7.5,
    icon: '🚢',
    badge: 'Manali / Kochi / MRPL'
  }
];

export const RegionProvider = ({ children }) => {
  const [regions, setRegions] = useState(DEFAULT_REGIONS);
  const [currentRegionCode, setCurrentRegionCode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved || saved === 'WEST_GUJARAT') {
        return 'ALL_INDIA';
      }
      return saved;
    } catch {
      return 'ALL_INDIA';
    }
  });

  // Ensure default is stored as ALL_INDIA if unset or previously WEST_GUJARAT
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved || saved === 'WEST_GUJARAT') {
        localStorage.setItem(STORAGE_KEY, 'ALL_INDIA');
      }
    } catch {
      // Safe fallback
    }
  }, []);

  // Fetch dynamic region metadata from API on mount
  useEffect(() => {
    let isMounted = true;
    apiService.getRegions?.()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          // Merge API data with icons and badges
          const merged = data.map((apiReg) => {
            const fallback = DEFAULT_REGIONS.find((r) => r.region_code === apiReg.region_code);
            return {
              ...fallback,
              ...apiReg,
              center: apiReg.center || fallback?.center || [21.7679, 78.8718],
              default_zoom: apiReg.default_zoom || fallback?.default_zoom || 5,
              icon: fallback?.icon || '🏭',
              badge: fallback?.badge || 'Industrial'
            };
          });
          setRegions(merged);
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_REGIONS is already active
      });
    return () => { isMounted = false; };
  }, []);

  const currentRegion = regions.find((r) => r.region_code === currentRegionCode) || regions[0];

  const setRegion = (code) => {
    if (!code) return;
    const target = regions.find((r) => r.region_code === code.toUpperCase());
    if (target) {
      setCurrentRegionCode(target.region_code);
      try {
        localStorage.setItem(STORAGE_KEY, target.region_code);
      } catch (err) {
        console.warn('Storage quota exceeded or disabled, active region kept in memory:', err);
      }
    }
  };

  return (
    <RegionContext.Provider
      value={{
        currentRegion,
        currentRegionCode,
        setRegion,
        regions,
        isAllIndia: currentRegion.region_code === 'ALL_INDIA',
        isGujaratOnly: currentRegion.region_code === 'WEST_GUJARAT'
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
