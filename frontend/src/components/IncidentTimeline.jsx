import React, { useState, useEffect } from 'react';
import { Clock, ShieldAlert, Wind, AlertTriangle, CheckCircle2, Radio, Activity, Compass, Flame, UserCheck } from 'lucide-react';
import { apiService } from '../services/api';
import { formatToIST, formatRelativeAge } from '../utils/dateUtils';

export const IncidentTimeline = ({ incidentUuid, fallbackEvents = [] }) => {
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!incidentUuid) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    apiService.getIncidentTimeline(incidentUuid)
      .then((data) => {
        if (isMounted) {
          setTimelineData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          // Graceful fallback to provided fallback events
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [incidentUuid]);

  const events = timelineData?.events || fallbackEvents || [];
  const disclosure = timelineData?.scientific_disclosure || '';

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'FIRST_DETECTION':
        return <Radio size={14} className="text-warning" />;
      case 'PEAK_FRP':
        return <Flame size={14} className="text-critical" />;
      case 'LATEST_DETECTION':
        return <Clock size={14} className="text-info" />;
      case 'RISK_ANALYSIS':
        return <ShieldAlert size={14} className="text-critical" />;
      case 'WEATHER_ANALYSIS':
        return <Wind size={14} className="text-secondary" />;
      case 'EXPOSURE_ANALYSIS':
        return <Compass size={14} className="text-secondary" />;
      case 'ABNORMALITY_ANALYSIS':
        return <Activity size={14} className="text-warning" />;
      case 'ANALYST_REVIEW':
        return <UserCheck size={14} className="text-success" />;
      default:
        return <Clock size={14} className="text-muted" />;
    }
  };

  const getBadgeStyle = (badgeType) => {
    switch (badgeType) {
      case 'critical':
        return { background: 'rgba(217, 45, 32, 0.1)', color: '#D92D20', border: '1px solid rgba(217, 45, 32, 0.3)' };
      case 'warning':
        return { background: 'rgba(247, 144, 9, 0.1)', color: '#B54708', border: '1px solid rgba(247, 144, 9, 0.3)' };
      case 'success':
        return { background: 'rgba(18, 183, 106, 0.1)', color: '#027A48', border: '1px solid rgba(18, 183, 106, 0.3)' };
      case 'info':
        return { background: 'rgba(11, 165, 236, 0.1)', color: '#026AA2', border: '1px solid rgba(11, 165, 236, 0.3)' };
      default:
        return { background: 'var(--bg-secondary, #F8FAFC)', color: 'var(--text-secondary)', border: '1px solid var(--border-divider, #E2E8F0)' };
    }
  };

  return (
    <section className="report-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <span className="report-section-heading" style={{ marginBottom: 0 }}>
          04 &bull; Chronological Incident Investigation Timeline
        </span>
        <span className="text-muted" style={{ fontSize: '0.78rem' }}>
          {events.length} Investigation Events Recorded
        </span>
      </div>

      {loading && (
        <div className="text-muted" style={{ padding: '1.5rem 0', fontSize: '0.85rem' }}>
          Reconstructing chronological satellite passes and analysis timeline...
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-muted" style={{ padding: '1.5rem 0', fontSize: '0.85rem' }}>
          No timeline events recorded for this incident cluster.
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="incident-timeline-stream" style={{ position: 'relative', paddingLeft: '1.75rem', marginTop: '1rem' }}>
          {/* Vertical Connecting Line */}
          <div style={{
            position: 'absolute',
            left: '8px',
            top: '8px',
            bottom: '16px',
            width: '2px',
            background: 'var(--border-divider, #E2E8F0)'
          }} />

          {events.map((ev, idx) => (
            <div key={idx} style={{ position: 'relative', marginBottom: '1.25rem' }}>
              {/* Event Marker Node */}
              <div style={{
                position: 'absolute',
                left: '-1.75rem',
                top: '2px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'var(--bg-primary, #FFFFFF)',
                border: '2px solid var(--border-divider, #CBD5E1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2
              }}>
                {getEventIcon(ev.event_type)}
              </div>

              {/* Event Content Box */}
              <div style={{
                padding: '0.75rem 1rem',
                background: 'var(--bg-secondary, #F8FAFC)',
                border: '1px solid var(--border-divider, #E2E8F0)',
                borderRadius: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    {ev.title}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span className="font-mono text-muted" style={{ fontSize: '0.74rem' }}>
                      {ev.timestamp ? `${formatToIST(ev.timestamp)} • ${formatRelativeAge(ev.timestamp, '')}` : (ev.time_display || '')}
                    </span>
                    {ev.severity && (
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '0.12rem 0.45rem',
                        borderRadius: '4px',
                        ...getBadgeStyle(ev.badge_type)
                      }}>
                        {ev.severity}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-secondary" style={{ fontSize: '0.82rem', lineHeight: 1.5, margin: 0 }}>
                  {ev.description}
                </p>

                {/* Optional Telemetry Pills */}
                {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                  <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.45rem', flexWrap: 'wrap', fontSize: '0.74rem' }}>
                    {ev.metadata.frp !== undefined && (
                      <span className="font-mono text-muted">FRP: <strong>{ev.metadata.frp} MW</strong></span>
                    )}
                    {ev.metadata.brightness !== undefined && (
                      <span className="font-mono text-muted">Brightness: <strong>{ev.metadata.brightness} K</strong></span>
                    )}
                    {ev.metadata.satellite && (
                      <span className="font-mono text-muted">Sensor: <strong>{ev.metadata.satellite}</strong></span>
                    )}
                    {ev.metadata.reviewer && (
                      <span className="font-mono text-success">Reviewer: <strong>{ev.metadata.reviewer}</strong></span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scientific Disclosure */}
      <div className="text-muted" style={{ fontSize: '0.74rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
        {disclosure || 'Timeline events reflect discrete orbital satellite sensor overpasses with inherent orbital latency, not continuous ground monitoring.'}
      </div>
    </section>
  );
};

export default IncidentTimeline;
