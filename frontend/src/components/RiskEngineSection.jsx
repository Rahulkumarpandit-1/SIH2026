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
        <h3 className="risk-bands-title">OPERATIONAL RISK BANDS &amp; DISPATCH PROTOCOLS</h3>
        <table className="triage-table">
          <thead>
            <tr>
              <th>Risk Score Range</th>
              <th>Tier Level</th>
              <th>Incident Classification</th>
              <th>Mandated Operational Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong style={{ color: 'var(--risk-critical)' }}>80.0 — 100.0</strong></td>
              <td><span className="risk-badge critical">CRITICAL</span></td>
              <td><code>INDUSTRIAL_FIRE_OUTBREAK</code></td>
              <td><strong>EMERGENCY_DISPATCH</strong> — Immediate alert to district fire services &amp; plant emergency room.</td>
            </tr>
            <tr>
              <td><strong style={{ color: 'var(--risk-high)' }}>60.0 — 79.9</strong></td>
              <td><span className="risk-badge high">HIGH</span></td>
              <td><code>ABNORMAL_INDUSTRIAL_HEAT</code></td>
              <td><strong>PRIORITY_INSPECTION</strong> — Check plant flaring logs; dispatch drone/CCTV verification.</td>
            </tr>
            <tr>
              <td><strong style={{ color: 'var(--risk-moderate)' }}>30.0 — 59.9</strong></td>
              <td><span className="risk-badge moderate">MODERATE</span></td>
              <td><code>PERSISTENT_OPERATIONAL_SOURCE</code></td>
              <td><strong>ROUTINE_MONITORING</strong> — Automated baseline tracking of known gas flares and blast furnaces.</td>
            </tr>
            <tr>
              <td><strong style={{ color: 'var(--risk-low)' }}>0.0 — 29.9</strong></td>
              <td><span className="risk-badge low">LOW</span></td>
              <td><code>NON_INDUSTRIAL_RURAL</code></td>
              <td><strong>BACKGROUND_LOG</strong> — Filtered agricultural burning; low priority for industrial teams.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default RiskEngineSection;
