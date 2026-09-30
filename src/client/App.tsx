import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Radio,
  MapPin,
  Sliders,
  FileText,
  ShieldCheck,
  Database,
  GitMerge,
  Building2,
  DollarSign,
} from 'lucide-react';
import { Header } from './components/Header.js';
import { FilterBar } from './components/FilterBar.js';
import { DashboardView } from './views/DashboardView.js';
import { CitizenSignalsView } from './views/CitizenSignalsView.js';
import { RiskRadarView } from './views/RiskRadarView.js';
import { InfrastructureView } from './views/InfrastructureView.js';
import { InvestmentsView } from './views/InvestmentsView.js';
import { RecommendationsView } from './views/RecommendationsView.js';
import { PriorityEngineView } from './views/PriorityEngineView.js';
import { EvidenceGraphView } from './views/EvidenceGraphView.js';
import { AuditView } from './views/AuditView.js';
import { DataSourcesView } from './views/DataSourcesView.js';
import {
  fetchHealth,
  fetchHotspots,
  fetchCitizenRequests,
  fetchAssets,
  fetchRecommendations,
  fetchAuditLogs,
  fetchHumanReviews,
  fetchDataSources,
  resetDemoDataset,
} from './services/api.js';

import { ErrorBoundary } from './components/ErrorBoundary.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);

  const [health, setHealth] = useState<any>(null);
  const [hotspots, setHotspots] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [humanReviews, setHumanReviews] = useState<any[]>([]);
  const [dataSources, setDataSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const loadData = async () => {
    try {
      const [
        healthRes,
        hotspotsRes,
        requestsRes,
        assetsRes,
        recsRes,
        logsRes,
        reviewsRes,
        dsRes,
      ] = await Promise.all([
        fetchHealth(),
        fetchHotspots({ stateCode: selectedState, category: selectedCategory }),
        fetchCitizenRequests({ category: selectedCategory }),
        fetchAssets({ stateCode: selectedState }),
        fetchRecommendations(),
        fetchAuditLogs(),
        fetchHumanReviews(),
        fetchDataSources(),
      ]);

      setHealth(healthRes);
      if (hotspotsRes.success) setHotspots(hotspotsRes.data);
      if (requestsRes.success) setRequests(requestsRes.data);
      if (assetsRes.success) setAssets(assetsRes.data);
      if (recsRes.success) setRecommendations(recsRes.data);
      if (logsRes.success) setAuditLogs(logsRes.data);
      if (reviewsRes.success) setHumanReviews(reviewsRes.data);
      if (dsRes.success) setDataSources(dsRes.data);
    } catch (err) {
      console.error('Error fetching CivicTwin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedState, selectedCategory]);

  const handleResetDemo = async () => {
    if (!confirm('Reset CivicTwin AI to official deterministic baseline dataset?')) return;
    setResetting(true);
    try {
      await resetDemoDataset();
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setResetting(false);
    }
  };

  return (
    <ErrorBoundary>
      <div>
        <Header health={health} onResetDemo={handleResetDemo} resetting={resetting} />

        <FilterBar
          selectedState={selectedState}
          onSelectState={setSelectedState}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Screen Reader Status Notification */}
        <div className="sr-only" role="status" aria-live="polite">
          Active module: {activeTab}. Hotspots: {hotspots.length}. Citizen signals: {requests.length}.
        </div>

        {/* Primary Navigation Tabs */}
        <nav className="gov-nav" role="tablist" aria-label="CivicTwin Intelligence Modules">
          <button
            id="tab-overview"
            role="tab"
            aria-selected={activeTab === 'overview'}
            aria-controls="main-content"
            className={`gov-nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <LayoutDashboard size={15} aria-hidden="true" />
            Overview
          </button>

          <button
            id="tab-signals"
            role="tab"
            aria-selected={activeTab === 'signals'}
            aria-controls="main-content"
            className={`gov-nav-tab ${activeTab === 'signals' ? 'active' : ''}`}
            onClick={() => setActiveTab('signals')}
          >
            <Radio size={15} aria-hidden="true" />
            Citizen Signals ({requests.length})
          </button>

          <button
            id="tab-radar"
            role="tab"
            aria-selected={activeTab === 'radar'}
            aria-controls="main-content"
            className={`gov-nav-tab ${activeTab === 'radar' ? 'active' : ''}`}
            onClick={() => setActiveTab('radar')}
          >
            <MapPin size={15} aria-hidden="true" />
            Risk Radar ({hotspots.length})
          </button>

          <button
            id="tab-infrastructure"
            role="tab"
            aria-selected={activeTab === 'infrastructure'}
            aria-controls="main-content"
            className={`gov-nav-tab ${activeTab === 'infrastructure' ? 'active' : ''}`}
            onClick={() => setActiveTab('infrastructure')}
          >
            <Building2 size={15} aria-hidden="true" />
            Infrastructure ({assets.length})
          </button>

          <button
            id="tab-investments"
            role="tab"
            aria-selected={activeTab === 'investments'}
            aria-controls="main-content"
            className={`gov-nav-tab ${activeTab === 'investments' ? 'active' : ''}`}
            onClick={() => setActiveTab('investments')}
          >
            <DollarSign size={15} aria-hidden="true" />
            Investments
          </button>

          <button
            id="tab-recommendations"
            role="tab"
            aria-selected={activeTab === 'recommendations'}
            aria-controls="main-content"
            className={`gov-nav-tab ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            <FileText size={15} aria-hidden="true" />
            Recommendations ({recommendations.length})
          </button>

          <button
            id="tab-priority"
            role="tab"
            aria-selected={activeTab === 'priority'}
            aria-controls="main-content"
            className={`gov-nav-tab ${activeTab === 'priority' ? 'active' : ''}`}
            onClick={() => setActiveTab('priority')}
          >
            <Sliders size={15} aria-hidden="true" />
            Priority & What-If
          </button>

          <button
            id="tab-graph"
            role="tab"
            aria-selected={activeTab === 'graph'}
            aria-controls="main-content"
            className={`gov-nav-tab ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            <GitMerge size={15} aria-hidden="true" />
            Evidence Graph
          </button>

          <button
            id="tab-data-sources"
            role="tab"
            aria-selected={activeTab === 'data-sources'}
            aria-controls="main-content"
            className={`gov-nav-tab ${activeTab === 'data-sources' ? 'active' : ''}`}
            onClick={() => setActiveTab('data-sources')}
          >
            <Database size={15} aria-hidden="true" />
            Data Sources ({dataSources.length})
          </button>

          <button
            id="tab-audit"
            role="tab"
            aria-selected={activeTab === 'audit'}
            aria-controls="main-content"
            className={`gov-nav-tab ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <ShieldCheck size={15} aria-hidden="true" />
            AI Audit ({auditLogs.length})
          </button>
        </nav>

        {/* Main View Area with Accessibility Landmark */}
        <main id="main-content" tabIndex={-1} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
          {loading ? (
            <div className="gov-container" role="status" aria-live="polite" style={{ textAlign: 'center', padding: '60px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                Loading CivicTwin AI Decision Intelligence Platform...
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <DashboardView
                  hotspots={hotspots}
                  requests={requests}
                  assets={assets}
                  onSelectHotspot={(id) => {
                    setSelectedHotspotId(id);
                    setActiveTab('radar');
                  }}
                  onNavigate={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'signals' && (
                <CitizenSignalsView requests={requests} onRefresh={loadData} />
              )}

              {activeTab === 'radar' && (
                <RiskRadarView
                  hotspots={hotspots}
                  assets={assets}
                  selectedHotspotId={selectedHotspotId}
                  onSelectHotspot={setSelectedHotspotId}
                  onNavigate={(tab) => setActiveTab(tab)}
                  onRefresh={loadData}
                />
              )}

              {activeTab === 'infrastructure' && (
                <InfrastructureView onNavigate={(tab) => setActiveTab(tab)} />
              )}

              {activeTab === 'investments' && (
                <InvestmentsView onNavigate={(tab) => setActiveTab(tab)} />
              )}

              {activeTab === 'recommendations' && (
                <RecommendationsView
                  recommendations={recommendations}
                  hotspots={hotspots}
                  onRefresh={loadData}
                  onNavigate={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'priority' && (
                <PriorityEngineView
                  hotspots={hotspots}
                  selectedHotspotId={selectedHotspotId}
                  onRefresh={loadData}
                />
              )}

              {activeTab === 'graph' && <EvidenceGraphView hotspots={hotspots} />}

              {activeTab === 'audit' && (
                <AuditView
                  auditLogs={auditLogs}
                  humanReviews={humanReviews}
                  hotspots={hotspots}
                  onRefresh={loadData}
                />
              )}

              {activeTab === 'data-sources' && <DataSourcesView dataSources={dataSources} />}
            </>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
};
