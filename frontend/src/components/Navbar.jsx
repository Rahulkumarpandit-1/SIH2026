import React, { useState } from 'react';
import { Menu, X, RefreshCw } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import RegionSelector from './RegionSelector';

export const Navbar = ({ 
  currentView, 
  setCurrentView, 
  isOnline,
  isRefreshing = false
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'gis', label: 'GIS Explorer' },
    { id: 'historical', label: 'Historical Data' },
    { id: 'ml', label: 'Machine Learning' },
    { id: 'ground-truth', label: 'Ground Truth' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'methodology', label: 'Methodology' },
  ];

  const handleNavClick = (viewId) => {
    setCurrentView(viewId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="nav-header">
      <div className="nav-container">
        {/* Brand Left */}
        <div className="nav-brand-block" onClick={() => handleNavClick('overview')}>
          <span className="nav-brand-title">SIH26162</span>
          <span className="nav-brand-sub">Near-Real-Time Thermal Monitoring</span>
        </div>

        {/* Text Navigation Links */}
        <div className="nav-menu-links">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-text-btn ${currentView === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right Section: Region Selector, Theme Toggle & Status Indicator */}
        <div className="nav-right-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <RegionSelector />
          <ThemeToggle />

          <div className="nav-status-indicator">
            {isRefreshing ? (
              <>
                <RefreshCw size={12} className="spin-anim text-warning" />
                <span className="text-warning">INGESTING FIRMS...</span>
              </>
            ) : (
              <>
                <div className={`live-dot ${isOnline ? '' : 'offline'}`} />
                <span>{isOnline ? 'SYSTEM LIVE' : 'API OFFLINE'}</span>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`mobile-drawer-link ${currentView === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              {item.label}
            </button>
          ))}

          {/* Mobile Region Selector Row */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <RegionSelector />
          </div>

          {/* Mobile Theme Toggle Row */}
          <ThemeToggle variant="drawer" />
        </div>
      )}
    </nav>
  );
};

export default Navbar;
