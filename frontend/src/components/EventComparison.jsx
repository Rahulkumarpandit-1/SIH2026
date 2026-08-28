import React from 'react';
import { AlertOctagon, Activity, CheckCircle2, ShieldCheck, MapPin, Flame } from 'lucide-react';

export const EventComparison = ({ riskData = [] }) => {
  // Find real clusters from fetched API data if available
  const hazira = riskData.find((r) => r.cluster_id === 'CLUSTER_003') || {
    cluster_id: 'CLUSTER_003',
    nearest_facility_name: 'Hazira Heavy Industrial Complex',
    risk_score: 92.42,
    risk_level: 'CRITICAL',
    action_code: 'EMERGENCY_DISPATCH',
    telemetry: { max_frp: 92.7, distance_to_industry_meters: 141.5, persistence_ratio: 0.20, is_anomaly_spike: true, active_days_count: 1 }
  };

  const jamnagar = riskData.find((r) => r.cluster_id === 'CLUSTER_001') || {
    cluster_id: 'CLUSTER_001',
    nearest_facility_name: 'Jamnagar Petroleum Refining Complex',
    risk_score: 48.90,
    risk_level: 'MODERATE',
    action_code: 'ROUTINE_MONITORING',
    telemetry: { max_frp: 29.1, distance_to_industry_meters: 0.0, persistence_ratio: 1.00, is_anomaly_spike: false, active_days_count: 5 }
  };

  const rural = riskData.find((r) => r.cluster_id === 'CLUSTER_004') || {
    cluster_id: 'CLUSTER_004',
    nearest_facility_name: 'Rural Agricultural Belt',
    risk_score: 24.20,
    risk_level: 'LOW',
    action_code: 'BACKGROUND_LOG',
    telemetry: { max_frp: 5.6, distance_to_industry_meters: 39256.0, persistence_ratio: 0.20, is_anomaly_spike: false, active_days_count: 1 }
  };

  return (
    <section id="comparison" className="section-container">
      <div className="section-header-block">
        <div className="section-badge">Real-World Case Comparison</div>
        <h2 className="section-title">
          Why Does One Hotspot <span className="text-cyan">Matter More Than Another?</span>
        </h2>
        <p className="section-subtitle">
          Comparing three actual verified spatial clusters from our Gujarat testbed demonstrates how 
          multi-signal contextual intelligence prevents false alarms and highlights acute emergencies.
        </p>
      </div>

      <div className="comparison-cards-grid">
        {/* Case 1: Hazira Sudden Outbreak */}
        <div className="comparison-card critical">
          <div className="comp-card-header">
            <div className="comp-badge critical">CRITICAL &bull; {hazira.risk_score?.toFixed(1)} / 100</div>
            <h3 className="comp-title">{hazira.cluster_id} — Hazira Steel Complex</h3>
            <span className="comp-sub">Sudden High-Power Explosion / Surge</span>
          </div>

          <div className="comp-metrics-table">
            <div className="comp-metric-row">
              <span className="comp-label">Max Thermal Radiance (FRP):</span>
              <strong className="comp-val text-critical">{(hazira.telemetry?.max_frp ?? 92.7).toFixed(1)} MW (Extreme)</strong>
            </div>
            <div className="comp-metric-row">
              <span className="comp-label">Industrial Boundary Proximity:</span>
              <strong className="comp-val text-critical">141.5 m (Facility Buffer)</strong>
            </div>
            <div className="comp-metric-row">
              <span className="comp-label">Historical Persistence Ratio:</span>
              <strong className="comp-val">{((hazira.telemetry?.persistence_ratio ?? 0.2) * 100).toFixed(0)}% (1 of 5 days)</strong>
            </div>
            <div className="comp-metric-row">
              <span className="comp-label">Anomaly Spike Flag:</span>
              <strong className="comp-val text-critical">YES (Sudden Unprecedented Heat)</strong>
            </div>
          </div>

          <div className="comp-verdict critical">
            <strong>System Evaluation:</strong> High thermal power inside heavy industrial park with no prior recurrence triggers immediate emergency triage dispatch.
          </div>
        </div>

        {/* Case 2: Jamnagar Routine Flare */}
        <div className="comparison-card moderate">
          <div className="comp-card-header">
            <div className="comp-badge moderate">MODERATE &bull; {jamnagar.risk_score?.toFixed(1)} / 100</div>
            <h3 className="comp-title">{jamnagar.cluster_id} — Jamnagar Refinery</h3>
            <span className="comp-sub">Continuous Operational Gas Flaring</span>
          </div>

          <div className="comp-metrics-table">
            <div className="comp-metric-row">
              <span className="comp-label">Max Thermal Radiance (FRP):</span>
              <strong className="comp-val text-cyan">{(jamnagar.telemetry?.max_frp ?? 29.1).toFixed(1)} MW (Normal Flare)</strong>
            </div>
            <div className="comp-metric-row">
              <span className="comp-label">Industrial Boundary Proximity:</span>
              <strong className="comp-val text-cyan">0 m (Inside Refinery)</strong>
            </div>
            <div className="comp-metric-row">
              <span className="comp-label">Historical Persistence Ratio:</span>
              <strong className="comp-val text-low">100% (5 of 5 days active)</strong>
            </div>
            <div className="comp-metric-row">
              <span className="comp-label">Anomaly Spike Flag:</span>
              <strong className="comp-val text-low">NORMAL (Expected Flare Baseline)</strong>
            </div>
          </div>

          <div className="comp-verdict moderate">
            <strong>System Evaluation:</strong> Even though situated inside an oil refinery, continuous multi-day recurrence applies an operational discount to prevent false alarms.
          </div>
        </div>

        {/* Case 3: Rural Stubble Burn */}
        <div className="comparison-card low">
          <div className="comp-card-header">
            <div className="comp-badge low">LOW RISK &bull; {rural.risk_score?.toFixed(1)} / 100</div>
            <h3 className="comp-title">{rural.cluster_id} — Rural Gujarat</h3>
            <span className="comp-sub">Agricultural Crop Residue Burn</span>
          </div>

          <div className="comp-metrics-table">
            <div className="comp-metric-row">
              <span className="comp-label">Max Thermal Radiance (FRP):</span>
              <strong className="comp-val">{(rural.telemetry?.max_frp ?? 5.6).toFixed(1)} MW (Low Energy)</strong>
            </div>
            <div className="comp-metric-row">
              <span className="comp-label">Industrial Boundary Proximity:</span>
              <strong className="comp-val">&gt;39 km (Remote Countryside)</strong>
            </div>
            <div className="comp-metric-row">
              <span className="comp-label">Historical Persistence Ratio:</span>
              <strong className="comp-val">20% (1 of 5 days)</strong>
            </div>
            <div className="comp-metric-row">
              <span className="comp-label">Anomaly Spike Flag:</span>
              <strong className="comp-val text-low">NORMAL (Seasonal Transient)</strong>
            </div>
          </div>

          <div className="comp-verdict low">
            <strong>System Evaluation:</strong> Remote rural distance and low power safely filter this event into background logs, sparing industrial response teams.
          </div>
        </div>
      </div>
    </section>
  );
};

export default EventComparison;
