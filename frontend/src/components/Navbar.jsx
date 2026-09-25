import React, { useState } from 'react';
import { Menu, X, RefreshCw } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

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
          <div className="nav-brand-title-row">
            <span className="nav-brand-title">SIH26162</span>
            <span className="nav-mobile-scope-pill">🇮🇳 India</span>
          </div>
          <span className="nav-brand-sub">Thermal Fire Intelligence</span>
        </div>

        {/* Text Navigation Links (Desktop) */}
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

        {/* Right Section: Whole India Badge, Theme Toggle & Status Indicator */}
        <div className="nav-right-actions">
          {/* Desktop Whole India Badge */}
          <div className="nav-scope-badge" title="National Scope: Ingesting verified satellite telemetry across Whole India">
            <span className="scope-flag">🇮🇳</span>
            <span className="scope-text">Whole India</span>
            <span className="scope-tag">National</span>
          </div>

          <ThemeToggle />

          <div className="nav-status-indicator" title={isOnline ? "NASA Telemetry Pipeline Online & Connected (Platform Feed Active)" : "Pipeline Feed Offline"}>
            {isRefreshing ? (
              <>
                <RefreshCw size={12} className="spin-anim text-warning" />
                <span className="status-label text-warning">INGESTING...</span>
              </>
            ) : (
              <>
                <div className={`live-dot ${isOnline ? '' : 'offline'}`} />
                <span className="status-label">{isOnline ? 'SYSTEM ONLINE' : 'FEED OFFLINE'}</span>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer">
          {/* Mobile Scope Card */}
          <div className="mobile-drawer-scope-card">
            <div className="drawer-scope-flag">🇮🇳</div>
            <div>
              <div className="drawer-scope-title">Whole India Coverage</div>
              <div className="drawer-scope-sub">National Industrial Thermal Monitoring Grid</div>
            </div>
          </div>

          {navItems.map((item) => (
            <button
              key={item.id}
              className={`mobile-drawer-link ${currentView === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              {item.label}
            </button>
          ))}

          {/* Mobile Theme Toggle Row */}
          <ThemeToggle variant="drawer" />
        </div>
      )}
    </nav>
  );
};

export default Navbar;
