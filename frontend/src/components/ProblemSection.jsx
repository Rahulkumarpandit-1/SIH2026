import React from 'react';
import { AlertTriangle, Filter, Eye, ShieldCheck, CheckCircle2, XCircle, ArrowDown } from 'lucide-react';

export const ProblemSection = () => {
  return (
    <section id="problem" className="section-container">
      <div className="section-header-block">
        <div className="section-badge">The Core Problem &amp; SIH Challenge</div>
        <h2 className="section-title">
          A Thermal Hotspot Is <span className="text-critical">Not Automatically An Emergency</span>
        </h2>
        <p className="section-subtitle">
          Earth observation satellites detect thousands of thermal anomalies across India daily. 
          Without contextual geospatial and temporal intelligence, emergency responders face critical alert fatigue.
        </p>
      </div>

      {/* Visual Image Banner Split */}
      <div className="problem-visual-split">
        <div className="problem-image-card">
          <img
            src="/industrial_thermal_gis.jpg"
            alt="Aerial Industrial Refinery Thermal Heatmap & GIS Boundary Vector"
            className="problem-image"
          />
        </div>

        <div className="problem-card success">
          <div className="problem-card-header">
            <div className="problem-icon-box text-cyan">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="problem-card-title">Our Solution: Multi-Signal Contextual Triage</h3>
              <span className="problem-card-sub">How SIH26162 Solves The Triage Bottleneck:</span>
            </div>
          </div>

          <ul className="problem-list">
            <li>
              <strong>OpenStreetMap Industrial Geofencing:</strong> Calculates exact geodesic boundary distances to 3,900+ petrochemical estates and storage tanks.
            </li>
            <li>
              <strong>Spatio-Temporal DBSCAN Persistence:</strong> Evaluates active recurrence ratios (<em>P</em><sub>ratio</sub>) to discount safe continuous operational sources.
            </li>
            <li>
              <strong>Acute Anomaly Spike Flagging:</strong> Isolates unprecedented high-energy bursts (FRP &gt; 80 MW) appearing in industrial zones.
            </li>
            <li>
              <strong>Deterministic 0–100 Risk Prioritization:</strong> Automates priority ranking so emergency teams immediately inspect the highest hazard event.
            </li>
          </ul>
        </div>
      </div>

      {/* Comparison Grid: Raw Satellite Limitations */}
      <div className="problem-comparison-grid">
        <div className="problem-card failure">
          <div className="problem-card-header">
            <div className="problem-icon-box text-critical">
              <XCircle size={24} />
            </div>
            <div>
              <h3 className="problem-card-title">The Raw Satellite Detection Dilemma</h3>
              <span className="problem-card-sub">What Standard FIRMS Thermal Feeds Cannot Tell You:</span>
            </div>
          </div>

          <ul className="problem-list">
            <li>
              <strong>No Industrial Boundary Context:</strong> Is the hotspot in an empty farming field, a forest reserve, or inside a high-hazard chemical refinery?
            </li>
            <li>
              <strong>No Operational Flaring Baseline:</strong> Is this heat source a routine gas flare burning safely for 30 consecutive days, or an unexpected sudden blowout?
            </li>
            <li>
              <strong>No Temporal Anomaly Detection:</strong> Did the thermal energy surge by 400% today compared to its historic weekly average?
            </li>
            <li>
              <strong>Zero Incident Prioritization:</strong> When 2,000 hotspots appear across the country, which single facility requires emergency dispatch first?
            </li>
          </ul>
        </div>

        {/* Triage Funnel */}
        <div className="triage-funnel-card">
          <div className="funnel-title">THE INTELLIGENT TRIAGE FILTERING PIPELINE</div>
          <div className="funnel-steps-row">
            <div className="funnel-step">
              <span className="funnel-step-num">Step 1</span>
              <strong className="funnel-step-name">1,000+ Raw Detections</strong>
              <span className="funnel-step-desc">NASA FIRMS VIIRS/MODIS infrared pixels</span>
            </div>
            <div className="funnel-arrow">&rarr;</div>

            <div className="funnel-step">
              <span className="funnel-step-num">Step 2</span>
              <strong className="funnel-step-name">Spatial Enrichment</strong>
              <span className="funnel-step-desc">OSM industrial boundary proximity</span>
            </div>
            <div className="funnel-arrow">&rarr;</div>

            <div className="funnel-step">
              <span className="funnel-step-num">Step 3</span>
              <strong className="funnel-step-name">Persistence Analysis</strong>
              <span className="funnel-step-desc">DBSCAN recurrence &amp; anomaly spikes</span>
            </div>
            <div className="funnel-arrow">&rarr;</div>

            <div className="funnel-step highlight">
              <span className="funnel-step-num">Step 4</span>
              <strong className="funnel-step-name">Top 5 Actionable Alerts</strong>
              <span className="funnel-step-desc">Dispatched for ground &amp; drone verification</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
