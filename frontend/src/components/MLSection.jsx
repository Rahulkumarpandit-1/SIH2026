import React from 'react';
import { Cpu, ShieldCheck, AlertTriangle, Layers, BarChart2 } from 'lucide-react';

export const MLSection = () => {
  const featureList = [
    { name: 'brightness (T4)', desc: 'Channel I4 Brightness Temp (K)', importance: 22.2 },
    { name: 'bright_t31 (T5)', desc: 'Channel I5 Background Temp (K)', importance: 21.8 },
    { name: 'thermal_contrast', desc: 'Delta T = T4 - T31 (K)', importance: 16.9 },
    { name: 'frp', desc: 'Fire Radiative Power (MW)', importance: 14.5 },
    { name: 'distance_to_industry', desc: 'Geodesic Distance to Fence (m)', importance: 7.7 },
    { name: 'persistence_ratio', desc: 'Active Days / Total Window Days', importance: 7.3 },
    { name: 'active_days_count', desc: 'Number of Active Detection Days', importance: 6.7 },
    { name: 'confidence_normalized', desc: 'NASA FIRMS Sensor Quality (0-1)', importance: 2.9 }
  ];

  return (
    <section id="ml-evaluation" className="section-container">
      <div className="section-header-block">
        <div className="section-badge">Phase 5 Research &amp; Evaluation</div>
        <h2 className="section-title">
          Machine Learning Benchmark &amp; <span className="text-cyan">Spatial Leakage Prevention</span>
        </h2>
        <p className="section-subtitle">
          Demonstrating our 9D feature engineering pipeline and how Spatial Group K-Fold cross-validation 
          prevents geographic data leakage on geospatial satellite datasets.
        </p>
      </div>

      {/* 9D Feature Vector Presentation */}
      <div className="feature-vector-card">
        <div className="fv-title">THE 9-DIMENSIONAL ENGINEERED FEATURE VECTOR (&mathbf;x)</div>
        <div className="fv-chips-row">
          <span className="fv-chip">1. FRP (MW)</span>
          <span className="fv-chip">2. T<sub>4</sub> Brightness (K)</span>
          <span className="fv-chip">3. T<sub>31</sub> Background (K)</span>
          <span className="fv-chip">4. &Delta;T Thermal Contrast</span>
          <span className="fv-chip">5. Distance to Industry (m)</span>
          <span className="fv-chip">6. Persistence Ratio (P)</span>
          <span className="fv-chip">7. Active Days Count</span>
          <span className="fv-chip">8. Anomaly Spike Flag</span>
          <span className="fv-chip">9. Normalized Confidence</span>
        </div>
      </div>

      {/* Spatial Data Leakage: Wrong vs Correct Approach */}
      <div className="leakage-grid">
        <div className="leakage-card wrong">
          <div className="leakage-badge wrong">INCORRECT (Standard Random Split)</div>
          <h4 className="leakage-title">Random Train/Test Row Splitting</h4>
          <p className="leakage-desc">
            Splitting observations randomly puts 3 Jamnagar rows in Train and 2 Jamnagar rows in Test. 
            The algorithm simply <em>memorizes the coordinates</em> <code>(22.47&deg;N, 70.05&deg;E)</code> instead of learning true fire physics.
          </p>
          <div className="leakage-result text-critical">Result: Artificially Inflated "99% Accuracy" (Severe Overfitting)</div>
        </div>

        <div className="leakage-card correct">
          <div className="leakage-badge correct">CORRECT (Our Implementation)</div>
          <h4 className="leakage-title">Spatial Group K-Fold Cross Validation</h4>
          <p className="leakage-desc">
            Entire geographic clusters are held out. The model is trained on Jamnagar, Dahej, and Rural, 
            and evaluated on completely unseen Hazira coordinates, proving true spatial generalization.
          </p>
          <div className="leakage-result text-low">Result: Scientifically Defensible Geospatial Generalization</div>
        </div>
      </div>

      {/* Feature Importance Bars */}
      <div className="feature-importance-card">
        <h3 className="fi-title">
          <BarChart2 size={16} color="var(--accent-cyan)" />
          <span>Random Forest Feature Importance Rankings (Which Signals Drove Decisions)</span>
        </h3>
        <div className="fi-bars-list">
          {featureList.map((f) => (
            <div key={f.name} className="fi-row">
              <div className="fi-label-group">
                <strong className="fi-name">{f.name}</strong>
                <span className="fi-desc">{f.desc}</span>
              </div>
              <div className="fi-track">
                <div className="fi-fill" style={{ width: `${f.importance * 3.5}%` }} />
              </div>
              <span className="fi-val">{f.importance.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scientific Honesty & Label Transparency */}
      <div className="integrity-card">
        <div className="integrity-header">
          <ShieldCheck size={20} color="var(--accent-cyan)" />
          <h4 className="integrity-title">Why We Do Not Claim "99% AI Accuracy" (SIH Defense)</h4>
        </div>
        <p className="integrity-body">
          In real-world industrial disaster management, verified ground-truth legal accident records are scarce and strictly confidential. 
          Fabricating synthetic accident labels just to report a fake $99\%$ accuracy is scientifically invalid.
          <br /><br />
          <strong>Our Defensible Approach:</strong> We deploy the <strong>Phase 4 Transparent Rule Engine</strong> as our primary operational decision-support MVP, while maintaining the <strong>Phase 5 Spatial ML Pipeline</strong> as our empirical evaluation framework for when state disaster authorities supply verified historical incident registries.
        </p>
      </div>
    </section>
  );
};

export default MLSection;
