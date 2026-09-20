import React, { useState, useRef, useEffect } from 'react';
import { useRegion } from '../context/RegionContext';

export const RegionSelector = () => {
  const { currentRegion, setRegion, regions } = useRegion();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code) => {
    setRegion(code);
    setIsOpen(false);
  };

  return (
    <div className="region-selector-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="region-selector-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Switch Monitored Industrial Region"
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'var(--bg-secondary, rgba(255, 255, 255, 0.05))',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
          borderRadius: '8px',
          color: 'var(--text-primary, #ffffff)',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          backdropFilter: 'blur(8px)'
        }}
      >
        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{currentRegion.icon || '🏭'}</span>
        <span style={{ whiteSpace: 'nowrap' }}>{currentRegion.short_name || currentRegion.name}</span>
        <span
          style={{
            fontSize: '0.7rem',
            padding: '2px 6px',
            borderRadius: '4px',
            background: 'var(--primary-glow, rgba(59, 130, 246, 0.15))',
            color: 'var(--primary, #3B82F6)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            fontWeight: 700
          }}
        >
          {currentRegion.badge || 'Active'}
        </span>
        <span style={{ fontSize: '0.7rem', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          className="region-dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '280px',
            background: 'var(--bg-primary, #1e293b)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
            borderRadius: '10px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
            zIndex: 1000,
            overflow: 'hidden',
            backdropFilter: 'blur(16px)'
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-secondary, #94a3b8)',
              borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
              background: 'var(--bg-secondary, rgba(255, 255, 255, 0.02))'
            }}
          >
            Select Industrial Corridor / Region
          </div>

          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {regions.map((reg) => {
              const isSelected = reg.region_code === currentRegion.region_code;
              return (
                <button
                  key={reg.region_code}
                  type="button"
                  onClick={() => handleSelect(reg.region_code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 14px',
                    textAlign: 'left',
                    background: isSelected ? 'var(--primary-glow, rgba(59, 130, 246, 0.12))' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.05))',
                    cursor: 'pointer',
                    color: isSelected ? 'var(--primary, #60a5fa)' : 'var(--text-primary, #f1f5f9)',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary, rgba(255, 255, 255, 0.06))';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.25rem' }}>{reg.icon || '🏭'}</span>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{reg.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)' }}>
                        {reg.states_covered}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--primary, #3B82F6)' }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RegionSelector;
