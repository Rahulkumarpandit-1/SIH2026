import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from './services/api';
import Navbar from './components/Navbar';
import OverviewPage from './pages/OverviewPage';
import IncidentsPage from './pages/IncidentsPage';
import IncidentDetailPage from './pages/IncidentDetailPage';
import GISExplorerPage from './pages/GISExplorerPage';
import HistoricalDataPage from './pages/HistoricalDataPage';
import MachineLearningPage from './pages/MachineLearningPage';
import DetectionTimelinePage from './pages/DetectionTimelinePage';
import MethodologyPage from './pages/MethodologyPage';
import Footer from './components/Footer';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

export const App = () => {
  // Navigation View State: 'overview' | 'incidents' | 'incident-detail' | 'gis' | 'historical' | 'ml' | 'timeline' | 'methodology'
  const [currentView, setCurrentView] = useState('overview');

  // Application Data State
  const [summary, setSummary] = useState(null);
  const [observations, setObservations] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [riskData, setRiskData] = useState([]);
  const [industrialPolygons, setIndustrialPolygons] = useState(null);

  // Active Selected Incident for Deep Dive Report
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Connection & Loading States
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const loadDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Probe health endpoint
      await apiService.getHealth();
      setIsOnline(true);

      // 2. Fetch critical telemetry first
      const [summaryRes, obsRes, clustersRes, riskRes] = await Promise.all([
        apiService.getSummary().catch(() => null),
        apiService.getObservations().catch(() => []),
        apiService.getClusters().catch(() => []),
        apiService.getRisk().catch(() => [])
      ]);

      const safeObs = Array.isArray(obsRes) ? obsRes : [];
      const safeClusters = Array.isArray(clustersRes) ? clustersRes : [];
      const safeRisk = Array.isArray(riskRes) ? riskRes : [];

      setSummary(summaryRes);
      setObservations(safeObs);
      setClusters(safeClusters);
      setRiskData(safeRisk);
      
      // Default selected incident
      if (safeRisk.length > 0 && !selectedIncident) {
        setSelectedIncident(safeRisk[0]);
      }

      // Unblock initial screen rendering immediately
      setIsLoading(false);
      setIsRefreshing(false);

      // 3. Asynchronously load heavy OSM polygons in background without blocking UI
      apiService.getIndustrialPolygons()
        .then((polyRes) => {
          if (polyRes && polyRes.features) {
            setIndustrialPolygons(polyRes);
          }
        })
        .catch((err) => {
          console.warn('OSM industrial polygons background fetch failed:', err);
        });

    } catch (err) {
      console.error('Failed to load telemetry from backend:', err);
      setIsOnline(false);
      setErrorMessage(
        'Telemetry API backend is currently offline. Showing local telemetry state.'
      );
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedIncident]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Inspection Navigation Handler
  const handleOpenIncidentDetail = (incident) => {
    const fullIncident = riskData.find((r) => r.cluster_id === incident.cluster_id) || incident;
    setSelectedIncident(fullIncident);
    setCurrentView('incident-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-root white-theme">
      {/* 1. Minimal Top Navigation Bar */}
      <Navbar
        currentView={currentView === 'incident-detail' ? 'incidents' : currentView}
        setCurrentView={setCurrentView}
        isOnline={isOnline}
        isRefreshing={isRefreshing}
      />

      {/* API Failure Banner */}
      {errorMessage && (
        <div className="error-banner">
          <div className="error-content">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
          <button className="btn-retry" onClick={() => loadDashboardData(true)}>
            <RefreshCw size={12} className={isRefreshing ? 'spin-anim' : ''} />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Loading Screen */}
      {isLoading ? (
        <div className="loading-state-screen">
          <Loader2 size={32} className="spin-anim text-muted" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Connecting to Near-Real-Time Thermal Stream...</h3>
          <p className="text-secondary" style={{ fontSize: '0.84rem' }}>
            Ingesting verified NASA FIRMS satellite observations and cluster telemetry
          </p>
        </div>
      ) : (
        /* Main Viewport */
        <main className="app-viewport">
          {/* View 1: Overview */}
          {currentView === 'overview' && (
            <OverviewPage
              summary={summary}
              riskData={riskData}
              observations={observations}
              clusters={clusters}
              industrialPolygons={industrialPolygons}
              onOpenIncidentDetail={handleOpenIncidentDetail}
              onNavigateToGIS={() => {
                setCurrentView('gis');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onNavigateToIncidents={() => {
                setCurrentView('incidents');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onNavigateToHistorical={() => {
                setCurrentView('historical');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onNavigateToML={() => {
                setCurrentView('ml');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onNavigateToMethodology={() => {
                setCurrentView('methodology');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onNavigateToTimeline={() => {
                setCurrentView('timeline');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onRefreshData={() => loadDashboardData(true)}
            />
          )}

          {/* View 2: Incidents Table */}
          {currentView === 'incidents' && (
            <IncidentsPage
              riskData={riskData}
              onOpenIncidentDetail={handleOpenIncidentDetail}
            />
          )}

          {/* View 2.5: Dedicated Incident Detail Report */}
          {currentView === 'incident-detail' && (
            <IncidentDetailPage
              incident={selectedIncident || riskData[0]}
              industrialPolygons={industrialPolygons}
              onBack={() => {
                setCurrentView('incidents');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {/* View 3: GIS Explorer */}
          {currentView === 'gis' && (
            <GISExplorerPage
              observations={observations}
              clusters={clusters}
              riskData={riskData}
              industrialPolygons={industrialPolygons}
              onOpenIncidentDetail={handleOpenIncidentDetail}
            />
          )}

          {/* View 4: Historical Data & Provenance */}
          {currentView === 'historical' && (
            <HistoricalDataPage />
          )}

          {/* View 5: Machine Learning Architecture */}
          {currentView === 'ml' && (
            <MachineLearningPage />
          )}

          {/* View 6: Detection Timeline */}
          {currentView === 'timeline' && (
            <DetectionTimelinePage
              riskData={riskData}
              observations={observations}
            />
          )}

          {/* View 7: Methodology & Scientific Disclosures */}
          {currentView === 'methodology' && (
            <MethodologyPage />
          )}
        </main>
      )}

      {/* Minimal Footer */}
      <Footer />
    </div>
  );
};

export default App;
