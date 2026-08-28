import React from 'react';
import { ArrowRight, Info, Flame, MapPin, Layers, ShieldAlert, Radio } from 'lucide-react';

export const HeroSection = ({ summary, onOpenModal }) => {
  return (
    <section className="hero-section">
      {/* Background Ambient Grid */}
      <div className="hero-bg-grid" />

      {/* Left Column: Text & Pipeline Flow */}
      <div className="hero-content">
        {/* Top Intelligence Tag */}
        <div className="hero-tag-pill">
          <Radio size={14} className="text-cyan pulse-slow" />
          <span>NASA FIRMS &bull; OPENSTREETMAP &bull; DBSCAN PERSISTENCE</span>
        </div>

        {/* Main Headline */}
        <h1 className="hero-title">
          THERMAL INTELLIGENCE
          <span className="hero-title-gradient">
            Satellite-Driven Detection &amp; Prioritization of Industrial Thermal Events
          </span>
        </h1>

        {/* Supporting Subtitle */}
        <p className="hero-description">
          From raw orbital infrared sensors to deterministic, explainable emergency priority. 
          We fuse physical combustion energy, OpenStreetMap industrial boundaries, multi-day recurrence history, 
          and sensor confidence to distinguish routine refinery flares from acute industrial disasters.
        </p>

        {/* CTAs */}
        <div className="hero-actions">
          <a href="#live-intelligence" className="btn-primary-glow">
            <span>Explore Live Intelligence</span>
            <ArrowRight size={16} />
          </a>
          <button className="btn-secondary-hero" onClick={onOpenModal}>
            <Info size={16} />
            <span>How The System Works</span>
          </button>
        </div>

        {/* Live Telemetry Summary Chips */}
        <div className="hero-metrics-bar">
          <div className="hero-metric-item">
            <span className="metric-label">Satellite Ingestion</span>
            <span className="metric-val">{summary?.total_observations ?? 15} Detections</span>
          </div>
          <div className="metric-divider" />
          <div className="hero-metric-item">
            <span className="metric-label">Spatial Clusters</span>
            <span className="metric-val">{summary?.total_clusters ?? 6} Sites</span>
          </div>
          <div className="metric-divider" />
          <div className="hero-metric-item">
            <span className="metric-label">Critical Outbreaks</span>
            <span className="metric-val text-critical">{summary?.critical_count ?? 1} Emergency</span>
          </div>
          <div className="metric-divider" />
          <div className="hero-metric-item">
            <span className="metric-label">Monitored Region</span>
            <span className="metric-val">Gujarat, India</span>
          </div>
        </div>

        {/* Visual Pipeline Concept Flow */}
        <div className="hero-pipeline-preview">
          <div className="pipeline-step-node">
            <div className="node-icon-box"><Flame size={18} /></div>
            <div className="node-text">
              <span className="node-title">1. FIRMS VIIRS/MODIS</span>
              <span className="node-sub">Thermal Radiance (MW)</span>
            </div>
          </div>
          <div className="pipeline-arrow">&rarr;</div>

          <div className="pipeline-step-node">
            <div className="node-icon-box"><MapPin size={18} /></div>
            <div className="node-text">
              <span className="node-title">2. OSM Geospatial</span>
              <span className="node-sub">Boundary Distance (m)</span>
            </div>
          </div>
          <div className="pipeline-arrow">&rarr;</div>

          <div className="pipeline-step-node">
            <div className="node-icon-box"><Layers size={18} /></div>
            <div className="node-text">
              <span className="node-title">3. DBSCAN History</span>
              <span className="node-sub">Persistence Ratio (P)</span>
            </div>
          </div>
          <div className="pipeline-arrow">&rarr;</div>

          <div className="pipeline-step-node highlight">
            <div className="node-icon-box"><ShieldAlert size={18} /></div>
            <div className="node-text">
              <span className="node-title">4. Multi-Signal Score</span>
              <span className="node-sub">0–100 Triage Priority</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: High-Tech Satellite Scanner Illustration */}
      <div className="hero-image-box">
        <img
          src="/satellite_thermal_earth.jpg"
          alt="Orbital Satellite Scanning Industrial Thermal Anomaly"
          className="hero-image"
        />
        <div className="hero-image-overlay">
          <div className="hero-image-caption">ORBITAL INFRARED MULTI-SPECTRAL TELEMETRY</div>
          <div className="hero-image-sub">VIIRS 375m / MODIS 1km sensor stream over Gujarat Industrial Corridor</div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
