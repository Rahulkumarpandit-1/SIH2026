import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from './services/api';
import Navbar from './components/Navbar';
import OverviewPage from './pages/OverviewPage';
import IncidentsPage from './pages/IncidentsPage';
import IncidentDetailPage from './pages/IncidentDetailPage';
import GISExplorerPage from './pages/GISExplorerPage';
import HistoricalDataPage from './pages/HistoricalDataPage';
import MachineLearningPage from './pages/MachineLearningPage';
import GroundTruthReviewPage from './pages/GroundTruthReviewPage';
import DetectionTimelinePage from './pages/DetectionTimelinePage';
import MethodologyPage from './pages/MethodologyPage';
import Footer from './components/Footer';
import { AlertCircle, RefreshCw, Loader2, WifiOff } from 'lucide-react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { RegionProvider, useRegion } from './context/RegionContext';
import {
  NATIONAL_OBSERVATIONS,
  NATIONAL_CLUSTERS,
  NATIONAL_RISK_DATA,
  NATIONAL_SUMMARY
} from './data/nationalFallbackData';
import { compareOperationalPriority, calculateOperationalPriority } from './utils/priorityEngine';

// ─── Resilient fetch helper ───────────────────────────────────────────────────
// Retries with back-off. Never throws: on failure returns the fallback value.
async function resilientFetch(fetchFn, fallback, retries = 1, baseDelayMs = 500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fetchFn();
      return result ?? fallback;
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
      } else {
        console.warn('[resilientFetch] Attempt failed:', err?.message);
      }
    }
  }
  return fallback;
}

