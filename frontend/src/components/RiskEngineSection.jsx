import React from 'react';
import { Gauge, ShieldAlert, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';

export const RiskEngineSection = () => {
  return (
    <section id="risk-engine" className="section-container">
      <div className="section-header-block">
        <div className="section-badge">Phase 4 Operational Engine</div>
        <h2 className="section-title">
          Transparent, Explainable <span className="text-cyan">Multi-Signal Risk Formulation</span>
        </h2>
        <p className="section-subtitle">
          Unlike black-box models, our Phase 4 primary decision core is $100\%$ mathematically transparent, 
          defensible before industrial regulators, and provably bounded in $[0.0, 100.0]$.
        </p>
      </div>

      {/* Visual Mathematical Formula Block */}
      <div className="formula-card">
        <div className="formula-title">THE COMPOSITE RISK FORMULA</div>
        <div className="formula-equation">
          <span className="var-risk">Risk Score (R)</span> = 
          <span className="term"> (0.35 &times; S<sub>thermal</sub>)</span> + 
          <span className="term"> (0.30 &times; S<sub>proximity</sub>)</span> + 
          <span className="term"> (0.25 &times; S<sub>persistence</sub>)</span> + 
          <span className="term"> (0.10 &times; S<sub>confidence</sub>)</span>
        </div>
      </div>

      {/* 4 Weight Rationale Cards */}
      <div className="weights-rationale-grid">
        <div className="weight-card">
          <div className="weight-header">
            <span className="weight-percent">35%</span>
            <span className="weight-name">Thermal Intensity (S<sub>thermal</sub>)</span>
          </div>
          <p className="weight-desc">
            Direct physical combustion rate computed from Fire Radiative Power (MW) and Channel I4 Brightness Temperature (K). Higher energy output increases hazard scale.
          </p>
        </div>

        <div className="weight-card">
          <div className="weight-header">
            <span className="weight-percent">30%</span>
            <span className="weight-name">Industrial Proximity (S<sub>prox</sub>)</span>
          </div>
          <p className="weight-desc">
            Calculated via Haversine distance to nearest OSM industrial polygon boundary. Inside a refinery gives $100$ points; decaying to $5$ points in remote rural zones.
          </p>
        </div>

        <div className="weight-card">
          <div className="weight-header">
            <span className="weight-percent">25%</span>
            <span className="weight-name">Persistence &amp; Anomaly (S<sub>pers</sub>)</span>
          </div>
          <p className="weight-desc">
            Key for false-alarm suppression. Discounts daily operational flares (<em>P</em><sub>ratio</sub> &ge; 0.5) down to 20 pts; penalizes sudden unexpected spikes up to 95 pts.
          </p>
        </div>

        <div className="weight-card">
          <div className="weight-header">
            <span className="weight-percent">10%</span>
            <span className="weight-name">Sensor Quality (S<sub>conf</sub>)</span>
          </div>
          <p className="weight-desc">
            NASA FIRMS signal-to-noise quality confidence gate (0.0 to 1.0). Ensures noisy orbital edge pixels never trigger false high-tier emergency alerts.
          </p>
        </div>
      </div>

      {/* Operational Triage Action Table */}
      <div className="risk-bands-card">
        <h3 className="risk-bands-title">OPERATIONAL RISK BANDS &amp; SCIENTIFIC INVESTIGATION PROTOCOLS</h3>
        <table className="triage-table">
          <thead>
            <tr>
              <th>Risk Score Range</th>
              <th>Tier Level</th>
              <th>Incident Classification</th>
              <th>Recommended Operational Directive</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong style={{ color: 'var(--risk-critical)' }}>80.0 — 100.0</strong></td>
              <td><span className="risk-badge critical">SEVERE</span></td>
              <td><code>SEVERE_THERMAL_ANOMALY</code></td>
              <td><strong>HIGH_PRIORITY_INVESTIGATION_REQUIRED</strong> — High Priority Investigation Required. Rapid site review and facility contact recommended.</td>
            </tr>
            <tr>
              <td><strong style={{ color: 'var(--risk-high)' }}>60.0 — 79.9</strong></td>
              <td><span className="risk-badge high">HIGH</span></td>
              <td><code>ELEVATED_THERMAL_ACTIVITY</code></td>
              <td><strong>ESCALATED_INVESTIGATION_RECOMMENDED</strong> — Escalated Investigation Recommended. Check plant flaring logs; compare against historical baseline.</td>
            </tr>
            <tr>
              <td><strong style={{ color: 'var(--risk-moderate)' }}>30.0 — 59.9</strong></td>
              <td><span className="risk-badge moderate">MEDIUM</span></td>
              <td><code>PERSISTENT_OPERATIONAL_SOURCE</code></td>
              <td><strong>ANALYST_REVIEW_RECOMMENDED</strong> — Analyst Review Recommended. Automated baseline tracking of known gas flares and persistent sources.</td>
            </tr>
            <tr>
              <td><strong style={{ color: 'var(--risk-low)' }}>0.0 — 29.9</strong></td>
              <td><span className="risk-badge low">LOW</span></td>
              <td><code>NON_INDUSTRIAL_RURAL</code></td>
              <td><strong>ROUTINE_MONITORING_RECOMMENDED</strong> — Routine Monitoring Recommended. Filtered agricultural burning; standard background logging.</td>
            </tr>
          </tbody>
        </table>

        {/* Mandatory Scientific Recommendation Statement */}
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(56, 189, 248, 0.07)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '6px',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5
        }}>
          <strong style={{ color: 'var(--text-main)' }}>Scientific Operational Safeguard:</strong> This recommendation is based solely on satellite-observed thermal anomalies and supporting analytical models. Ground verification is required before operational response decisions.
        </div>
      </div>
    </section>
  );
};

export default RiskEngineSection;
