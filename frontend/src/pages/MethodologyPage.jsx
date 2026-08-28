import React from 'react';
import { 
  Database, 
  Layers, 
  Flame, 
  Clock, 
  Activity, 
  ShieldAlert, 
  Cpu, 
  HelpCircle,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export const MethodologyPage = () => {
  return (
    <div className="page-container" style={{ maxWidth: '1100px' }}>
      {/* Header */}
      <section className="editorial-header">
        <div className="section-tag">TECHNICAL SPECIFICATION &bull; SIH26162</div>
        <h1 className="page-main-heading">Methodology &amp; Scientific Foundations</h1>
        <p className="section-subtext">
          Mathematical formulation, thermal physics, sensor specifications, spatial geofencing algorithms,
          and defensive remote sensing disclosures for the SIH26162 Thermal Fire Intelligence system.
        </p>
      </section>

      {/* 01 — THE OPERATIONAL PROBLEM */}
      <section className="report-section">
        <div className="section-tag">01 &bull; PROBLEM STATEMENT</div>
        <h2 className="section-heading">The Industrial False Alarm Dilemma</h2>
        <p className="section-subtext" style={{ maxWidth: '100%' }}>
          Earth observation satellites detect thousands of thermal infrared anomalies across India daily. 
          Standard raw thermal products provide only geographic coordinates and electromagnetic radiance, lacking spatial landuse context. 
          Consequently, disaster response authorities cannot distinguish routine petrochemical refinery gas flaring (burning continuously 24/7) from acute industrial chemical disasters or agricultural fires. 
          Dispatching emergency fire crews to routine flares exhausts public resources, creating dangerous alert fatigue.
        </p>

        <div className="comparison-media-wrapper" style={{ marginTop: '1rem' }}>
          <img
            src="/flare_vs_fire_thermal.jpg"
            alt="Scientific Comparison: Continuous Refinery Gas Flare vs Acute Uncontained Factory Fire"
            className="comparison-img"
          />
        </div>
      </section>

      {/* 02 — DATA SOURCES */}
      <section className="report-section">
        <div className="section-tag">02 &bull; MULTI-SPECTRAL DATA SOURCES</div>
        <h2 className="section-heading">Satellite Telemetry &amp; Geospatial Registries</h2>

        <div className="report-data-grid">
          <div className="report-data-item">
            <span className="report-data-label">NASA VIIRS Sensors</span>
            <span className="report-data-val">375m Spatial Resolution</span>
            <span className="text-secondary" style={{ fontSize: '0.8rem' }}>Suomi-NPP, NOAA-20, NOAA-21 polar orbiters with Channel I4 (3.74 μm) &amp; Channel I5 (11.45 μm).</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">NASA MODIS Sensors</span>
            <span className="report-data-val">1km Spatial Resolution</span>
            <span className="text-secondary" style={{ fontSize: '0.8rem' }}>Terra and Aqua satellites capturing mid-wave infrared channels 21/22 and long-wave channel 31.</span>
          </div>

          <div className="report-data-item">
            <span className="report-data-label">OpenStreetMap Overpass</span>
            <span className="report-data-val">3,970 Industrial Geometries</span>
            <span className="text-secondary" style={{ fontSize: '0.8rem' }}>Vector polygons representing petrochemical refineries, chemical tank farms, and ports across Gujarat.</span>
          </div>
        </div>
      </section>

      {/* 03 — THERMAL PHYSICS */}
      <section className="report-section">
        <div className="section-tag">03 &bull; THERMAL RADIOMETRIC PHYSICS</div>
        <h2 className="section-heading">Planck Radiation &amp; Fire Radiative Power (FRP)</h2>
        <p className="section-subtext" style={{ maxWidth: '100%' }}>
          Hotspot detection relies on Planck's Radiation Law, which dictates that combustion targets emit peak electromagnetic radiance in the 3.7–4.0 μm middle-infrared band (Channel I4/T4). 
          Fire Radiative Power (FRP, in Megawatts) is calculated from the Stefan-Boltzmann radiometric relationship:
        </p>

        <div className="formula-display-block" style={{ margin: '0.5rem 0' }}>
          FRP = (A_pixel &times; σ / a) &times; (L_4 - L_4,bg) &nbsp; [MW]
        </div>

        <p className="text-secondary" style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>
          Sub-pixel thermal contrast is isolated using the bi-spectral difference: <strong>ΔT = T_4 (Middle IR) - T_31 (Thermal IR)</strong>.
          Acute combustion causes strong positive ΔT spikes, whereas uniform solar terrain heating produces near-zero contrast.
        </p>
      </section>

      {/* 04 — SPATIAL ENRICHMENT */}
      <section className="report-section">
        <div className="section-tag">04 &bull; SPATIAL INTELLIGENCE &amp; GEOFENCING</div>
        <h2 className="section-heading">Geodesic Proximity &amp; DBSCAN Clustering</h2>
        <p className="section-subtext" style={{ maxWidth: '100%' }}>
          For every satellite observation point, the platform computes the shortest geodesic distance <em>d</em> in meters to the nearest OSM industrial boundary polygon using the spherical Haversine formula:
        </p>

        <div className="formula-display-block" style={{ margin: '0.5rem 0' }}>
          d = 2R &times; arcsin( sqrt( sin²(Δlat / 2) + cos(lat1) &times; cos(lat2) &times; sin²(Δlon / 2) ) )
        </div>

        <p className="text-secondary" style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>
          Observations falling strictly within industrial polygon perimeters receive <em>d</em> = 0.0 m. Multi-pass satellite detections of the same physical installation are grouped into unified spatial clusters using <strong>DBSCAN with a 750-meter spherical epsilon radius (ε = 750 m)</strong>.
        </p>
      </section>

      {/* 05 — TEMPORAL PERSISTENCE */}
      <section className="report-section">
        <div className="section-tag">05 &bull; TEMPORAL PERSISTENCE ANALYSIS</div>
        <h2 className="section-heading">Recurrence Ratios &amp; Anomaly Surge Math</h2>
        <p className="section-subtext" style={{ maxWidth: '100%' }}>
          The persistence ratio <em>P</em><sub>ratio</sub> measures multi-day recurrence rate over the monitored temporal window:
        </p>

        <div className="formula-display-block" style={{ margin: '0.5rem 0' }}>
          P_ratio = Active Detection Days / Total Monitored Window Days
        </div>

        <div className="two-column-layout" style={{ marginTop: '0.75rem' }}>
          <div className="text-panel">
            <h4 style={{ fontWeight: 700 }}>Continuous Operational Flares (Pratio &ge; 0.5):</h4>
            <p className="panel-desc">
              Petrochemical flare stacks burn hydrocarbons continuously day after day. They receive an operational flaring discount (20 pts) to suppress municipal false alarms.
            </p>
          </div>
          <div className="text-panel">
            <h4 style={{ fontWeight: 700 }}>Acute Anomaly Spikes (Pratio &lt; 0.5):</h4>
            <p className="panel-desc">
              Sudden unprecedented thermal outbreaks appearing without multi-day historical recurrence trigger an anomaly surge penalty (+95 pts) for emergency dispatch.
            </p>
          </div>
        </div>
      </section>

      {/* 06 — RISK ENGINE */}
      <section className="report-section">
        <div className="section-tag">06 &bull; MULTI-SIGNAL RISK SCORING ENGINE</div>
        <h2 className="section-heading">Phase 4 Deterministic Risk Synthesis</h2>
        <p className="section-subtext" style={{ maxWidth: '100%' }}>
          The primary production decision core synthesizes four independent physical dimensions into a single bounded 0–100 Risk Score:
        </p>

        <div className="formula-display-block" style={{ margin: '0.5rem 0' }}>
          Risk Score (R) = 0.35 &times; S_thermal + 0.30 &times; S_proximity + 0.25 &times; S_persistence + 0.10 &times; S_confidence
        </div>

        <div className="sidebar-data-list" style={{ marginTop: '0.75rem', background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--border-divider)' }}>
          <div className="sidebar-row">
            <span><strong>35% &bull; Thermal Intensity (S_thermal):</strong></span>
            <span>Log-scaled Fire Radiative Power (MW) and Channel I4 peak brightness (K)</span>
          </div>
          <div className="sidebar-row">
            <span><strong>30% &bull; Industrial Proximity (S_proximity):</strong></span>
            <span>Exponential distance decay from 100 pts (inside plant) to 5 pts (remote rural)</span>
          </div>
          <div className="sidebar-row">
            <span><strong>25% &bull; Persistence &amp; Anomaly (S_persistence):</strong></span>
            <span>Discounts continuous flares (20 pts) while penalizing acute surge spikes (95 pts)</span>
          </div>
          <div className="sidebar-row">
            <span><strong>10% &bull; Sensor Quality (S_confidence):</strong></span>
            <span>Orbital instrument signal-to-noise quality index</span>
          </div>
        </div>
      </section>

      {/* 07 — GROUND TRUTH */}
      <section className="report-section">
        <div className="section-tag">07 &bull; GROUND TRUTH &amp; DATA PROVENANCE</div>
        <h2 className="section-heading">Satellite Detections &ne; Verified Ground Truth</h2>
        <p className="section-subtext" style={{ maxWidth: '100%' }}>
          A thermal hotspot detected by an orbital radiometer is a physical electromagnetic observation. 
          It does not become a verified ground-truth label until cross-referenced with independent emergency dispatch registries, 
          legal industrial accident logs, or human expert review with documented citations. We strictly forbid heuristic synthetic label fabrication.
        </p>
      </section>

      {/* 08 — MACHINE LEARNING */}
      <section className="report-section">
        <div className="section-tag">08 &bull; MACHINE LEARNING ARCHITECTURE</div>
        <h2 className="section-heading">Spatial Group K-Fold &amp; Leakage Prevention</h2>
        <p className="section-subtext" style={{ maxWidth: '100%' }}>
          Standard random train/test splits cause severe Spatial Data Leakage in remote sensing, where models memorize geographic coordinates instead of combustion physics.
          Our Phase 5/8 ML framework enforces <strong>Spatial Group K-Fold Cross-Validation</strong>, holding out entire physical DBSCAN clusters (e.g., training on Jamnagar and testing on unseen Hazira coordinates).
        </p>
      </section>

      {/* 09 — SCIENTIFIC INTEGRITY & DEFENSIVE DISCLOSURES */}
      <section className="report-section" style={{ borderBottom: 'none' }}>
        <div className="section-tag">09 &bull; SCIENTIFIC INTEGRITY &amp; DEFENSIVE DISCLOSURES</div>
        <h2 className="section-heading">What This System Does NOT Claim</h2>

        <div className="alert-callout-neutral" style={{ marginTop: '0.75rem' }}>
          <div className="callout-icon text-info"><HelpCircle size={24} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem', lineHeight: 1.6 }}>
            <div>
              <strong>1. No Fabricated 99% Accuracy Claims:</strong> Because verified legal industrial accident registries in India are scarce, claiming an unverified "99% AI accuracy" is scientifically deceptive. The ML engine is honestly labeled <code className="code-pill">NOT_READY</code> until sufficient multi-class ground truth is verified.
            </div>
            <div>
              <strong>2. Decision-Support Filter vs Autonomous Legal Proof:</strong> A satellite pixel covers 375m &times; 375m (approx. 140,000 m²). The Risk Score serves as a <strong>decision-support prioritization filter</strong> to guide drone and CCTV inspection, not autonomous legal proof of an accident.
            </div>
            <div>
              <strong>3. Phase 4 Rule Engine as Active MVP:</strong> The transparent deterministic rule engine is our active production baseline, ensuring immediate, explainable protection while ground truth accumulates.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MethodologyPage;
