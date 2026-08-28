import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export const Navbar = ({ 
  currentView, 
  setCurrentView, 
  isOnline 
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'gis', label: 'GIS Explorer' },
    { id: 'historical', label: 'Historical Data' },
    { id: 'ml', label: 'Machine Learning' },
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
          <span className="nav-brand-sub">Thermal Intelligence</span>
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

        {/* Status Indicator */}
        <div className="nav-status-indicator">
          <div className={`live-dot ${isOnline ? '' : 'offline'}`} />
          <span>{isOnline ? 'SYSTEM LIVE' : 'API OFFLINE'}</span>
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
        </div>
      )}
    </nav>
  );
};

export default Navbar;
