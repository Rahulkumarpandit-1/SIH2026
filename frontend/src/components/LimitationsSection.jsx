import React from 'react';
import { AlertTriangle, Eye, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const LimitationsSection = () => {
  return (
    <section id="limitations" className="section-container">
      <div className="section-header-block">
        <div className="section-badge">Scientific Rigor &amp; Defensibility</div>
        <h2 className="section-title">
          Physical Constraints &amp; <span className="text-cyan">Human-In-The-Loop Verification</span>
        </h2>
        <p className="section-subtitle">
          Transparently documenting physical sensor boundaries ensures our system is used responsibly 
          as an intelligent decision-support filter rather than an autonomous decision maker.
        </p>
      </div>

      <div className="limitations-grid">
        <div className="limitation-item">
          <div className="lim-header">
            <span className="lim-num">01</span>
            <h4 className="lim-title">Pixel-Integrated Spatial Resolution</h4>
          </div>
          <p className="lim-desc">
            A VIIRS pixel covers 375 m &times; 375 m (approx. 140,000 m&sup2;) on the ground. Multiple sub-pixel industrial burners or heaters inside a single plant are integrated into one thermal radiance value.
          </p>
        </div>

        <div className="limitation-item">
          <div className="lim-header">
            <span className="lim-num">02</span>
            <h4 className="lim-title">Atmospheric &amp; Cloud Attenuation</h4>
          </div>
          <p className="lim-desc">
            Dense monsoon clouds or thick smoke plumes can partially absorb mid-infrared radiation, temporarily dampening apparent Fire Radiative Power (MW) during extreme storm events.
          </p>
        </div>

        <div className="limitation-item">
          <div className="lim-header">
            <span className="lim-num">03</span>
            <h4 className="lim-title">OpenStreetMap Tagging Latency</h4>
          </div>
          <p className="lim-desc">
            Newly constructed chemical factories that have not yet been mapped into OpenStreetMap will temporarily evaluate with rural proximity until community or local cadastral updates are synced.
          </p>
        </div>

        <div className="limitation-item">
          <div className="lim-header">
            <span className="lim-num">04</span>
            <h4 className="lim-title">Decision-Support vs. Physical Certainty</h4>
          </div>
          <p className="lim-desc">
            The Risk Score is a <strong>prioritization filter</strong> designed to focus human operator attention on the top $1\%$ of critical thermal anomalies, triggering rapid CCTV or drone verification.
          </p>
        </div>
      </div>

      {/* Human In The Loop Verification Funnel */}
      <div className="hitl-card">
        <div className="hitl-title">THE CLOSED-LOOP VERIFICATION PROTOCOL</div>
        <div className="hitl-flow-row">
          <div className="hitl-step">
            <span className="hitl-tag">1. Detection</span>
            <strong>Satellite Hotspot</strong>
            <span>VIIRS/MODIS infrared radiance</span>
          </div>
          <div className="hitl-arrow">&rarr;</div>

          <div className="hitl-step">
            <span className="hitl-tag">2. AI Triage</span>
            <strong>Phase 4 Risk Score</strong>
            <span>Multi-signal prioritization queue</span>
          </div>
          <div className="hitl-arrow">&rarr;</div>

          <div className="hitl-step highlight">
            <span className="hitl-tag">3. Dispatch</span>
            <strong>Drone / CCTV Verification</strong>
            <span>Autonomous drone or plant CCTV check</span>
          </div>
          <div className="hitl-arrow">&rarr;</div>

          <div className="hitl-step">
            <span className="hitl-tag">4. Response</span>
            <strong>Confirmed Ground Incident</strong>
            <span>Emergency response mobilized</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LimitationsSection;
