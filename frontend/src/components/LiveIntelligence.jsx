import React, { useState, useMemo } from 'react';
import SummaryStats from './SummaryStats';
import FilterBar from './FilterBar';
import GISMapView from './GISMapView';
import IncidentDetailPanel from './IncidentDetailPanel';
import PriorityTriageTable from './PriorityTriageTable';
import { RefreshCw, MapPin, Radio } from 'lucide-react';

export const LiveIntelligence = ({
  summary,
  observations = [],
  clusters = [],
  riskData = [],
  industrialPolygons = null,
  isRefreshing,
  onRefresh
}) => {
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [selectedObservation, setSelectedObservation] = useState(null);
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('ALL');

  // Default select top-ranked cluster (Hazira CLUSTER_003) if none selected
  React.useEffect(() => {
    if (riskData.length > 0 && !selectedCluster) {
      setSelectedCluster(riskData[0]);
    }
  }, [riskData, selectedCluster]);

  const availableDates = useMemo(() => {
    if (!observations.length) return [];
    return Array.from(new Set(observations.map((o) => o.acq_date))).sort();
  }, [observations]);

  // Filtered dataset according to active filter chips
  const filteredRiskData = useMemo(() => {
    return riskData.filter((item) => {
      if (selectedRisk !== 'ALL' && item.risk_level !== selectedRisk) return false;
      if (selectedClass !== 'ALL' && item.incident_classification !== selectedClass) return false;
      return true;
    });
  }, [riskData, selectedRisk, selectedClass]);

  const filteredClusters = useMemo(() => {
    return clusters.filter((item) => {
      const riskMeta = riskData.find((r) => r.cluster_id === item.cluster_id);
      if (selectedRisk !== 'ALL' && riskMeta?.risk_level !== selectedRisk) return false;
      if (selectedClass !== 'ALL' && riskMeta?.incident_classification !== selectedClass) return false;
      return true;
    });
  }, [clusters, riskData, selectedRisk, selectedClass]);

  const handleSelectCluster = (clusterItem) => {
    const fullRisk = riskData.find((r) => r.cluster_id === clusterItem.cluster_id) || clusterItem;
    setSelectedCluster(fullRisk);
    setSelectedObservation(null);
  };

  const handleSelectObservation = (obsItem) => {
    setSelectedObservation(obsItem);
    const parentCluster = riskData.find((r) => r.cluster_id === obsItem.cluster_id);
    if (parentCluster) setSelectedCluster(parentCluster);
  };

  return (
    <section id="live-intelligence" className="section-container live-intel-section">
      <div className="section-header-block">
        <div className="section-badge">Interactive Command Center</div>
        <h2 className="section-title">
          Live Geospatial Intelligence &amp; <span className="text-cyan">Incident Triage</span>
        </h2>
        <p className="section-subtitle">
          Real-time map visualization integrating NASA FIRMS thermal hotspots, OpenStreetMap industrial polygons, 
          and deterministic Phase 4 risk scoring.
        </p>
      </div>

      {/* 1. KPI Summary Cards */}
      <SummaryStats summary={summary} />

      {/* 2. Interactive Filter Controls */}
      <FilterBar
        selectedRisk={selectedRisk}
        setSelectedRisk={setSelectedRisk}
        selectedClass={selectedClass}
        setSelectedClass={setSelectedClass}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        availableDates={availableDates}
      />

      {/* 3. Main Split View: GIS Map & Incident Detail Panel */}
      <div className="main-grid">
        <GISMapView
          observations={observations}
          clusters={filteredClusters}
          industrialPolygons={industrialPolygons}
          selectedCluster={selectedCluster}
          onSelectCluster={handleSelectCluster}
          onSelectObservation={handleSelectObservation}
        />

        <IncidentDetailPanel
          selectedCluster={selectedCluster}
          selectedObservation={selectedObservation}
        />
      </div>

      {/* 4. Ranked Priority Triage Table */}
      <PriorityTriageTable
        riskData={filteredRiskData}
        selectedClusterId={selectedCluster?.cluster_id}
        onSelectCluster={handleSelectCluster}
      />
    </section>
  );
};

export default LiveIntelligence;
