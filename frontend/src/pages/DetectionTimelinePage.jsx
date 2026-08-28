import React, { useState, useMemo } from 'react';
import { 
  Radio, 
  Flame, 
  Layers, 
  Activity, 
  Cpu, 
  ShieldCheck, 
  MapPin, 
  Clock, 
  CheckCircle2,
  Calendar,
  Eye
} from 'lucide-react';

export const DetectionTimelinePage = ({ riskData = [], observations = [] }) => {
  const [selectedDate, setSelectedDate] = useState('ALL');
  const [selectedClusterId, setSelectedClusterId] = useState(riskData[0]?.cluster_id || 'CLUSTER_001');

  // Extract unique observation dates dynamically
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(observations.map((o) => o.acq_date).filter(Boolean))).sort();
    return ['ALL', ...dates];
  }, [observations]);

  const filteredObservations = useMemo(() => {
    if (selectedDate === 'ALL') return observations;
    return observations.filter((o) => o.acq_date === selectedDate);
  }, [observations, selectedDate]);

  const selectedIncident = useMemo(() => {
    return riskData.find((r) => r.cluster_id === selectedClusterId) || riskData[0];
  }, [riskData, selectedClusterId]);

  const clusterObs = useMemo(() => {
    return observations.filter((o) => o.cluster_id === selectedClusterId);
  }, [observations, selectedClusterId]);

  const pipelineSteps = useMemo(() => {
    if (!selectedIncident) return [];

    const frp = (selectedIncident.telemetry?.max_frp ?? 0.0).toFixed(1);
    const bright = (selectedIncident.telemetry?.max_brightness ?? 300.0).toFixed(1);
    const dist = (selectedIncident.telemetry?.distance_to_industry_meters ?? 0.0) === 0 
      ? '0.0 m (Inside Polygon)' 
      : `${selectedIncident.telemetry?.distance_to_industry_meters} m`;
    const pRatio = ((selectedIncident.telemetry?.persistence_ratio ?? 0.0) * 100).toFixed(0);
    const activeDays = selectedIncident.telemetry?.active_days_count ?? 1;
    const isSpike = selectedIncident.telemetry?.is_anomaly_spike;

    return [
      {
        step: '01',
        title: 'Satellite Radiance Capture',
        subtitle: 'NASA VIIRS & MODIS Orbital Acquisition',
        desc: 'Satellites capture middle-infrared photons (Channel I4: 3.74 μm) and compute Fire Radiative Power (MW).',
        evidence: [
          `Active Cluster Hotspots: ${clusterObs.length > 0 ? clusterObs.length : selectedIncident.telemetry?.total_detections ?? 1} Pixels`,
          `Peak Radiant Heat Flux: ${frp} MW`,
          `Sensor Brightness: ${bright} K`
        ]
      },
      {
        step: '02',
        title: 'Thermal Physical Extraction',
        subtitle: 'Sub-Pixel Contrast & Radiance Filtering',
        desc: 'Calculates thermal contrast (ΔT = T4 - T31) to isolate sub-pixel combustion against ambient terrain.',
        evidence: [
          'Sensor Quality Gates: Strict Pydantic v2 Schema Compliance',
          'Coordinate Bounds Check: Validated within Gujarat Industrial Corridor'
        ]
      },
      {
        step: '03',
        title: 'Spatial Industrial Geofencing',
        subtitle: '3,970 OpenStreetMap Polygon Projections',
        desc: 'Computes spherical geodesic boundary distance to petrochemical plants and chemical parks.',
        evidence: [
          `Nearest Installation: ${selectedIncident.nearest_facility_name}`,
          `Shortest Boundary Distance: ${dist}`,
          `Spatial Zone Tier: ${selectedIncident.spatial_context}`
        ]
      },
      {
        step: '04',
        title: 'Spatio-Temporal DBSCAN Clustering',
        subtitle: '750m Haversine Radius Grouping',
        desc: 'Merges multi-pass satellite detections of the same physical site into unified cluster records.',
        evidence: [
          `Unified Cluster ID: ${selectedIncident.cluster_id}`,
          `Centroid Coordinates: ${selectedIncident.centroid_latitude?.toFixed(4)}°N, ${selectedIncident.centroid_longitude?.toFixed(4)}°E`,
          `Total Grouped Detections: ${selectedIncident.telemetry?.total_detections ?? 1} Hotspots`
        ]
      },
      {
        step: '05',
        title: 'Temporal Persistence Math',
        subtitle: 'Refinery Flaring Suppression Formula',
        desc: 'Calculates active detection recurrence (Pratio = active_days / total_days) to filter routine flares.',
        evidence: [
          `Active Window Days: ${activeDays} Days`,
          `Persistence Ratio: ${pRatio}%`,
          `Operational Flaring Discount: ${parseFloat(pRatio) >= 50 ? 'APPLIED (Continuous Flare)' : 'NOT APPLIED (Acute Event)'}`
        ]
      },
      {
        step: '06',
        title: 'Statistical Anomaly Surge Detection',
        subtitle: 'Historical Radiance Baseline Comparison',
        desc: 'Evaluates whether instantaneous heat output spikes significantly above historical site medians.',
        evidence: [
          `Surge Anomaly Status: ${isSpike ? 'SURGE SPIKE DETECTED (Acute Outbreak)' : 'NORMAL OPERATIONAL BASELINE'}`,
          `Surge Penalty Factor: ${isSpike ? '+95 pts Anomaly Weight' : '0 pts Baseline'}`
        ]
      },
      {
        step: '07',
        title: 'Multi-Signal Risk Scoring (Phase 4)',
        subtitle: 'Deterministic 4-Dimension Synthesis',
        desc: 'Calculates R = 0.35(Thermal) + 0.30(Proximity) + 0.25(Persistence) + 0.10(Confidence).',
        evidence: [
          `Thermal Subscore (35%): ${selectedIncident.subscores?.thermal_subscore?.toFixed(1) ?? '0.0'} pts`,
          `Proximity Subscore (30%): ${selectedIncident.subscores?.proximity_subscore?.toFixed(1) ?? '0.0'} pts`,
          `Persistence Subscore (25%): ${selectedIncident.subscores?.persistence_subscore?.toFixed(1) ?? '0.0'} pts`,
          `Sensor Confidence (10%): ${selectedIncident.subscores?.confidence_subscore?.toFixed(1) ?? '0.0'} pts`,
          `Composite Risk Score: ${selectedIncident.risk_score?.toFixed(2)} / 100`
        ]
      },
      {
        step: '08',
        title: 'Operational Dispatch Directive',
        subtitle: 'Actionable Emergency Protocol Assignment',
        desc: 'Translates risk score into automated disaster management protocols (EVACUATE, DRONE_INSPECT, LOG).',
        evidence: [
          `Mandated Directive: ${selectedIncident.action_code}`,
          `Assigned Priority Tier: ${selectedIncident.risk_level}`,
          `Current Ground Truth: UNLABELED (Awaiting Independent Verification)`
        ]
      }
    ];
  }, [selectedIncident, clusterObs]);

  return (
    <div className="timeline-page">
      {/* Header */}
      <div className="page-header-block" style={{ marginBottom: '2rem' }}>
        <div className="section-tag">MULTI-DAY TEMPORAL AUDIT &bull; SIH26162</div>
        <h1 className="section-heading-lg">Detection Timeline &amp; Pipeline Trace</h1>
        <p className="section-subtext">
          Trace how thermal detections evolve over the historical observation window and follow any incident 
          through the 8-step analytical detection lifecycle from orbital photon to emergency dispatch directive.
        </p>
      </div>

      {/* 01 — Filter by Acquisition Date */}
      <section className="spacious-section" style={{ padding: '0 0 1.5rem 0' }}>
        <div className="section-tag">FILTER BY ACQUISITION DATE ({availableDates.length - 1} DAYS IN HISTORICAL WINDOW)</div>
        <div className="timeline-date-nav" style={{ marginTop: '0.5rem' }}>
          {availableDates.map((d) => (
            <button
              key={d}
              className={`timeline-date-btn ${selectedDate === d ? 'active' : ''}`}
              onClick={() => setSelectedDate(d)}
            >
              {d === 'ALL' ? `All Dates (${availableDates.length - 1} Days)` : d}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          Displaying <strong>{filteredObservations.length}</strong> active satellite hotspot observations for selected date filter.
        </div>
      </section>

      <div className="divider-sm" />

      {/* 02 — Observation Overview Table */}
      <section className="spacious-section">
        <div className="section-tag">SATELLITE OBSERVATION TIMELINE FEED</div>
        <h2 className="section-heading">Chronological Hotspot Detections</h2>

        <div className="table-responsive" style={{ marginTop: '1rem', maxHeight: '380px' }}>
          <table className="clean-table">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Obs ID</th>
                <th>Cluster</th>
                <th>Peak FRP</th>
                <th>Brightness</th>
                <th>Facility Context</th>
                <th>Distance</th>
                <th>Risk Tier</th>
              </tr>
            </thead>
            <tbody>
              {filteredObservations.slice(0, 25).map((obs) => (
                <tr 
                  key={obs.observation_id}
                  onClick={() => setSelectedClusterId(obs.cluster_id)}
                  style={{ cursor: 'pointer', background: selectedClusterId === obs.cluster_id ? 'var(--bg-secondary)' : undefined }}
                >
                  <td className="font-mono">{obs.acq_date} {obs.acq_time}</td>
                  <td className="font-mono text-muted">#{obs.observation_id}</td>
                  <td className="font-mono font-bold">{obs.cluster_id}</td>
                  <td className="font-mono font-bold text-critical">{obs.frp} MW</td>
                  <td className="font-mono">{obs.brightness} K</td>
                  <td>{obs.nearest_facility_name}</td>
                  <td className="font-mono">
                    {(obs.distance_to_industry_meters ?? 0) === 0 ? '0 m (Inside)' : `${obs.distance_to_industry_meters} m`}
                  </td>
                  <td>
                    <span className={`status-indicator-tag ${obs.risk_level === 'CRITICAL' ? 'critical' : obs.risk_level === 'MODERATE' ? 'warning' : 'success'}`}>
                      {obs.risk_level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="divider" />

      {/* 03 — 8-Step Analytical Lifecycle Audit Trail */}
      <section className="spacious-section">
        <div className="section-header-flex">
          <div>
            <div className="section-tag">8-STEP DETECTION LIFECYCLE AUDIT TRAIL</div>
            <h2 className="section-heading">Analytical Pipeline Progression for Selected Incident</h2>
            <p className="section-subtext">
              Trace the exact progression of data, physical formulas, and spatial enrichment for the active incident.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="text-muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Active Cluster:</span>
            <select
              className="select-input"
              value={selectedClusterId}
              onChange={(e) => setSelectedClusterId(e.target.value)}
              style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}
            >
              {riskData.map((c) => (
                <option key={c.cluster_id} value={c.cluster_id}>
                  {c.cluster_id} &bull; Risk: {c.risk_score.toFixed(1)} [{c.risk_level}]
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedIncident && (
          <div className="timeline-feed-list" style={{ marginTop: '1.75rem' }}>
            {pipelineSteps.map((s) => (
              <div key={s.step} className="timeline-feed-item">
                <div className="section-tag">STEP {s.step} &bull; {s.subtitle}</div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{s.title}</h3>
                <p className="text-secondary" style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
                  {s.desc}
                </p>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-divider)', padding: '0.75rem 1rem', borderRadius: '4px', marginTop: '0.35rem' }}>
                  {s.evidence.map((ev, idx) => (
                    <div key={idx} className="font-mono text-secondary" style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>
                      &bull; {ev}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default DetectionTimelinePage;
