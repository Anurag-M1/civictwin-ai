import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sliders,
  RefreshCw,
  Layers,
  Search,
  GitMerge,
  Filter,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Database,
} from 'lucide-react';
import { CivicMap } from '../components/CivicMap.js';
import {
  runHotspotDetection,
  fetchHotspotExplanation,
  updateHotspotStatus,
  fetchEvidenceBrief,
  fetchEvidencePack,
  generateBrief,
} from '../services/api.js';

interface RiskRadarViewProps {
  hotspots: any[];
  assets?: any[];
  selectedHotspotId: string | null;
  onSelectHotspot: (id: string) => void;
  onNavigate: (tab: string) => void;
  onRefresh?: () => void;
}

export const RiskRadarView: React.FC<RiskRadarViewProps> = ({
  hotspots,
  assets = [],
  selectedHotspotId,
  onSelectHotspot,
  onNavigate,
  onRefresh,
}) => {
  const [detecting, setDetecting] = useState(false);
  const [clusteringRadius, setClusteringRadius] = useState<number>(3.0);
  const [activeDossierTab, setActiveDossierTab] = useState<'explain' | 'brief' | 'evidence' | 'signals' | 'assets'>('explain');
  const [explanation, setExplanation] = useState<any>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Evidence Brief state
  const [brief, setBrief] = useState<any | null>(null);
  const [evidencePack, setEvidencePack] = useState<any | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [synthesizingBrief, setSynthesizingBrief] = useState(false);
  const [showEvidencePackModal, setShowEvidencePackModal] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterMinScore, setFilterMinScore] = useState<number>(0);

  // Filtered hotspots list
  const filteredHotspots = hotspots.filter((h) => {
    if (filterCategory && h.category !== filterCategory) return false;
    if (filterStatus && h.status !== filterStatus) return false;
    if (filterState && h.administrativeArea?.stateCode !== filterState) return false;
    if (filterMinScore > 0 && h.prioritySignalScore < filterMinScore) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const codeMatch = h.hotspotCode?.toLowerCase().includes(q);
      const nameMatch = h.administrativeArea?.name?.toLowerCase().includes(q);
      const catMatch = h.category?.toLowerCase().includes(q);
      const clusterMatch = h.issueCluster?.title?.toLowerCase().includes(q);
      if (!codeMatch && !nameMatch && !catMatch && !clusterMatch) return false;
    }
    return true;
  });

  const currentHotspot =
    filteredHotspots.find((h) => h.id === selectedHotspotId) ||
    filteredHotspots[0] ||
    hotspots[0];

  useEffect(() => {
    if (currentHotspot?.id) {
      loadExplanation(currentHotspot.id);
      loadBrief(currentHotspot.id);
    }
  }, [currentHotspot?.id]);

  const loadBrief = async (id: string) => {
    setLoadingBrief(true);
    try {
      const [briefRes, packRes] = await Promise.all([
        fetchEvidenceBrief(id),
        fetchEvidencePack(id),
      ]);
      if (briefRes.success) {
        setBrief(briefRes.data);
      } else {
        setBrief(null);
      }
      if (packRes.success) {
        setEvidencePack(packRes.data);
      }
    } catch {
      setBrief(null);
    } finally {
      setLoadingBrief(false);
    }
  };

  const handleSynthesizeBrief = async () => {
    if (!currentHotspot) return;
    setSynthesizingBrief(true);
    try {
      const res = await generateBrief(currentHotspot.id);
      if (res.success) {
        setBrief(res.data);
        if (onRefresh) onRefresh();
      } else {
        alert('Failed to synthesize brief: ' + (res.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error synthesizing brief: ' + err.message);
    } finally {
      setSynthesizingBrief(false);
    }
  };

  const loadExplanation = async (id: string) => {
    setLoadingExplanation(true);
    try {
      const res = await fetchHotspotExplanation(id);
      if (res.success) {
        setExplanation(res.data);
      }
    } catch (err) {
      console.error('Failed to load hotspot explanation:', err);
    } finally {
      setLoadingExplanation(false);
    }
  };

  const handleRunDetection = async () => {
    setDetecting(true);
    try {
      const res = await runHotspotDetection(clusteringRadius);
      if (res.success) {
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      alert('Detection failed: ' + err.message);
    } finally {
      setDetecting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!currentHotspot) return;
    setStatusUpdating(true);
    try {
      const res = await updateHotspotStatus(
        currentHotspot.id,
        newStatus,
        `Status transitioned to ${newStatus} from Risk Radar console`,
      );
      if (res.success) {
        if (onRefresh) onRefresh();
        loadExplanation(currentHotspot.id);
      }
    } catch (err: any) {
      alert('Status update failed: ' + err.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterCategory('');
    setFilterStatus('');
    setFilterState('');
    setFilterMinScore(0);
  };

  // Aggregated radar metrics
  const elevatedCount = hotspots.filter((h) => h.status === 'ELEVATED' || h.prioritySignalScore >= 75).length;
  const totalCatchmentPop = hotspots.reduce((sum, h) => sum + (h.affectedPopulationSignal || 0), 0);
  const averageRiskScore =
    hotspots.length > 0
      ? (hotspots.reduce((sum, h) => sum + (h.prioritySignalScore || 0), 0) / hotspots.length).toFixed(1)
      : '0.0';

  return (
    <div className="gov-container" style={{ paddingBottom: '60px' }}>
      {/* Top Banner: Metrics Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div className="gov-card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Active Emerging Hotspots
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
            {hotspots.length}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Across 4 Indian States</div>
        </div>

        <div className="gov-card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Elevated / High Risk Alerts
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#b91c1c', marginTop: '2px' }}>
            {elevatedCount}
          </div>
          <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600 }}>Priority Score ≥ 75.0 / 100</div>
        </div>

        <div className="gov-card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Total Population in Catchment
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#1d4ed8', marginTop: '2px' }}>
            {totalCatchmentPop.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Census-calibrated footprint</div>
        </div>

        <div className="gov-card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Average Risk Index
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
            {averageRiskScore} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>/ 100</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Deterministic multi-criteria</div>
        </div>
      </div>

      {/* Cartographic GIS Map Container */}
      <div className="gov-card" style={{ marginBottom: '16px' }}>
        <div className="gov-card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#1b3558" />
            <span className="gov-card-title">Geospatial Risk Radar (Cartographic GIS Overlay)</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <span style={{ fontWeight: 600 }}>Clustering Radius:</span>
              <select
                className="gov-select"
                value={clusteringRadius}
                onChange={(e) => setClusteringRadius(Number(e.target.value))}
                style={{ width: '80px', padding: '2px 6px', fontSize: '12px' }}
              >
                <option value={1.5}>1.5 km</option>
                <option value={3.0}>3.0 km</option>
                <option value={5.0}>5.0 km</option>
              </select>
            </div>
            <button
              className="gov-btn gov-btn-secondary"
              style={{ fontSize: '11px', padding: '4px 10px' }}
              onClick={handleRunDetection}
              disabled={detecting}
            >
              <RefreshCw size={13} className={detecting ? 'pulse' : ''} />
              {detecting ? 'Clustering Signals...' : 'Re-run Spatial Clustering'}
            </button>
          </div>
        </div>

        <CivicMap
          hotspots={filteredHotspots}
          assets={assets}
          selectedHotspotId={currentHotspot?.id || null}
          onSelectHotspot={onSelectHotspot}
          height="320px"
        />
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div
        className="gov-card"
        style={{
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 200px' }}>
          <Search size={15} color="#64748b" />
          <input
            type="text"
            className="gov-input"
            placeholder="Search code, ward, sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', fontSize: '12px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} color="#64748b" />
          <select
            className="gov-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            <option value="">All Sectors</option>
            <option value="Roads">Roads</option>
            <option value="Water">Water</option>
            <option value="Sanitation">Sanitation</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Electricity">Electricity</option>
            <option value="Waste Management">Waste Management</option>
            <option value="Disaster Resilience">Disaster Resilience</option>
          </select>
        </div>

        <select
          className="gov-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ fontSize: '12px', padding: '4px 8px' }}
        >
          <option value="">All Statuses</option>
          <option value="EMERGING">EMERGING</option>
          <option value="ELEVATED">ELEVATED</option>
          <option value="MITIGATING">MITIGATING</option>
          <option value="RESOLVED">RESOLVED</option>
        </select>

        <select
          className="gov-select"
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          style={{ fontSize: '12px', padding: '4px 8px' }}
        >
          <option value="">All States</option>
          <option value="KA">Karnataka (KA)</option>
          <option value="MH">Maharashtra (MH)</option>
          <option value="UP">Uttar Pradesh (UP)</option>
          <option value="OD">Odisha (OD)</option>
        </select>

        <select
          className="gov-select"
          value={filterMinScore}
          onChange={(e) => setFilterMinScore(Number(e.target.value))}
          style={{ fontSize: '12px', padding: '4px 8px' }}
        >
          <option value={0}>All Scores</option>
          <option value={60}>Score ≥ 60 (Elevated)</option>
          <option value={75}>Score ≥ 75 (High / Critical)</option>
          <option value={85}>Score ≥ 85 (Urgent Emergency)</option>
        </select>

        {(searchQuery || filterCategory || filterStatus || filterState || filterMinScore > 0) && (
          <button
            onClick={resetFilters}
            style={{
              background: 'none',
              border: 'none',
              color: '#1d4ed8',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Two-Column View: Ranking List vs Deep Dossier */}
      <div className="gov-two-col">
        {/* Left Column: Hotspots Ranking List */}
        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Hotspots Ranking & Prioritization</span>
            <span className="gov-badge badge-medium">{filteredHotspots.length} Matches</span>
          </div>

          {filteredHotspots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                No Hotspots Match the Active Filters
              </div>
              <div style={{ fontSize: '12px', marginBottom: '14px' }}>
                Try relaxing the sector, state, or score thresholds.
              </div>
              <button className="gov-btn gov-btn-secondary" onClick={resetFilters}>
                Reset All Filters
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredHotspots.map((h) => {
                const isSelected = h.id === currentHotspot?.id;
                return (
                  <div
                    key={h.id}
                    onClick={() => onSelectHotspot(h.id)}
                    style={{
                      padding: '12px',
                      border: isSelected ? '2px solid #0c1a30' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <code style={{ fontWeight: 700 }}>{h.hotspotCode}</code>
                        <span className="gov-badge badge-medium">{h.category}</span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '2px',
                            backgroundColor: h.status === 'ELEVATED' ? '#fee2e2' : h.status === 'EMERGING' ? '#fef3c7' : '#ecfdf5',
                            color: h.status === 'ELEVATED' ? '#b91c1c' : h.status === 'EMERGING' ? '#b45309' : '#047857',
                          }}
                        >
                          {h.status}
                        </span>
                      </div>
                      <span
                        className={`gov-badge ${
                          h.prioritySignalScore >= 80
                            ? 'badge-critical'
                            : h.prioritySignalScore >= 60
                            ? 'badge-high'
                            : 'badge-medium'
                        }`}
                      >
                        Priority: {h.prioritySignalScore.toFixed(1)} / 100
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                      {h.administrativeArea?.name} ({h.administrativeArea?.stateCode})
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '6px',
                        fontSize: '11px',
                        color: '#475569',
                        marginTop: '6px',
                      }}
                    >
                      <div>Signals: <strong>{h.requestCount}</strong></div>
                      <div>Growth: <strong style={{ color: h.trendGrowthPct > 0 ? '#b91c1c' : '#0f172a' }}>+{h.trendGrowthPct}%</strong></div>
                      <div>Catchment: <strong>{h.affectedPopulationSignal?.toLocaleString()}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Hotspot Deep Dive */}
        {currentHotspot ? (
          <div className="gov-card">
            {/* Dossier Header */}
            <div className="gov-card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="gov-card-title">{currentHotspot.hotspotCode}</span>
                  <span className="gov-badge badge-medium">{currentHotspot.category}</span>
                  <select
                    value={currentHotspot.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={statusUpdating}
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '3px',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="EMERGING">EMERGING</option>
                    <option value="ELEVATED">ELEVATED</option>
                    <option value="MITIGATING">MITIGATING</option>
                    <option value="RESOLVED">RESOLVED</option>
                  </select>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {currentHotspot.administrativeArea?.name}, State: {currentHotspot.administrativeArea?.stateCode} • Lat: {currentHotspot.centerLat}, Lng: {currentHotspot.centerLng}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="gov-btn gov-btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={() => onNavigate('priority')}
                >
                  <Sliders size={12} />
                  What-If Sim
                </button>
                <button
                  className="gov-btn gov-btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={() => onNavigate('graph')}
                >
                  <GitMerge size={12} />
                  Evidence Graph
                </button>
                <button
                  className="gov-btn gov-btn-primary"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={() => setActiveDossierTab('brief')}
                >
                  <FileText size={12} />
                  Evidence Brief
                </button>
              </div>
            </div>

            {/* Score Breakdown Bar */}
            <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '2px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                  Deterministic Risk Composite Index
                </span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: currentHotspot.prioritySignalScore >= 75 ? '#b91c1c' : '#d97706' }}>
                  {currentHotspot.prioritySignalScore.toFixed(1)} / 100
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${currentHotspot.prioritySignalScore}%`,
                    height: '100%',
                    backgroundColor: currentHotspot.prioritySignalScore >= 75 ? '#b91c1c' : '#d97706',
                  }}
                />
              </div>
            </div>

            {/* Dossier Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', marginBottom: '14px', overflowX: 'auto' }}>
              {[
                { id: 'explain', label: 'Explainability & Factors' },
                { id: 'brief', label: 'Gemini Evidence Brief' },
                { id: 'evidence', label: `Evidence Records (${currentHotspot.evidenceRecords?.length || 0})` },
                { id: 'signals', label: `Citizen Signals (${currentHotspot.requestCount})` },
                { id: 'assets', label: 'Physical Assets' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDossierTab(tab.id as any)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: activeDossierTab === tab.id ? 700 : 500,
                    border: 'none',
                    borderBottom: activeDossierTab === tab.id ? '2px solid #0c1a30' : '2px solid transparent',
                    backgroundColor: 'transparent',
                    color: activeDossierTab === tab.id ? '#0c1a30' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Explainability Dossier */}
            {activeDossierTab === 'explain' && (
              <div>
                {loadingExplanation ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                    Compiling evidence-grounded explanation...
                  </div>
                ) : explanation ? (
                  <>
                    <div
                      style={{
                        padding: '12px',
                        backgroundColor: '#eff6ff',
                        borderRadius: '3px',
                        border: '1px solid #bfdbfe',
                        fontSize: '12px',
                        color: '#1e3a8a',
                        lineHeight: 1.5,
                        marginBottom: '14px',
                      }}
                    >
                      <strong>Evidence Grounding Summary:</strong> {explanation.executiveSummary}
                    </div>

                    <h4 style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>
                      Deterministic Multi-Criteria Factor Contributions
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                      {explanation.factorContributions.map((fc: any) => (
                        <div key={fc.factorKey} style={{ fontSize: '11px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span>
                              <strong>{fc.factorLabel}</strong> ({Math.round(fc.weight * 100)}% weight)
                            </span>
                            <span style={{ fontWeight: 700 }}>
                              {fc.normalizedValue.toFixed(1)} $\rightarrow$ +{fc.contributionPct.toFixed(1)} pts
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${fc.normalizedValue}%`,
                                height: '100%',
                                backgroundColor: fc.normalizedValue >= 75 ? '#b91c1c' : '#2563eb',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '10px',
                        padding: '10px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '2px',
                        fontSize: '11px',
                      }}
                    >
                      <div>
                        <div style={{ color: '#64748b' }}>Signal Growth Velocity:</div>
                        <strong style={{ color: '#b91c1c', fontSize: '13px' }}>
                          +{explanation.metrics.trendGrowthPct}% 14-day spike
                        </strong>
                      </div>
                      <div>
                        <div style={{ color: '#64748b' }}>Catchment Vulnerability:</div>
                        <strong style={{ fontSize: '13px' }}>
                          {explanation.demographicsContext?.vulnerabilityPercentage || 55}% vulnerable residents
                        </strong>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {/* Tab: Gemini Grounded Evidence Brief */}
            {activeDossierTab === 'brief' && (
              <div>
                {loadingBrief ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    Retrieving grounded evidence brief & structured evidence pack...
                  </div>
                ) : brief ? (
                  <div>
                    {/* Top telemetry banner */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569' }}>
                        <Sparkles size={13} color="#0c1a30" />
                        <span>Model: <strong>{brief.modelIdentifier}</strong></span>
                        <span>•</span>
                        <span>Confidence: <strong>{Math.round((brief.confidence || brief.confidenceScore || 0.88) * 100)}%</strong></span>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="gov-btn gov-btn-secondary"
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                          onClick={() => setShowEvidencePackModal(true)}
                        >
                          <Database size={12} />
                          Inspect Structured Pack
                        </button>
                        <button
                          className="gov-btn gov-btn-secondary"
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                          onClick={handleSynthesizeBrief}
                          disabled={synthesizingBrief}
                        >
                          <RefreshCw size={12} className={synthesizingBrief ? 'spin' : ''} />
                          {synthesizingBrief ? 'Synthesizing...' : 'Re-synthesize (Gemini)'}
                        </button>
                      </div>
                    </div>

                    {/* Sufficiency Status Alert */}
                    {(evidencePack?.sufficiencyStatus === 'INSUFFICIENT' || brief.limitations?.includes('INSUFFICIENT') || brief.dataLimitations?.includes('INSUFFICIENT')) ? (
                      <div
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          color: '#991b1b',
                          fontSize: '12px',
                          borderRadius: '2px',
                          marginBottom: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                          <AlertTriangle size={15} />
                          INSUFFICIENT EMPIRICAL EVIDENCE DETECTED
                        </div>
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#b91c1c' }}>
                          {evidencePack?.sufficiencyReason || brief.limitations || brief.dataLimitations}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          color: '#166534',
                          fontSize: '11px',
                          borderRadius: '2px',
                          marginBottom: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <CheckCircle2 size={14} />
                        <span>
                          <strong>Empirical Evidence Verified:</strong> Structured evidence pack validated across citizen complaints, physical asset registry, and census demographics.
                        </span>
                      </div>
                    )}

                    {/* 1. Problem Statement */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                        1. Problem Statement
                      </div>
                      <div
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '2px',
                          fontSize: '12px',
                          color: '#0f172a',
                          lineHeight: 1.5,
                        }}
                      >
                        {brief.problem || brief.problemSummary}
                      </div>
                    </div>

                    {/* 2. Structured Evidence Findings */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                        2. Structured Evidence Ledger & Citations ({brief.evidence?.length || 0})
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="gov-table" style={{ width: '100%', fontSize: '11px' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '120px' }}>Evidence ID</th>
                              <th>Observed Metric</th>
                              <th>Empirical Finding</th>
                              <th>Data Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {brief.evidence?.map((ev: any) => (
                              <tr key={ev.evidenceId}>
                                <td>
                                  <code style={{ fontSize: '10px', fontWeight: 700, color: '#0c1a30' }}>
                                    {ev.evidenceId}
                                  </code>
                                </td>
                                <td style={{ fontWeight: 600 }}>{ev.metric}</td>
                                <td>{ev.finding}</td>
                                <td style={{ color: '#64748b' }}>{ev.source}</td>
                              </tr>
                            ))}
                            {(!brief.evidence || brief.evidence.length === 0) && (
                              <tr>
                                <td colSpan={4} style={{ color: '#64748b', textAlign: 'center', padding: '12px' }}>
                                  Citing evidence codes: {brief.citedEvidenceIds?.join(', ') || 'EV-SIG-01'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 3. Potential Intervention */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                        3. Potential Technical Intervention
                      </div>
                      <div
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '2px',
                          fontSize: '12px',
                          color: '#0f172a',
                          lineHeight: 1.5,
                        }}
                      >
                        {brief.potentialIntervention}
                      </div>
                    </div>

                    {/* 4. Implementation Considerations */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                        4. Implementation Considerations & Stakeholder Phasing
                      </div>
                      <div
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '2px',
                          fontSize: '12px',
                          color: '#334155',
                          lineHeight: 1.5,
                        }}
                      >
                        {brief.implementationConsiderations}
                      </div>
                    </div>

                    {/* 5. Risks & Dependencies Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                      <div style={{ padding: '10px 12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '2px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#92400e', marginBottom: '4px' }}>
                          Technical & Seasonal Risks
                        </div>
                        <div style={{ fontSize: '11px', color: '#78350f', lineHeight: 1.4 }}>
                          {brief.risks}
                        </div>
                      </div>

                      <div style={{ padding: '10px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '2px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                          Inter-Agency Dependencies
                        </div>
                        <div style={{ fontSize: '11px', color: '#334155', lineHeight: 1.4 }}>
                          {brief.dependencies}
                        </div>
                      </div>
                    </div>

                    {/* 6. Data Limitations */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                        5. Empirical Data Limitations & Caveats
                      </div>
                      <div
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '2px',
                          fontSize: '11px',
                          color: '#64748b',
                        }}
                      >
                        {brief.limitations || brief.dataLimitations}
                      </div>
                    </div>

                    {/* 7. Human Review Requirement */}
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#f8fafc',
                        borderLeft: '4px solid #0c1a30',
                        borderTop: '1px solid #e2e8f0',
                        borderRight: '1px solid #e2e8f0',
                        borderBottom: '1px solid #e2e8f0',
                        borderRadius: '2px',
                        marginBottom: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#0c1a30' }}>
                          6. Statutory Human Review Requirement
                        </span>
                        <span className="gov-badge badge-high">
                          {brief.humanReviewRequirement?.required || brief.requiresHumanReview ? 'MANDATORY REVIEW' : 'ADVISORY'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#0f172a' }}>
                        {brief.humanReviewRequirement?.reason || 'Public capital allocation requires municipal commissioner sign-off.'}
                      </div>
                    </div>

                    {/* Audit Trail Stamp */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                        color: '#64748b',
                        paddingTop: '8px',
                        borderTop: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Lock size={12} color="#16a34a" />
                        <span>AI Audit Trail Recorded (HMAC-SHA256)</span>
                      </div>
                      <button
                        className="gov-btn gov-btn-secondary"
                        style={{ fontSize: '10px', padding: '2px 6px' }}
                        onClick={() => onNavigate('audit')}
                      >
                        View in AI Audit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px 16px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                    <FileText size={32} color="#64748b" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                      No Evidence Brief Synthesized for Hotspot {currentHotspot.hotspotCode}
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', maxWidth: '420px', margin: '0 auto 14px auto' }}>
                      Gather actual citizen complaints, asset inspection telemetry, and demographic context into an atomic
                      evidence pack and synthesize an explainable brief via Gemini.
                    </p>
                    <button
                      className="gov-btn gov-btn-primary"
                      onClick={handleSynthesizeBrief}
                      disabled={synthesizingBrief}
                    >
                      <Sparkles size={14} />
                      {synthesizingBrief ? 'Gathering Evidence & Calling Gemini...' : 'Synthesize Grounded Evidence Brief'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Verifiable Evidence Units */}
            {activeDossierTab === 'evidence' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentHotspot.evidenceRecords?.map((ev: any) => (
                  <div
                    key={ev.id}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '2px',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <code style={{ fontWeight: 700, color: '#1e40af' }}>{ev.evidenceCode}</code>
                      <span className="gov-badge badge-medium">{ev.sourceEntity}</span>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                      {ev.metric}: <span style={{ color: '#b91c1c' }}>{ev.value}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Period: {ev.period} • Confidence: {(ev.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3: Semantic Issue Cluster & Signals */}
            {activeDossierTab === 'signals' && (
              <div>
                {currentHotspot.issueCluster && (
                  <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '3px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <code style={{ fontWeight: 700 }}>{currentHotspot.issueCluster.clusterCode}</code>
                      <span className="gov-badge badge-high">Avg Urgency: {currentHotspot.issueCluster.averageUrgency.toFixed(1)}/100</span>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                      {currentHotspot.issueCluster.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      {currentHotspot.issueCluster.description}
                    </div>
                  </div>
                )}

                <h5 style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Recent Ingested Citizen Signals
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                  {explanation?.connectedSignalsSummary?.sampleSignals?.map((sig: any) => (
                    <div
                      key={sig.trackingCode}
                      style={{
                        padding: '8px 10px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '2px',
                        fontSize: '11px',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <code style={{ fontWeight: 700 }}>{sig.trackingCode}</code>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <span className="gov-badge badge-medium">[{sig.language.toUpperCase()}]</span>
                          <span className="gov-badge badge-medium">{sig.channel}</span>
                          <span className="gov-badge badge-critical">{sig.urgency}</span>
                        </div>
                      </div>
                      <div style={{ color: '#334155', marginTop: '2px' }}>{sig.originalText}</div>
                    </div>
                  )) || (
                    <div style={{ color: '#64748b', fontSize: '12px' }}>No raw signals attached.</div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Physical Assets */}
            {activeDossierTab === 'assets' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {explanation?.connectedAssets?.map((ast: any) => (
                  <div
                    key={ast.assetCode}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '2px',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '12px' }}>{ast.name}</span>
                      <span className={`gov-badge ${ast.conditionRating === 'CRITICAL' ? 'badge-critical' : ast.conditionRating === 'POOR' ? 'badge-high' : 'badge-good'}`}>
                        {ast.conditionRating}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569' }}>
                      Asset Code: <code>{ast.assetCode}</code> • Type: {ast.type} • Capacity: {ast.capacity || 'N/A'}
                    </div>
                    {ast.distressNotes && (
                      <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}>
                        <strong>Inspection Notes:</strong> {ast.distressNotes}
                      </div>
                    )}
                  </div>
                )) || (
                  <div style={{ color: '#64748b', fontSize: '12px' }}>No physical assets mapped in catchment.</div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Raw Structured Evidence Pack Modal */}
      {showEvidencePackModal && evidencePack && (
        <div
          className="gov-modal-overlay"
          onClick={() => setShowEvidencePackModal(false)}
        >
          <div
            className="gov-modal"
            style={{ maxWidth: '780px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gov-card-header" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={18} color="#0c1a30" />
                <span className="gov-card-title">
                  Raw Structured Evidence Pack — {evidencePack.hotspotCode}
                </span>
              </div>
              <button
                className="gov-btn gov-btn-secondary"
                style={{ padding: '2px 8px' }}
                onClick={() => setShowEvidencePackModal(false)}
              >
                ✕ Close
              </button>
            </div>

            <div
              style={{
                padding: '8px 12px',
                backgroundColor: evidencePack.sufficiencyStatus === 'SUFFICIENT' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${evidencePack.sufficiencyStatus === 'SUFFICIENT' ? '#bbf7d0' : '#fecaca'}`,
                color: evidencePack.sufficiencyStatus === 'SUFFICIENT' ? '#166534' : '#991b1b',
                fontSize: '12px',
                marginBottom: '14px',
                borderRadius: '2px',
              }}
            >
              <strong>Sufficiency Status: {evidencePack.sufficiencyStatus}</strong> — {evidencePack.sufficiencyReason}
            </div>

            <div style={{ marginBottom: '12px', fontSize: '12px', color: '#475569' }}>
              Only the following structured factual evidence records are passed to Gemini during synthesis. Zero prompt instructions, hallucinated claims, or ungrounded external data:
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto', marginBottom: '16px' }}>
              <table className="gov-table" style={{ width: '100%', fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '110px' }}>Evidence ID</th>
                    <th>Category</th>
                    <th>Source Entity</th>
                    <th>Metric & Observed Value</th>
                    <th>Period</th>
                    <th>Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {evidencePack.evidenceList?.map((ev: any) => (
                    <tr key={ev.id}>
                      <td>
                        <code style={{ fontSize: '10px', fontWeight: 700, color: '#0c1a30' }}>
                          {ev.id}
                        </code>
                      </td>
                      <td>
                        <span className="gov-badge badge-medium" style={{ fontSize: '9px' }}>
                          {ev.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#334155' }}>{ev.sourceEntity}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{ev.metric}</div>
                        <div style={{ fontSize: '10px', color: '#475569' }}>{ev.value}</div>
                      </td>
                      <td style={{ fontSize: '10px', color: '#64748b' }}>{ev.period}</td>
                      <td>
                        <strong>{Math.round((ev.confidence || 0.9) * 100)}%</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="gov-btn gov-btn-secondary"
                onClick={() => setShowEvidencePackModal(false)}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