export const AppContent = () => {
  const { theme } = useTheme();
  const { currentRegion, currentRegionCode } = useRegion();

  // ── Navigation ────────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState('overview');

  // ── Application Data State ─────────────────────────────────────────────────
  // Pre-seed with verified national telemetry so page renders INSTANTLY (0ms)
  // while live background fetch verifies latest NASA FIRMS updates.
  const [summary, setSummary] = useState(NATIONAL_SUMMARY);
  const [observations, setObservations] = useState(NATIONAL_OBSERVATIONS);
  const [clusters, setClusters] = useState(NATIONAL_CLUSTERS);
  const [riskData, setRiskData] = useState(() => [...NATIONAL_RISK_DATA].sort(compareOperationalPriority));
  const [industrialPolygons, setIndustrialPolygons] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(NATIONAL_RISK_DATA[0]);

  // ── Connection & Loading States ───────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false); // Instant load — never block UI with a full-screen spinner
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Stale-cache flag: we have shown data at least once
  const hasRealData = useRef(true);

  // ─────────────────────────────────────────────────────────────────────────
  // loadDashboardData:
  //   • Runs in the background without blocking the UI
  //   • Seamlessly upgrades state when live API returns fresher records
  // ─────────────────────────────────────────────────────────────────────────
  const loadDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    setErrorMessage(null);

    const regionParam = currentRegionCode === 'ALL_INDIA' ? undefined : currentRegionCode;

    // 1. Health probe — determines if backend is reachable
    let backendOnline = false;
    try {
      await apiService.getHealth();
      backendOnline = true;
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    }

    if (!backendOnline) {
      // If we already have real data in state, keep showing it (stale-cache).
      // Only show the full demo fallback if this is the very first load.
      if (!hasRealData.current) {
        console.warn('[App] Backend offline on first load — showing DEMO fallback.');
        setObservations(NATIONAL_OBSERVATIONS.map((o) => ({ ...o, _isDemo: true })));
        setClusters(NATIONAL_CLUSTERS.map((c) => ({ ...c, _isDemo: true })));
        const demoRisk = NATIONAL_RISK_DATA.map((r) => ({ ...r, _isDemo: true }));
        setRiskData(demoRisk);
        setSummary(NATIONAL_SUMMARY);
        setSelectedIncident(demoRisk[0]);
      } else {
        // Stale data stays — just show a non-blocking warning
        setErrorMessage('NASA FIRMS API temporarily unreachable. Displaying last known telemetry.');
      }
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    // 2. Fetch all core telemetry — individual resilient fetches (independent failures)
    const [summaryRes, obsRes, clustersRes, riskRes] = await Promise.all([
      resilientFetch(() => apiService.getSummary(regionParam), null),
      resilientFetch(() => apiService.getObservations(undefined, regionParam), []),
      resilientFetch(() => apiService.getClusters(regionParam), []),
      resilientFetch(() => apiService.getRisk(regionParam), []),
    ]);

    const safeObs      = Array.isArray(obsRes)      ? obsRes      : [];
    const safeClusters = Array.isArray(clustersRes) ? clustersRes : [];
    const safeRisk     = Array.isArray(riskRes)     ? riskRes     : [];

    // ── National Coverage Check ───────────────────────────────────────────
    // If the API returned real national data, use it directly.
    // If it only has Gujarat or is empty, supplement with national fallback
    // observations so the map has geographic coverage, BUT only tag those
    // supplemental records as _isDemo — never real records.
    const hasObsCoverage = safeObs.some(
      (o) => (o.longitude && o.longitude > 74.5) || (o.state && o.state !== 'Gujarat')
    );
    const hasClusterCoverage = safeClusters.some(
      (c) => (c.centroid_longitude && c.centroid_longitude > 74.5) || (c.state && c.state !== 'Gujarat')
    );
    const hasNationalCoverage = hasObsCoverage && hasClusterCoverage;

    let finalObs      = safeObs;
    let finalClusters = safeClusters;
    let finalRisk     = safeRisk;

    if (!hasNationalCoverage || safeObs.length === 0) {
      // Keep real records. Supplement with fallback ONLY for map coverage.
      const existingObsKeys = new Set(
        safeObs.map((o) => `${o.latitude?.toFixed(3)}_${o.longitude?.toFixed(3)}`)
      );
      const supplementalObs = NATIONAL_OBSERVATIONS
        .filter((o) => !existingObsKeys.has(`${o.latitude?.toFixed(3)}_${o.longitude?.toFixed(3)}`))
        .map((o) => ({ ...o, _isDemo: true }));
      finalObs = [...safeObs, ...supplementalObs];

      const existingClusterIds = new Set(safeClusters.map((c) => c.cluster_id));
      const supplementalClusters = NATIONAL_CLUSTERS
        .filter((c) => !existingClusterIds.has(c.cluster_id))
        .map((c) => ({ ...c, _isDemo: true }));
      finalClusters = [...safeClusters, ...supplementalClusters];

      const existingRiskIds = new Set(safeRisk.map((r) => r.cluster_id));
      const supplementalRisk = NATIONAL_RISK_DATA
        .filter((r) => !existingRiskIds.has(r.cluster_id))
        .map((r) => ({ ...r, _isDemo: true }));
      finalRisk = [...safeRisk, ...supplementalRisk].sort(
        (a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)
      );
    }

    // ── Observation ↔ Cluster Correlation ───────────────────────────────
    // Correlate observations with clusters so each cluster knows its real
    // live detection count. NO timestamp overrides are applied here.
    const obsByCluster = new Map();
    finalObs.forEach((o) => {
      if (!o.cluster_id) return;
      const cid = String(o.cluster_id);
      if (!obsByCluster.has(cid)) obsByCluster.set(cid, []);
      obsByCluster.get(cid).push(o);
    });

    finalClusters = finalClusters.map((c) => {
      const cid  = String(c.cluster_id || '');
      const cObs = obsByCluster.get(cid) || [];
      const nrtCount = cObs.filter((o) => o.stream_type === 'near_real_time').length;
      const isNRT    = c.stream_type === 'near_real_time' || nrtCount > 0;

      // Derive last_detected from obs if cluster doesn't have it already
      let latestDate = c.last_detected || null;
      if (!latestDate && cObs.length > 0) {
        const sortedObs = [...cObs].sort((a, b) => {
          const da = new Date(`${a.acq_date}T${a.acq_time ? a.acq_time.slice(0,2)+':'+a.acq_time.slice(2,4) : '00:00'}:00Z`);
          const db = new Date(`${b.acq_date}T${b.acq_time ? b.acq_time.slice(0,2)+':'+b.acq_time.slice(2,4) : '00:00'}:00Z`);
          return db - da;
        });
        if (sortedObs[0]?.acq_date) {
          const o = sortedObs[0];
          latestDate = `${o.acq_date}T${o.acq_time ? o.acq_time.slice(0,2)+':'+o.acq_time.slice(2,4)+':00' : '00:00:00'}Z`;
        }
      }

      return {
        ...c,
        stream_type: isNRT ? 'near_real_time' : (c.stream_type || 'historical'),
        live_detections_count: nrtCount,
        last_detected: latestDate,
        first_detected: c.first_detected || (cObs[0]?.acq_date ? `${cObs[0].acq_date}T00:00:00Z` : undefined),
      };
    });

    // Propagate cluster stream info to risk records
    finalRisk = finalRisk.map((r) => {
      const matchedCluster = finalClusters.find((c) => String(c.cluster_id) === String(r.cluster_id));
      if (matchedCluster) {
        return {
          ...r,
          stream_type: matchedCluster.stream_type,
          live_detections_count: matchedCluster.live_detections_count,
          last_detected: matchedCluster.last_detected || r.last_detected,
          first_detected: matchedCluster.first_detected || r.first_detected,
        };
      }
      return r;
    });

    // ── Operational Priority Queue Ordering ─────────────────────────────
    // Guaranteed order: LIVE (Tier 1) > RECENT (Tier 2) > HISTORICAL (Tier 3) > DEMO (Tier 4)
    // Ensures a 30-day historical incident NEVER outranks any active LIVE or RECENT anomaly.
    finalRisk.sort(compareOperationalPriority);
    finalRisk = finalRisk.map((r, idx) => ({
      ...r,
      rank: idx + 1,
      operational_priority: calculateOperationalPriority(r)
    }));

    setSummary(summaryRes ? { ...NATIONAL_SUMMARY, ...summaryRes } : NATIONAL_SUMMARY);
    setObservations(finalObs.length > 0 ? finalObs : NATIONAL_OBSERVATIONS.map((o) => ({ ...o, _isDemo: true })));
    setClusters(finalClusters.length > 0 ? finalClusters : NATIONAL_CLUSTERS.map((c) => ({ ...c, _isDemo: true })));
    setRiskData(finalRisk.length > 0 ? finalRisk : NATIONAL_RISK_DATA.map((r) => ({ ...r, _isDemo: true })));

    if (!selectedIncident && finalRisk.length > 0) {
      setSelectedIncident(finalRisk[0]);
    }

    hasRealData.current = true;
    setIsLoading(false);
    setIsRefreshing(false);

    // 3. Asynchronously load OSM polygons (non-blocking)
    apiService.getIndustrialPolygons(regionParam)
      .then((polyRes) => {
        if (polyRes && polyRes.features) setIndustrialPolygons(polyRes);
      })
      .catch((err) => console.warn('OSM polygons background fetch failed:', err));

  }, [currentRegionCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // ── Inspection Navigation Handler ─────────────────────────────────────────
  const handleOpenIncidentDetail = (incident) => {
    const fullIncident = riskData.find((r) => r.cluster_id === incident.cluster_id) || incident;
    setSelectedIncident(fullIncident);
    setCurrentView('incident-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`app-root ${theme}-theme`}>
      {/* 1. Minimal Top Navigation Bar */}
      <Navbar
        currentView={currentView === 'incident-detail' ? 'incidents' : currentView}
        setCurrentView={setCurrentView}
        isOnline={isOnline}
        isRefreshing={isRefreshing}
      />

      {/* Stale-cache non-blocking warning (never kills the UI) */}
      {errorMessage && (
        <div className="error-banner">
          <div className="error-content">
            <WifiOff size={16} />
            <span>{errorMessage}</span>
          </div>
          <button className="btn-retry" onClick={() => { setErrorMessage(null); loadDashboardData(true); }}>
            <RefreshCw size={12} className={isRefreshing ? 'spin-anim' : ''} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Initial Loading Screen (first load only — never shown on refresh) */}
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
              isOnline={isOnline}
              onOpenIncidentDetail={handleOpenIncidentDetail}
              onNavigateToGIS={() => { setCurrentView('gis'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onNavigateToIncidents={() => { setCurrentView('incidents'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onNavigateToHistorical={() => { setCurrentView('historical'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onNavigateToML={() => { setCurrentView('ml'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onNavigateToMethodology={() => { setCurrentView('methodology'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onNavigateToTimeline={() => { setCurrentView('timeline'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
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
              onBack={() => { setCurrentView('incidents'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
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
          {currentView === 'historical' && <HistoricalDataPage />}

          {/* View 5: Machine Learning Architecture */}
          {currentView === 'ml' && <MachineLearningPage />}

          {/* View 5b: Ground Truth Review System */}
          {currentView === 'ground-truth' && <GroundTruthReviewPage />}

          {/* View 6: Detection Timeline */}
          {currentView === 'timeline' && (
            <DetectionTimelinePage
              riskData={riskData}
              observations={observations}
            />
          )}

          {/* View 7: Methodology & Scientific Disclosures */}
          {currentView === 'methodology' && <MethodologyPage />}
        </main>
      )}

      {/* Minimal Footer */}
      <Footer />
    </div>
  );
};

export const App = () => (
  <ThemeProvider>
    <RegionProvider>
      <AppContent />
    </RegionProvider>
  </ThemeProvider>
);

export default App;
