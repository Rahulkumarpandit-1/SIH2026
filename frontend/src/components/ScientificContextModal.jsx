import React from 'react';
import { X, ShieldCheck, Database, Layers, Activity, Cpu, Gauge } from 'lucide-react';

export const ScientificContextModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <ShieldCheck size={22} color="var(--accent-cyan)" />
            <span>System Architecture & Scientific Defense</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          This system addresses <strong style={{ color: 'var(--text-main)' }}>SIH Problem Statement SIH26162</strong>: 
          <em> "AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data."</em>
        </div>

        {/* 5-Phase Architecture Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div className="phase-step-card">
            <div className="phase-step-title">Phase 1 — Satellite Hotspot Ingestion & Validation</div>
            <div className="phase-step-desc">
              Ingests raw NASA FIRMS VIIRS (375m) and MODIS (1km) infrared sensor feeds. Normalizes brightness temperatures, Fire Radiative Power (MW), and enforces natural-key database deduplication.
            </div>
          </div>

          <div className="phase-step-card">
            <div className="phase-step-title">Phase 2 — OSM Industrial Geospatial Context</div>
            <div className="phase-step-desc">
              Queries OpenStreetMap Overpass geometries for industrial land-use boundaries, chemical parks, and refineries. Computes exact Haversine geodesic boundary distances in meters.
            </div>
          </div>

          <div className="phase-step-card">
            <div className="phase-step-title">Phase 3 — Spatio-Temporal Clustering & Persistence Engine</div>
            <div className="phase-step-desc">
              Executes spherical DBSCAN clustering (750m radius). Computes rolling multi-day persistence ratios to distinguish routine daily refinery flares from acute, sudden heat anomalies.
            </div>
          </div>

          <div className="phase-step-card" style={{ borderLeft: '3px solid var(--risk-critical)' }}>
            <div className="phase-step-title" style={{ color: 'var(--risk-critical)' }}>
              Phase 4 — Operational Explainable Risk Engine (Primary Decision Core)
            </div>
            <div className="phase-step-desc">
              Combines Thermal Intensity (35%), OSM Industrial Proximity (30%), Temporal Persistence (25%), and Sensor Confidence (10%) into a 0–100 Risk Score. Generates deterministic triage action codes (EMERGENCY_DISPATCH, PRIORITY_INSPECTION, ROUTINE_MONITORING).
            </div>
          </div>

          <div className="phase-step-card">
            <div className="phase-step-title">Phase 5 — Machine Learning Evaluation Framework</div>
            <div className="phase-step-desc">
              Extracts 9D feature vectors and evaluates Random Forest classifiers using <strong>Spatial Group K-Fold Cross Validation</strong> to prevent geographic data leakage. Retained as an empirical benchmark.
            </div>
          </div>
        </div>

        {/* Scientific Integrity Note for SIH Judges */}
        <div style={{
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          padding: '0.85rem',
          borderRadius: '6px',
          fontSize: '0.78rem',
          color: 'var(--text-main)',
          lineHeight: 1.4
        }}>
          <strong style={{ color: 'var(--accent-cyan)' }}>Scientific Defensibility Note for SIH Judges:</strong>
          <p style={{ marginTop: '0.3rem', color: 'var(--text-secondary)' }}>
            A satellite thermal pixel covers approx. 140,000 m&sup2; on the ground. Therefore, the Risk Score is designed as an <strong>incident prioritization and triage filter</strong> to trigger rapid drone/CCTV verification, rather than an unvalidated claim of physical accident certainty.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScientificContextModal;
