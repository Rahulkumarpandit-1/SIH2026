import React from 'react';
import { ArrowRight, CheckCircle2, CircleDot, Clock, Zap, Globe } from 'lucide-react';

export const RoadmapSection = () => {
  const steps = [
    {
      phase: 'CURRENT MVP',
      title: 'Satellite + OSM + Persistence + Rule Engine',
      desc: 'Tested and verified 5-phase pipeline on Gujarat industrial corridor testbed with 100% test coverage.',
      status: 'completed'
    },
    {
      phase: 'NEXT MILESTONE',
      title: 'Verified Historical Accident Dataset',
      desc: 'Ingest legal industrial fire incident logs from OISD India & CSB to expand training ground-truth.',
      status: 'current'
    },
    {
      phase: 'ML EXPANSION',
      title: 'Supervised Gradient Boosting & SHAP',
      desc: 'Deploy tree ensemble classifiers with local SHAP feature attributions on multi-year national registries.',
      status: 'future'
    },
    {
      phase: 'REAL-TIME AUTOMATION',
      title: 'Automated Alerting & Drone Dispatch',
      desc: 'Webhook triggers to district disaster management authorities (NDMA/SDMA) and plant security officers.',
      status: 'future'
    },
    {
      phase: 'NATIONAL SCALE',
      title: 'All-India Petroleum & Chemical Belt',
      desc: 'Continuous automated ingestion covering all 3,500+ industrial estates across India.',
      status: 'future'
    }
  ];

  return (
    <section className="section-container">
      <div className="section-header-block">
        <div className="section-badge">Development Horizon</div>
        <h2 className="section-title">
          System Roadmap &amp; <span className="text-cyan">Future Evolution</span>
        </h2>
        <p className="section-subtitle">
          From a rigorously verified Gujarat testbed to an automated national-scale industrial fire intelligence infrastructure.
        </p>
      </div>

      <div className="roadmap-grid">
        {steps.map((s, idx) => (
          <div key={s.phase} className={`roadmap-card ${s.status}`}>
            <div className="roadmap-status-header">
              {s.status === 'completed' && <CheckCircle2 size={16} className="text-low" />}
              {s.status === 'current' && <CircleDot size={16} className="text-cyan pulse-slow" />}
              {s.status === 'future' && <Clock size={16} className="text-muted" />}
              <span className="roadmap-phase-tag">{s.phase}</span>
            </div>
            <h4 className="roadmap-title">{s.title}</h4>
            <p className="roadmap-desc">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default RoadmapSection;
