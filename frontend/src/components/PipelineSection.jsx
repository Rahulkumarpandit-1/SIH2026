import React, { useState } from 'react';
import { Database, MapPin, Layers, ShieldAlert, Cpu, CheckCircle2, ChevronRight } from 'lucide-react';

export const PipelineSection = () => {
  const [activePhase, setActivePhase] = useState(3); // Default to Phase 4 (index 3)

  const phases = [
    {
      id: 1,
      name: 'Phase 1',
      title: 'Satellite Ingestion & Validation',
      icon: <Database size={20} />,
      inputs: 'Raw NASA FIRMS VIIRS (375m) & MODIS (1km) CSV/API feeds.',
      outputs: 'Sanitized schema, FRP (MW), Brightness Temp (K), Day/Night, Deduplicated SQLite records.',
      tech: 'Pydantic v2 validation, SQLite with composite unique constraints on natural keys.',
      badge: 'Verified Ground-Truth'
    },
    {
      id: 2,
      name: 'Phase 2',
      title: 'OSM Industrial Spatial Context',
      icon: <MapPin size={20} />,
      inputs: 'Hotspot lat/lon coordinates & regional bounding box.',
      outputs: 'Shortest geodesic distance in meters (d), facility name, industrial tag, spatial context category.',
      tech: 'OpenStreetMap Overpass API, Shapely polygon containment, Haversine geodesic boundary distance.',
      badge: 'Geospatial Geofencing'
    },
    {
      id: 3,
      name: 'Phase 3',
      title: 'DBSCAN Persistence & Anomaly Engine',
      icon: <Layers size={20} />,
      inputs: 'Multi-day spatial observations over a rolling temporal window.',
      outputs: 'Physical spatial clusters (750m radius), active day counts, Persistence Ratio (Pratio), Anomaly Spike flag.',
      tech: 'Spherical DBSCAN clustering, rolling historical recurrence math, statistical 2-sigma surge detection.',
      badge: 'Temporal Recurrence'
    },
    {
      id: 4,
      name: 'Phase 4',
      title: 'Multi-Signal Risk Scoring (Primary MVP)',
      icon: <ShieldAlert size={20} />,
      inputs: 'Thermal Radiance (35%), OSM Proximity (30%), Persistence & Anomaly (25%), Sensor Quality (10%).',
      outputs: 'Deterministic 0–100 Risk Score, CRITICAL/HIGH/MODERATE/LOW categories, Action Codes (EMERGENCY_DISPATCH).',
      tech: 'Transparent weighted linear formulation with non-linear distance decay and operational flaring discount.',
      badge: 'Primary Decision Core',
      isPrimary: true
    },
    {
      id: 5,
      name: 'Phase 5',
      title: 'Spatial ML Evaluation Framework',
      icon: <Cpu size={20} />,
      inputs: '9-dimensional engineered feature matrix [FRP, T4, T31, Delta T, d, Pratio, Days, Spike, Conf].',
      outputs: 'Random Forest classifier, feature importance rankings, Spatial Group K-Fold cross validation.',
      tech: 'Scikit-Learn Random Forest, Spatial Group K-Fold to prevent geographic coordinate leakage.',
      badge: 'Empirical Benchmark'
    }
  ];

  return (
    <section id="architecture" className="section-container">
      <div className="section-header-block">
        <div className="section-badge">System Architecture</div>
        <h2 className="section-title">
          Five-Phase <span className="text-cyan">End-to-End Intelligence Pipeline</span>
        </h2>
        <p className="section-subtitle">
          Every thermal detection passes through 5 modular, independently verified analytical stages 
          to transform raw electromagnetic radiation into actionable emergency triage decisions.
        </p>
      </div>

      {/* Interactive Phase Navigation Tabs */}
      <div className="pipeline-tabs-grid">
        {phases.map((p, idx) => (
          <div
            key={p.id}
            className={`pipeline-tab-card ${activePhase === idx ? 'active' : ''} ${p.isPrimary ? 'primary-highlight' : ''}`}
            onClick={() => setActivePhase(idx)}
          >
            <div className="tab-card-top">
              <span className="tab-phase-num">{p.name}</span>
              <span className={`tab-badge ${p.isPrimary ? 'primary' : ''}`}>{p.badge}</span>
            </div>

            <div className="tab-card-body">
              <div className="tab-icon-box">{p.icon}</div>
              <strong className="tab-title">{p.title}</strong>
            </div>

            <div className="tab-active-indicator" />
          </div>
        ))}
      </div>

      {/* Detailed Phase Inspection Drawer */}
      <div className="phase-detail-card">
        <div className="phase-detail-header">
          <div className="phase-detail-title-group">
            <span className="phase-large-badge">{phases[activePhase].name}</span>
            <h3 className="phase-detail-title">{phases[activePhase].title}</h3>
          </div>
          <span className="phase-tech-tag">{phases[activePhase].tech}</span>
        </div>

        <div className="phase-detail-io-grid">
          <div className="io-box">
            <span className="io-label">Subsystem Inputs:</span>
            <p className="io-content">{phases[activePhase].inputs}</p>
          </div>

          <div className="io-divider">&rarr;</div>

          <div className="io-box">
            <span className="io-label">Subsystem Outputs:</span>
            <p className="io-content text-cyan">{phases[activePhase].outputs}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PipelineSection;
