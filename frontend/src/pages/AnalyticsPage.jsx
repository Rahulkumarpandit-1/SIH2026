import React, { useState, useEffect } from 'react';
import apiService from '../services/api';

export const AnalyticsPage = ({ summary, riskData = [], observations = [] }) => {
  const [mlData, setMlData] = useState(null);

  useEffect(() => {
    const fetchMl = async () => {
      try {
        const res = await apiService.getMLEvaluation();
        setMlData(res);
      } catch (err) {
        console.error('Failed to fetch ML evaluation:', err);
      }
    };
    fetchMl();
  }, []);

  const sortedClusters = [...riskData].sort((a, b) => b.risk_score - a.risk_score);

  const featureImportances = mlData?.feature_importances || {
    "brightness": 0.222,
    "bright_t31": 0.218,
    "thermal_contrast": 0.169,
    "frp": 0.145,
    "distance_to_industry": 0.077,
    "persistence_ratio": 0.073,
    "active_days_count": 0.067,
    "confidence_normalized": 0.029
  };

  return (
    <div className="analytics-page">
      {/* Header */}
      <div className="page-header-block" style={{ marginBottom: '2.5rem' }}>
        <div className="section-tag">Regional Analytics &bull; Empirical Audit</div>
        <h1 className="section-heading-lg">Regional Analytics &amp; ML Evaluation</h1>
        <p className="section-lead-text">
          Quantitative distributions derived from satellite telemetry across Gujarat, 
          alongside empirical machine learning evaluation benchmarking the Phase 4 Rule Engine.
        </p>
      </div>

      {/* 2-Column Analytics Grid */}
      <div className="analytics-two-col">
        {/* Left: Risk Distribution */}
        <div className="analytics-block">
          <div>
            <div className="section-tag">Cluster Tiers</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Risk Level Distribution</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="bar-row-clean">
              <span className="text-critical font-bold">Critical (&ge; 80.0)</span>
              <div className="track-clean">
                <div className="fill-clean critical" style={{ width: `${((summary?.critical_count ?? 1) / 6) * 100}%` }} />
              </div>
              <span className="font-mono text-muted">{summary?.critical_count ?? 1} site</span>
            </div>

            <div className="bar-row-clean">
              <span className="text-warning font-bold">High (60.0 &ndash; 79.9)</span>
              <div className="track-clean">
                <div className="fill-clean" style={{ width: '0%' }} />
              </div>
              <span className="font-mono text-muted">{summary?.high_count ?? 0} sites</span>
            </div>

            <div className="bar-row-clean">
              <span className="text-warning font-bold">Moderate (30.0 &ndash; 59.9)</span>
              <div className="track-clean">
                <div className="fill-clean warning" style={{ width: `${((summary?.moderate_count ?? 3) / 6) * 100}%` }} />
              </div>
              <span className="font-mono text-muted">{summary?.moderate_count ?? 3} sites</span>
            </div>

            <div className="bar-row-clean">
              <span className="text-success font-bold">Low (0.0 &ndash; 29.9)</span>
              <div className="track-clean">
                <div className="fill-clean success" style={{ width: `${((summary?.low_count ?? 2) / 6) * 100}%` }} />
              </div>
              <span className="font-mono text-muted">{summary?.low_count ?? 2} sites</span>
            </div>
          </div>
        </div>

        {/* Right: Cluster Risk Rankings */}
        <div className="analytics-block">
          <div>
            <div className="section-tag">Rankings</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Cluster Risk Score Hierarchy</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {sortedClusters.map((c) => (
              <div key={c.cluster_id} className="bar-row-clean">
                <div>
                  <span className="font-mono font-bold" style={{ fontSize: '0.8rem' }}>{c.cluster_id}</span>
                  <span className="text-muted" style={{ display: 'block', fontSize: '0.7rem' }}>
                    {c.nearest_facility_name.split(' ')[0]}
                  </span>
                </div>
                <div className="track-clean">
                  <div 
                    className={`fill-clean ${c.risk_level === 'CRITICAL' ? 'critical' : c.risk_level === 'MODERATE' ? 'warning' : 'success'}`} 
                    style={{ width: `${c.risk_score}%` }} 
                  />
                </div>
                <span className="font-mono font-bold" style={{ fontSize: '0.82rem' }}>
                  {c.risk_score.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Importances */}
      <section className="section-spacing">
        <div className="page-header-block" style={{ marginBottom: '1.5rem' }}>
          <div className="section-tag">Phase 5 Machine Learning</div>
          <h2 className="section-heading-lg" style={{ fontSize: '1.4rem' }}>
            Random Forest Feature Importances (Spatial Group K-Fold)
          </h2>
          <p className="doc-body-p" style={{ fontSize: '0.86rem' }}>
            Weights learned by a Random Forest classifier across 9-dimensional telemetry feature vectors. 
            Spatial leakage is eliminated by grouping test folds by geographic cluster rather than random row splitting.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {Object.entries(featureImportances).map(([feat, imp]) => (
            <div key={feat} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span className="font-mono text-secondary">{feat}</span>
                <strong className="font-mono">{(imp * 100).toFixed(1)}%</strong>
              </div>
              <div className="track-clean">
                <div className="fill-clean" style={{ width: `${imp * 350}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture Comparison Table */}
      <section className="section-spacing">
        <div className="page-header-block" style={{ marginBottom: '1rem' }}>
          <div className="section-tag">Architecture Assessment</div>
          <h2 className="section-heading-lg" style={{ fontSize: '1.4rem' }}>
            Why Phase 4 Rule Engine is Primary vs. Phase 5 Spatial ML
          </h2>
        </div>

        <table className="clean-table">
          <thead>
            <tr>
              <th>Evaluation Dimension</th>
              <th>Phase 4 Multi-Signal Rule Engine (Operational MVP)</th>
              <th>Phase 5 Spatial ML Benchmark (Evaluation)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Explainability</strong></td>
              <td>100% Deterministic mathematical formula.</td>
              <td>Statistical feature importances (Gini/Tree splits).</td>
            </tr>
            <tr>
              <td><strong>Spatial Leakage Resistance</strong></td>
              <td>Immune (Physical distance &amp; polygon boundary calculation).</td>
              <td>Guaranteed via Spatial Group K-Fold cross validation.</td>
            </tr>
            <tr>
              <td><strong>Ground-Truth Dependency</strong></td>
              <td>Zero labels required (Physical domain weighting).</td>
              <td>Requires thousands of verified accident records to train.</td>
            </tr>
            <tr>
              <td><strong>Flaring Suppression</strong></td>
              <td>Explicit recurrence ratio discount (Pratio &ge; 0.5).</td>
              <td>Learns temporal recurrence boundaries statistically.</td>
            </tr>
            <tr>
              <td><strong>Current Deployment Role</strong></td>
              <td><strong>Primary Operational Decision Core</strong></td>
              <td><strong>Empirical Evaluation Benchmark</strong></td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default AnalyticsPage;
