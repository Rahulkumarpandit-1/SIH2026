import React from 'react';
import { Flame, Activity, Info, MapPin, RefreshCw } from 'lucide-react';

export const Header = ({ isOnline, dateRange, onOpenModal, onRefresh, isRefreshing }) => {
  return (
    <header className="header-card">
      <div className="header-brand">
        <div className="header-logo-icon">
          <Flame size={26} />
        </div>
        <div className="header-title-block">
          <h1>
            THERMAL INDUSTRIAL FIRE INTELLIGENCE
            <span className="header-badge">SIH26162</span>
          </h1>
          <p className="header-subtitle">
            Satellite-Based Industrial Thermal Anomaly Detection & Risk Prioritization
          </p>
        </div>
      </div>

      <div className="header-controls">
        <div className="status-pill">
          <MapPin size={14} className="text-secondary" />
          <span>Region: Gujarat, India</span>
        </div>

        {dateRange?.start && (
          <div className="status-pill">
            <span>Date: {dateRange.start} — {dateRange.end}</span>
          </div>
        )}

        <div className="status-pill">
          <div className={`status-dot ${isOnline ? '' : 'offline'}`} />
          <span>{isOnline ? 'Telemetry API Live' : 'API Disconnected'}</span>
        </div>

        <button 
          className="btn-secondary" 
          onClick={onRefresh} 
          disabled={isRefreshing}
          title="Refresh Data"
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
          <span>Refresh</span>
        </button>

        <button className="btn-secondary" onClick={onOpenModal}>
          <Info size={14} />
          <span>How It Works</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
