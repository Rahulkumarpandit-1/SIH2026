import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { 
  Cpu, 
  Lock, 
  GitFork, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Layers, 
  ArrowRight,
  Database,
  Sliders,
  Play
} from 'lucide-react';

export const MachineLearningPage = () => {
  const [mlData, setMlData] = useState(null);
  const [mlStatus, setMlStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Playground Inference State
  const [predictInputs, setPredictInputs] = useState({
    frp: 85.0,
    brightness: 365.0,
    bright_t31: 300.0,
    distance_to_industry_meters: 0.0,
    persistence_ratio: 0.2,
    active_days_count: 1,
    is_anomaly_spike: 1,
    confidence_normalized: 0.9
  });
  const [predictionResult, setPredictionResult] = useState(null);
  const [predicting, setPredicting] = useState(false);

  useEffect(() => {
    const fetchML = async () => {
      setLoading(true);
      try {
        const [mlRes, statusRes] = await Promise.all([
          apiService.getMLEvaluation().catch(() => null),
          apiService.getMLStatus().catch(() => null)
        ]);
        if (mlRes) setMlData(mlRes);
        if (statusRes) setMlStatus(statusRes);
      } catch (err) {
        console.error('Failed to load ML evaluation data:', err);
        setError('Machine learning evaluation API is currently unavailable.');
      } finally {
        setLoading(false);
      }
    };
    fetchML();
  }, []);

  const handleRunInference = async (e) => {
    e.preventDefault();
    setPredicting(true);
    try {
      const thermalContrast = parseFloat(predictInputs.brightness) - parseFloat(predictInputs.bright_t31);
      const res = await apiService.predictML({
        frp: parseFloat(predictInputs.frp),
        brightness: parseFloat(predictInputs.brightness),
        bright_t31: parseFloat(predictInputs.bright_t31),
        thermal_contrast: thermalContrast,
        distance_to_industry_meters: parseFloat(predictInputs.distance_to_industry_meters),
        persistence_ratio: parseFloat(predictInputs.persistence_ratio),
        active_days_count: parseInt(predictInputs.active_days_count),
        is_anomaly_spike: parseInt(predictInputs.is_anomaly_spike),
        confidence_normalized: parseFloat(predictInputs.confidence_normalized)
      });
      setPredictionResult(res);
    } catch (err) {
      console.error('Prediction failed:', err);
      alert('ML Prediction request failed.');
    } finally {
      setPredicting(false);
    }
  };

  const featureMatrix = [
    { num: '01', name: 'frp', label: 'Fire Radiative Power', unit: 'MW', desc: 'Direct radiant combustion energy emitted by hotspot.' },
    { num: '02', name: 'brightness', label: 'Channel I4 Brightness Temp', unit: 'K', desc: '4-micrometer middle-infrared peak sensor radiance.' },
    { num: '03', name: 'bright_t31', label: 'Channel I5 / T31 Temp', unit: 'K', desc: '11-micrometer thermal background reference channel.' },
    { num: '04', name: 'thermal_contrast', label: 'Thermal Contrast (ΔT)', unit: 'K', desc: 'T4 - T31 difference isolating acute sub-pixel fire targets.' },
    { num: '05', name: 'distance_to_industry_meters', label: 'Industrial Distance', unit: 'm', desc: 'Haversine distance to nearest OSM industrial polygon boundary.' },
    { num: '06', name: 'persistence_ratio', label: 'Persistence Ratio (Pratio)', unit: '0.0–1.0', desc: 'Ratio of active detection days to total rolling time window.' },
    { num: '07', name: 'active_days_count', label: 'Active Days Count', unit: 'Days', desc: 'Number of distinct calendar days with satellite detections.' },
    { num: '08', name: 'is_anomaly_spike', label: 'Anomaly Spike Flag', unit: '0 or 1', desc: 'Flag indicating FRP exceeds historical baseline by 3.0×.' },
    { num: '09', name: 'confidence_normalized', label: 'Sensor Confidence Score', unit: '0.0–1.0', desc: 'Normalized satellite instrument detection quality score.' }
  ];

  return (
    <div className="page-container">
      {/* 01 — EDITORIAL HEADER */}
      <section className="editorial-header">
        <div className="section-tag">EMPIRICAL EVALUATION &bull; SPATIAL VALIDATION ARCHITECTURE</div>
        <h1 className="page-main-heading">Machine Learning &amp; Spatial Group K-Fold</h1>
        <p className="section-subtext">
          Scientific machine learning framework with Spatial Group K-Fold validation, strict coordinate leakage prevention,
          and dynamic data sufficiency evaluation.
        </p>
      </section>

      {/* 02 — STATUS: NOT READY & WHY */}
      <section className="spacious-section">
        <div className="alert-callout-warning">
          <div className="callout-icon text-warning"><AlertTriangle size={26} /></div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                CURRENT ML STATUS: {mlStatus?.status || 'NOT READY'}
              </h3>
              <span className="badge-warning">Phase 4 Deterministic Rule Engine is Active Production MVP</span>
            </div>
            
            <p className="text-secondary" style={{ fontSize: '0.9rem', lineHeight: 1.6, marginTop: '0.5rem' }}>
              <strong>WHY IS SUPERVISED ML NOT_READY?</strong><br />
              {mlStatus?.reason || 'Supervised learning requires >= 2 distinct verified classes and multiple independent spatial clusters to prevent geographic memorization.'}
              {" "}In accordance with remote sensing scientific standards, <strong>we refuse to display fabricated 99% accuracy numbers</strong> when verified multi-class ground-truth labels remain sparse.
            </p>

            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.82rem' }} className="font-mono text-secondary">
              <span>Verified Labeled Samples: <strong>{mlStatus?.labeled_samples ?? 0}</strong></span>
              <span>Classes Present: <strong>{mlStatus?.classes_present ?? 0} of 4</strong></span>
              <span>Spatial Groups: <strong>{mlStatus?.spatial_groups_count ?? 0}</strong></span>
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* 03 — WHAT IS ALREADY BUILT */}
      <section className="spacious-section">
        <div className="section-tag">PRODUCTION ENGINEERING FOUNDATION</div>
        <h2 className="section-heading">What Is Already Built &amp; Implemented?</h2>
        <p className="section-subtext">
          Complete end-to-end machine learning infrastructure ready for automated activation as verified labels accumulate.
        </p>

        <div className="three-column-grid" style={{ marginTop: '1.5rem' }}>
          <div className="text-panel">
            <h3 className="panel-heading">1. 9D Feature Vector Pipeline</h3>
            <p className="panel-desc">
              Physical combustion radiance and GIS proximity metrics extracted without human intervention.
              Raw latitude/longitude are strictly purged from matrix X.
            </p>
            <div className="meta-tag">Code: <code className="code-pill">app/classifier/features.py</code></div>
          </div>

          <div className="text-panel">
            <h3 className="panel-heading">2. Spatial Group K-Fold</h3>
            <p className="panel-desc">
              Partitions observations strictly by DBSCAN cluster ID. No physical site appears simultaneously
              in training and validation splits, guaranteeing 0% spatial data leakage.
            </p>
            <div className="meta-tag">Code: <code className="code-pill">app/classifier/spatial_cv.py</code></div>
          </div>

          <div className="text-panel">
            <h3 className="panel-heading">3. Model Registry &amp; Inference API</h3>
            <p className="panel-desc">
              Random Forest and Logistic Regression training pipeline with class weighting, model artifact persistence,
              and live inference endpoint (<code className="code-pill">POST /api/ml/predict</code>).
            </p>
            <div className="meta-tag">Code: <code className="code-pill">app/classifier/trainer.py</code></div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* 04 — WHAT IS REQUIRED */}
      <section className="spacious-section">
        <div className="section-tag">DATA GOVERNANCE REQUIREMENT</div>
        <h2 className="section-heading">What Is Required to Activate Supervised ML?</h2>
        <p className="section-subtext">
          Defensible machine learning in safety-critical industrial operations requires independent multi-class ground truth.
        </p>

        <div className="two-column-layout" style={{ marginTop: '1.5rem' }}>
          <div className="text-panel">
            <h4 className="panel-heading">Target Classification Taxonomy (4 Classes):</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem', fontSize: '0.86rem' }}>
              <div><strong>CLASS 0:</strong> Persistent Industrial Source (Refinery Flare / Boiler)</div>
              <div><strong>CLASS 1:</strong> Industrial Fire Outbreak (Acute Emergency Disaster)</div>
              <div><strong>CLASS 2:</strong> Agricultural Wildfire (Crop Residue Burn)</div>
              <div><strong>CLASS 3:</strong> False Detection (Solar Glint / Sensor Glare)</div>
            </div>
          </div>

          <div className="text-panel">
            <h4 className="panel-heading">Sufficiency Thresholds:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem', fontSize: '0.86rem' }}>
              <div>&bull; Minimum 2 distinct verified classes (avoids single-class triviality)</div>
              <div>&bull; Minimum 5 verified samples per class</div>
              <div>&bull; Minimum 3 independent spatial DBSCAN cluster groups</div>
              <div>&bull; Documented source citations for all verified labels</div>
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* 05 — WHEN READY WORKFLOW */}
      <section className="spacious-section">
        <div className="section-tag">PROGRESSION LIFECYCLE</div>
        <h2 className="section-heading">When Sufficient Ground Truth Exists: Automated ML Workflow</h2>
        <p className="section-subtext">
          How the platform transitions from Phase 4 deterministic rule engine to hybrid ML-assisted triage.
        </p>

        <div className="pipeline-steps-grid" style={{ marginTop: '1.5rem' }}>
          <div className="pipeline-step-card">
            <div className="step-num font-mono">STEP 01</div>
            <h4>Ground Truth</h4>
            <p>Verified human analyst reviews committed with external disaster log citations.</p>
          </div>
          <div className="pipeline-step-card">
            <div className="step-num font-mono">STEP 02</div>
            <h4>Feature Matrix</h4>
            <p>9D physical feature matrix built; coordinates and rule scores excluded.</p>
          </div>
          <div className="pipeline-step-card">
            <div className="step-num font-mono">STEP 03</div>
            <h4>Spatial CV</h4>
            <p>Spatial Group K-Fold splits clusters into isolated training and holdout folds.</p>
          </div>
          <div className="pipeline-step-card">
            <div className="step-num font-mono">STEP 04</div>
            <h4>Model Training</h4>
            <p>Random Forest trains with balanced class weights and empirical hyperparameter tuning.</p>
          </div>
          <div className="pipeline-step-card">
            <div className="step-num font-mono">STEP 05</div>
            <h4>Model Registry</h4>
            <p>Validated models serialized to disk with timestamped training manifests.</p>
          </div>
          <div className="pipeline-step-card">
            <div className="step-num font-mono">STEP 06</div>
            <h4>Live Prediction</h4>
            <p>Real-time inference API serves probability distributions for new satellite passes.</p>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* 06 — 9-DIMENSIONAL FEATURE MATRIX */}
      <section className="spacious-section">
        <div className="section-header-flex">
          <div>
            <div className="section-tag">FEATURE ENGINEERING SPECIFICATION</div>
            <h2 className="section-heading">9-Dimensional Feature Vector Matrix</h2>
            <p className="section-subtext">
              Physical radiance, spectral contrast, and spatial proximity variables used in matrix X.
            </p>
          </div>
          <div className="badge-neutral font-mono">X ∈ ℝ⁹ (Zero Geographic Coordinates)</div>
        </div>

        <div className="feature-cards-grid" style={{ marginTop: '1.5rem' }}>
          {featureMatrix.map((feat) => (
            <div key={feat.num} className="feature-card">
              <div className="feat-num font-mono">FEAT {feat.num} &bull; {feat.unit}</div>
              <h4 className="feat-title">{feat.label}</h4>
              <p className="feat-desc">{feat.desc}</p>
              <div className="feat-col-name font-mono">{feat.name}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="divider" />

      {/* 07 — COORDINATE LEAKAGE PREVENTION */}
      <section className="spacious-section">
        <div className="section-tag">SCIENTIFIC LEAKAGE PREVENTION</div>
        <h2 className="section-heading">Spatial Leakage Prevention Guarantees</h2>
        <p className="section-subtext">
          Why raw coordinates and rule outputs are strictly barred from matrix X.
        </p>

        <div className="two-column-layout" style={{ marginTop: '1.5rem' }}>
          <div className="info-subcard" style={{ borderLeft: '3px solid var(--status-critical)', paddingLeft: '1.25rem' }}>
            <h4 style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Zero Coordinate Memorization</h4>
            <p className="text-secondary" style={{ fontSize: '0.88rem', lineHeight: 1.55 }}>
              Standard machine learning models trained on latitude and longitude memorize specific factory coordinates 
              (e.g., memorizing that 21.1688°N is Hazira) rather than learning thermal physics and temporal persistence. 
              Coordinates are permanently stripped from feature matrix X.
            </p>
          </div>

          <div className="info-subcard" style={{ borderLeft: '3px solid var(--status-info)', paddingLeft: '1.25rem' }}>
            <h4 style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Spatial Group K-Fold Isolation</h4>
            <p className="text-secondary" style={{ fontSize: '0.88rem', lineHeight: 1.55 }}>
              Cross-validation partitions observations strictly by physical DBSCAN cluster ID. 
              No spatial cluster appears simultaneously in training and test splits, guaranteeing 0% geographic contamination and true out-of-sample generalization.
            </p>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* 08 — LIVE INFERENCE PLAYGROUND */}
      <section className="spacious-section">
        <div className="section-tag">INTERACTIVE INFERENCE TESTBED</div>
        <h2 className="section-heading">Live 9D Inference Playground (<code className="code-pill">POST /api/ml/predict</code>)</h2>
        <p className="section-subtext">
          Test real-time model inference behavior against custom physical telemetry values.
        </p>

        <form onSubmit={handleRunInference} style={{ marginTop: '1.5rem', background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '4px', border: '1px solid var(--border-divider)' }}>
          <div className="three-column-grid">
            <div className="form-group">
              <label className="form-label">Fire Radiative Power (MW)</label>
              <input
                type="number"
                step="0.1"
                className="clean-search-input full-width"
                value={predictInputs.frp}
                onChange={(e) => setPredictInputs({ ...predictInputs, frp: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">T4 Brightness Temp (K)</label>
              <input
                type="number"
                step="0.1"
                className="clean-search-input full-width"
                value={predictInputs.brightness}
                onChange={(e) => setPredictInputs({ ...predictInputs, brightness: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">T31 Background Temp (K)</label>
              <input
                type="number"
                step="0.1"
                className="clean-search-input full-width"
                value={predictInputs.bright_t31}
                onChange={(e) => setPredictInputs({ ...predictInputs, bright_t31: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Distance to Industry (m)</label>
              <input
                type="number"
                step="1"
                className="clean-search-input full-width"
                value={predictInputs.distance_to_industry_meters}
                onChange={(e) => setPredictInputs({ ...predictInputs, distance_to_industry_meters: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Persistence Ratio (0.0–1.0)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                className="clean-search-input full-width"
                value={predictInputs.persistence_ratio}
                onChange={(e) => setPredictInputs({ ...predictInputs, persistence_ratio: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Anomaly Spike Flag (0 or 1)</label>
              <select
                className="select-input full-width"
                value={predictInputs.is_anomaly_spike}
                onChange={(e) => setPredictInputs({ ...predictInputs, is_anomaly_spike: e.target.value })}
              >
                <option value={1}>1: Sudden Radiance Surge (Spike)</option>
                <option value={0}>0: Normal Steady Baseline</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-black-primary" disabled={predicting}>
              <Play size={14} />
              <span>{predicting ? 'Evaluating 9D Vector...' : 'Execute Model Inference'}</span>
            </button>
          </div>

          {predictionResult && (
            <div style={{ marginTop: '1.25rem', background: '#FFFFFF', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--border-divider)' }}>
              <div className="section-tag">PREDICTION INFERENCE RESPONSE</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                    Predicted Class: <span className="font-mono text-critical">{predictionResult.predicted_class_name}</span>
                  </div>
                  <div className="text-secondary" style={{ fontSize: '0.84rem' }}>
                    Model Used: <span className="font-mono">{predictionResult.model_used}</span> &bull; Confidence: <span className="font-mono font-bold">{(predictionResult.confidence * 100).toFixed(1)}%</span>
                  </div>
                </div>

                <div className="pill-badge pill-neutral font-mono" style={{ fontSize: '0.78rem' }}>
                  {predictionResult.is_statistically_defensible ? 'Trained Model Prediction' : 'Honest Baseline Fallback'}
                </div>
              </div>

              {predictionResult.scientific_disclosure && (
                <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.6rem', borderTop: '1px solid var(--border-divider)', paddingTop: '0.6rem' }}>
                  <strong>Scientific Disclosure:</strong> {predictionResult.scientific_disclosure}
                </div>
              )}
            </div>
          )}
        </form>
      </section>
    </div>
  );
};

export default MachineLearningPage;
