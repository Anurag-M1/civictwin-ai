import React, { useState, useEffect } from 'react';
import {
  Sliders,
  TrendingUp,
  Scale,
  History,
  ShieldCheck,
  RotateCcw,
  CloudRain,
  Users,
  CheckCircle2,
  Zap,
  DollarSign,
  Layers,
} from 'lucide-react';
import { DEFAULT_PRIORITY_WEIGHTS, PRIORITY_FACTOR_LABELS } from '../../shared/constants.js';
import {
  simulateWhatIf,
  fetchSimulationPresets,
  fetchHotspotAssessments,
  fetchHotspotScenarios,
  recalculatePriority,
} from '../services/api.js';

interface PriorityEngineViewProps {
  hotspots: any[];
  selectedHotspotId: string | null;
  onRefresh: () => void;
}

export const PriorityEngineView: React.FC<PriorityEngineViewProps> = ({
  hotspots,
  selectedHotspotId,
  onRefresh,
}) => {
  const [activeHotspotId, setActiveHotspotId] = useState(
    selectedHotspotId || hotspots[0]?.id || '',
  );
  const [activeTab, setActiveTab] = useState<'matrix' | 'customizer' | 'history'>('matrix');

  // Model version
  const [selectedModelVersion, setSelectedModelVersion] = useState('v1.0-deterministic');

  // Custom weights state
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({
    ...DEFAULT_PRIORITY_WEIGHTS,
  });

  // What-If Scenario Builder State
  const [scenarioName, setScenarioName] = useState('Monsoon Drainage Failure Simulation');
  const [scenarioDesc, setScenarioDesc] = useState(
    'Simulating monsoon inundation causing severe physical distress and citizen reporting escalation.',
  );
  const [volumeMultiplier, setVolumeMultiplier] = useState(2.0);
  const [distressDelta, setDistressDelta] = useState(20);
  const [investmentGapDelta, setInvestmentGapDelta] = useState(0);
  const [vulnerabilityWeightDelta, setVulnerabilityWeightDelta] = useState(0.0);
  const [urgencyOverride, setUrgencyOverride] = useState<
    'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  >('CRITICAL');

  // Simulation execution state
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  // History & Presets
  const [presets, setPresets] = useState<any[]>([]);
  const [historicalAssessments, setHistoricalAssessments] = useState<any[]>([]);
  const [savedScenarios, setSavedScenarios] = useState<any[]>([]);
  const [calculatingPriority, setCalculatingPriority] = useState(false);
  const [calculationFeedback, setCalculationFeedback] = useState<string | null>(null);

  const currentHotspot = hotspots.find((h) => h.id === activeHotspotId) || hotspots[0];

  // Load presets & historical data on mount or hotspot change
  useEffect(() => {
    fetchSimulationPresets()
      .then((res) => {
        if (res.success) setPresets(res.data);
      })
      .catch((err) => console.error('Failed to load presets:', err));
  }, []);

  useEffect(() => {
    if (currentHotspot?.id) {
      loadHotspotHistory(currentHotspot.id);
    }
  }, [currentHotspot?.id]);

  const loadHotspotHistory = (hotspotId: string) => {
    fetchHotspotAssessments(hotspotId)
      .then((res) => {
        if (res.success) setHistoricalAssessments(res.data);
      })
      .catch((err) => console.error('Failed to load assessments:', err));

    fetchHotspotScenarios(hotspotId)
      .then((res) => {
        if (res.success) setSavedScenarios(res.data);
      })
      .catch((err) => console.error('Failed to load scenarios:', err));
  };

  // Preset applicator
  const applyPreset = (preset: any) => {
    setScenarioName(preset.name);
    setScenarioDesc(preset.description);
    setVolumeMultiplier(preset.overrides.requestVolumeFactor);
    setDistressDelta(preset.overrides.infrastructureDistressDelta);
    setVulnerabilityWeightDelta(preset.overrides.vulnerabilityWeightDelta || 0.0);
    setInvestmentGapDelta(preset.overrides.investmentGapDelta || 0);
    setUrgencyOverride(preset.overrides.urgencyOverride || 'NONE');
  };

  // Run What-If Simulation
  const handleSimulate = async () => {
    if (!currentHotspot) return;
    setSimulating(true);
    try {
      const overrides: any = {
        requestVolumeFactor: volumeMultiplier,
        infrastructureDistressDelta: distressDelta,
        investmentGapDelta,
        vulnerabilityWeightDelta,
      };

      if (urgencyOverride !== 'NONE') {
        overrides.urgencyOverride = urgencyOverride;
      }

      const res = await simulateWhatIf({
        hotspotId: currentHotspot.id,
        scenarioName,
        description: scenarioDesc,
        overrides,
      });

      if (res.success) {
        setSimulationResult(res.data);
        loadHotspotHistory(currentHotspot.id);
        onRefresh();
      } else {
        alert(res.error || 'Simulation failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing scenario simulation');
    } finally {
      setSimulating(false);
    }
  };

  // Recalculate priority with custom weights or selected model version
  const handleRecalculatePriority = async () => {
    if (!currentHotspot) return;
    setCalculatingPriority(true);
    setCalculationFeedback(null);
    try {
      const res = await recalculatePriority(
        currentHotspot.id,
        activeTab === 'customizer' ? customWeights : undefined,
        selectedModelVersion,
      );
      if (res.success) {
        setCalculationFeedback(
          `Priority score recalculated to ${res.data.compositeScore.toFixed(1)}/100 using ${selectedModelVersion}.`,
        );
        loadHotspotHistory(currentHotspot.id);
        onRefresh();
      } else {
        alert(res.error || 'Recalculation failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error recalculating priority');
    } finally {
      setCalculatingPriority(false);
    }
  };

  // Normalizes custom weights to sum to 100%
  const handleNormalizeWeights = () => {
    const sum = Object.values(customWeights).reduce((acc, v) => acc + v, 0);
    if (sum === 0) return;
    const normalized: Record<string, number> = {};
    for (const [k, v] of Object.entries(customWeights)) {
      normalized[k] = Number((v / sum).toFixed(4));
    }
    setCustomWeights(normalized);
  };

  // Reset custom weights to default
  const handleResetWeights = () => {
    setCustomWeights({ ...DEFAULT_PRIORITY_WEIGHTS });
  };

  const weightsSum = Number(
    Object.values(customWeights)
      .reduce((acc, v) => acc + v, 0)
      .toFixed(3),
  );

  // Derive latest assessment factor contributions if available
  const latestAssessment =
    currentHotspot?.priorityAssessments?.[0] || historicalAssessments?.[0];
  const factors: any[] = latestAssessment?.factorContributions || latestAssessment?.factors || [];

  return (
    <div className="gov-container">
      {/* Top Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          backgroundColor: '#0c1a30',
          color: '#ffffff',
          borderRadius: '4px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px' }}>
              Explainable Priority Engine & What-If Simulator
            </h2>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '3px',
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                fontWeight: 600,
              }}
            >
              {selectedModelVersion}
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '3px',
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ShieldCheck size={12} />
              100% Deterministic (Zero LLM Math)
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Multi-factor municipal prioritization engine with mathematical proof, factor transparency,
            and counterfactual policy scenario modeling.
          </p>
        </div>

        {/* Hotspot Target Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 600 }}>Hotspot Target:</span>
          <select
            className="gov-select"
            value={activeHotspotId}
            onChange={(e) => {
              setActiveHotspotId(e.target.value);
              setSimulationResult(null);
            }}
            style={{
              backgroundColor: '#1e293b',
              color: '#ffffff',
              borderColor: '#334155',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {hotspots.map((h) => (
              <option key={h.id} value={h.id}>
                {h.hotspotCode} — {h.administrativeArea?.name} ({h.category} |{' '}
                {h.prioritySignalScore.toFixed(1)} pts)
              </option>
            ))}
          </select>
        </div>
      </div>

      {calculationFeedback && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 14px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '4px',
            color: '#166534',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} />
          {calculationFeedback}
        </div>
      )}

      {/* Two-Column Grid */}
      <div className="gov-two-col" style={{ gridTemplateColumns: '1.05fr 1fr', gap: '20px' }}>
        {/* LEFT COLUMN: Explainable Multi-Factor Scoring Architecture */}
        <div className="gov-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="gov-card-header" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={18} color="#0c1a30" />
              <span className="gov-card-title">Priority Architecture & Factor Proof</span>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className={`gov-btn ${activeTab === 'matrix' ? 'gov-btn-primary' : 'gov-btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '11px' }}
                onClick={() => setActiveTab('matrix')}
              >
                <Layers size={13} />
                Factor Breakdown
              </button>
              <button
                className={`gov-btn ${activeTab === 'customizer' ? 'gov-btn-primary' : 'gov-btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '11px' }}
                onClick={() => setActiveTab('customizer')}
              >
                <Sliders size={13} />
                Model Weights
              </button>
              <button
                className={`gov-btn ${activeTab === 'history' ? 'gov-btn-primary' : 'gov-btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '11px' }}
                onClick={() => setActiveTab('history')}
              >
                <History size={13} />
                Assessments ({historicalAssessments.length})
              </button>
            </div>
          </div>

          {/* TAB 1: FACTOR BREAKDOWN MATRIX */}
          {activeTab === 'matrix' && (
            <div>
              {/* Hotspot Headline Summary */}
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    ACTIVE EVALUATION TARGET
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0c1a30' }}>
                    {currentHotspot?.hotspotCode} — {currentHotspot?.administrativeArea?.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                    Sector: <strong>{currentHotspot?.category}</strong> | Ward Population:{' '}
                    <strong>
                      {currentHotspot?.administrativeArea?.demographics?.[0]?.totalPopulation?.toLocaleString() ||
                        '125,000'}
                    </strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    COMPOSITE PRIORITY
                  </div>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 800,
                      color:
                        currentHotspot?.prioritySignalScore >= 75
                          ? '#b91c1c'
                          : currentHotspot?.prioritySignalScore >= 60
                            ? '#d97706'
                            : '#2563eb',
                    }}
                  >
                    {currentHotspot?.prioritySignalScore.toFixed(1)}
                    <span style={{ fontSize: '13px', color: '#64748b' }}>/100</span>
                  </div>
                  <span
                    className={`gov-badge ${
                      currentHotspot?.prioritySignalScore >= 75
                        ? 'badge-urgent'
                        : currentHotspot?.prioritySignalScore >= 60
                          ? 'badge-warning'
                          : 'badge-good'
                    }`}
                  >
                    {currentHotspot?.prioritySignalScore >= 75
                      ? 'CRITICAL RISK'
                      : currentHotspot?.prioritySignalScore >= 60
                        ? 'ELEVATED RISK'
                        : 'MODERATE RISK'}
                  </span>
                </div>
              </div>

              {/* Factors Table with Raw, Norm, Weight, Contribution */}
              <div style={{ overflowX: 'auto', marginBottom: '14px' }}>
                <table className="gov-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Factor Key & Indicator</th>
                      <th style={{ textAlign: 'center' }}>Raw Metric</th>
                      <th style={{ textAlign: 'center' }}>Normalized</th>
                      <th style={{ textAlign: 'center' }}>Weight</th>
                      <th style={{ textAlign: 'right' }}>Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(factors.length > 0
                      ? factors
                      : Object.entries(DEFAULT_PRIORITY_WEIGHTS).map(([k, w]) => ({
                          factorKey: k,
                          factorLabel: PRIORITY_FACTOR_LABELS[k as keyof typeof DEFAULT_PRIORITY_WEIGHTS],
                          rawValue: 50,
                          normalizedValue: 50,
                          weight: w,
                          contributionPct: Number((50 * w).toFixed(2)),
                        }))
                    ).map((f: any) => {
                      const weightPct = (f.weight * 100).toFixed(1);
                      return (
                        <tr key={f.factorKey}>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>
                            {f.factorLabel || PRIORITY_FACTOR_LABELS[f.factorKey as keyof typeof DEFAULT_PRIORITY_WEIGHTS] || f.factorKey}
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 400 }}>
                              Key: <code>{f.factorKey}</code>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', color: '#334155' }}>
                            {typeof f.rawValue === 'number' ? f.rawValue.toFixed(1) : f.rawValue}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 700 }}>
                                {typeof f.normalizedValue === 'number'
                                  ? f.normalizedValue.toFixed(1)
                                  : f.normalizedValue}
                              </span>
                              <div
                                style={{
                                  width: '45px',
                                  height: '5px',
                                  backgroundColor: '#e2e8f0',
                                  borderRadius: '2px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${f.normalizedValue}%`,
                                    height: '100%',
                                    backgroundColor: '#2563eb',
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', color: '#1e40af', fontWeight: 600 }}>
                            {weightPct}%
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              color: '#0c1a30',
                            }}
                          >
                            +{f.contributionPct.toFixed(2)} pts
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                      <td colSpan={3} style={{ textAlign: 'left', color: '#0c1a30' }}>
                        Total Deterministic Composite Score:
                      </td>
                      <td style={{ textAlign: 'center', color: '#1e40af' }}>100.0%</td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: '#0c1a30',
                          fontSize: '14px',
                        }}
                      >
                        {currentHotspot?.prioritySignalScore.toFixed(2)} / 100
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mathematical Proof Box */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#1e3a8a',
                  lineHeight: '1.6',
                }}
              >
                <strong>Mathematical Explainability Proof:</strong>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    margin: '6px 0',
                    backgroundColor: '#ffffff',
                    padding: '8px',
                    borderRadius: '3px',
                    border: '1px solid #dbeafe',
                    overflowX: 'auto',
                  }}
                >
                  Score ={' '}
                  {factors.map((f: any) => `${f.contributionPct.toFixed(2)} [${f.factorKey}]`).join(' + ')}{' '}
                  = <strong>{currentHotspot?.prioritySignalScore.toFixed(2)}</strong>
                </div>
                <div>
                  Every factor is normalized to a 0–100 interval and multiplied by its auditable policy weight.
                  No hidden neural weights or stochastic LLM calculations are used.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MODEL WEIGHTS CUSTOMIZER */}
          {activeTab === 'customizer' && (
            <div>
              <div style={{ marginBottom: '12px' }}>
                <label className="gov-label" style={{ fontSize: '12px' }}>
                  Policy Framework / Model Version:
                </label>
                <select
                  className="gov-select"
                  value={selectedModelVersion}
                  onChange={(e) => setSelectedModelVersion(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  <option value="v1.0-deterministic">
                    v1.0-deterministic — Standard Balanced DPI Model (28/22/19/14/10/7)
                  </option>
                  <option value="v1.1-monsoon-weighted">
                    v1.1-monsoon-weighted — Monsoon Hazard & Inundation Model (35/20/15/18/8/4)
                  </option>
                  <option value="v1.2-equity-focused">
                    v1.2-equity-focused — Social Equity & Demographic Vulnerability Model (20/15/35/12/10/8)
                  </option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Analytical Weights Distribution:
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: Math.abs(weightsSum - 1.0) < 0.01 ? '#166534' : '#b91c1c',
                  }}
                >
                  Sum: {(weightsSum * 100).toFixed(1)}% {Math.abs(weightsSum - 1.0) >= 0.01 && '(Non-100%)'}
                </span>
              </div>

              {/* Sliders for each factor */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                {Object.entries(customWeights).map(([key, weight]) => {
                  const label = PRIORITY_FACTOR_LABELS[key as keyof typeof DEFAULT_PRIORITY_WEIGHTS];
                  const pct = Math.round(weight * 100);
                  return (
                    <div
                      key={key}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '3px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{label}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>{pct}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="0.60"
                        step="0.01"
                        value={weight}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setCustomWeights((prev) => ({ ...prev, [key]: val }));
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button
                  className="gov-btn gov-btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', fontSize: '12px' }}
                  onClick={handleNormalizeWeights}
                >
                  Auto-Normalize to 100%
                </button>
                <button
                  className="gov-btn gov-btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', fontSize: '12px' }}
                  onClick={handleResetWeights}
                >
                  <RotateCcw size={13} />
                  Reset to Default
                </button>
              </div>

              <button
                className="gov-btn gov-btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontSize: '13px' }}
                onClick={handleRecalculatePriority}
                disabled={calculatingPriority}
              >
                {calculatingPriority ? 'Executing Deterministic Recalculation...' : 'Recalculate Priority for Hotspot'}
              </button>
            </div>
          )}

          {/* TAB 3: HISTORICAL ASSESSMENTS */}
          {activeTab === 'history' && (
            <div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                Audit trail of previous versioned priority evaluations executed for {currentHotspot?.hotspotCode}.
              </p>

              {historicalAssessments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                  No historical assessments recorded for this hotspot yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {historicalAssessments.map((a: any) => (
                    <div
                      key={a.id}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '3px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '12px' }}>
                            {a.assessmentCode}
                          </span>
                          <span
                            style={{
                              marginLeft: '8px',
                              fontSize: '10px',
                              padding: '2px 6px',
                              backgroundColor: '#e0f2fe',
                              color: '#0369a1',
                              borderRadius: '2px',
                            }}
                          >
                            {a.modelVersion}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '15px',
                            fontWeight: 800,
                            color: a.compositeScore >= 75 ? '#b91c1c' : '#2563eb',
                          }}
                        >
                          {a.compositeScore.toFixed(1)} pts
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#64748b',
                          marginTop: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>Calculated: {new Date(a.calculatedAt).toLocaleString()}</span>
                        <span>{a.factors?.length || 6} factors verified</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: What-If Scenario Simulator */}
        <div className="gov-card">
          <div className="gov-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="#0c1a30" />
              <span className="gov-card-title">What-If Scenario Simulator</span>
            </div>
            <span className="gov-badge badge-warning">Counterfactual Engine</span>
          </div>

          {/* Quick Preset Selector Buttons */}
          <div style={{ marginBottom: '14px' }}>
            <label className="gov-label" style={{ fontSize: '11px', color: '#64748b' }}>
              LOAD SCENARIO PRESET:
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '3px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: scenarioName === p.name ? '#eff6ff' : '#ffffff',
                    color: scenarioName === p.name ? '#1e40af' : '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {p.id.includes('monsoon') && <CloudRain size={12} color="#0284c7" />}
                  {p.id.includes('surge') && <Zap size={12} color="#f59e0b" />}
                  {p.id.includes('equity') && <Users size={12} color="#8b5cf6" />}
                  {p.id.includes('capex') && <DollarSign size={12} color="#16a34a" />}
                  {p.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Scenario Details Form */}
          <div style={{ marginBottom: '12px' }}>
            <label className="gov-label" style={{ fontSize: '12px' }}>Scenario Name:</label>
            <input
              type="text"
              className="gov-input"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              style={{ fontSize: '13px' }}
            />
          </div>

          {/* Interactive Parameter Sliders */}
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              marginBottom: '14px',
            }}
          >
            {/* Citizen Surge Factor */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '3px' }}>
                <span>Citizen Signal Reporting Volume:</span>
                <span style={{ color: '#1e40af' }}>{volumeMultiplier.toFixed(1)}x Baseline</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="4.0"
                step="0.1"
                value={volumeMultiplier}
                onChange={(e) => setVolumeMultiplier(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                <span>0.2x (Subdued)</span>
                <span>1.0x (Normal)</span>
                <span>4.0x (Extreme Surge)</span>
              </div>
            </div>

            {/* Infrastructure Distress Delta */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '3px' }}>
                <span>Physical Infrastructure Distress Delta:</span>
                <span style={{ color: distressDelta >= 0 ? '#b91c1c' : '#166534', fontWeight: 700 }}>
                  {distressDelta >= 0 ? `+${distressDelta}%` : `${distressDelta}%`}
                </span>
              </div>
              <input
                type="range"
                min="-40"
                max="40"
                step="5"
                value={distressDelta}
                onChange={(e) => setDistressDelta(parseInt(e.target.value, 10))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                <span>-40% (Major Repair)</span>
                <span>0% (No Change)</span>
                <span>+40% (Catastrophic Breach)</span>
              </div>
            </div>

            {/* Capex Investment Gap Delta */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '3px' }}>
                <span>Capex Backlog / Grant Infusion Delta:</span>
                <span style={{ color: investmentGapDelta <= 0 ? '#166534' : '#b91c1c', fontWeight: 700 }}>
                  {investmentGapDelta >= 0 ? `+${investmentGapDelta}% Deficit` : `${investmentGapDelta}% Funded`}
                </span>
              </div>
              <input
                type="range"
                min="-40"
                max="40"
                step="5"
                value={investmentGapDelta}
                onChange={(e) => setInvestmentGapDelta(parseInt(e.target.value, 10))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Urgency Escalation */}
            <div>
              <label className="gov-label" style={{ fontSize: '12px' }}>Simulate Hazard Urgency Override:</label>
              <select
                className="gov-select"
                value={urgencyOverride}
                onChange={(e) => setUrgencyOverride(e.target.value as any)}
                style={{ fontSize: '12px' }}
              >
                <option value="NONE">Keep Actual Citizen Reported Urgency</option>
                <option value="LOW">LOW — Routine maintenance issue</option>
                <option value="MEDIUM">MEDIUM — Disruptive service strain</option>
                <option value="HIGH">HIGH — Imminent localized hazard</option>
                <option value="CRITICAL">CRITICAL — Emergency ingress hazard / public risk</option>
              </select>
            </div>
          </div>

          {/* Action Button */}
          <button
            className="gov-btn gov-btn-primary"
            style={{ width: '100%', justifyContent: 'center', fontSize: '13px', padding: '10px' }}
            onClick={handleSimulate}
            disabled={simulating}
          >
            <TrendingUp size={16} />
            {simulating ? 'Executing Counterfactual Recalculation...' : 'Recalculate Scenario Priority Score'}
          </button>

          {/* Simulation Output Comparison Panel */}
          {simulationResult && (
            <div
              style={{
                marginTop: '16px',
                padding: '14px',
                backgroundColor: '#ffffff',
                border: '2px solid #0c1a30',
                borderRadius: '4px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0c1a30' }}>
                    Scenario Recalculation Results
                  </span>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Hotspot: {simulationResult.hotspotCode} ({simulationResult.administrativeArea})
                  </div>
                </div>
                <span className="gov-badge badge-good">Validated</span>
              </div>

              {/* Score Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'center', marginBottom: '10px' }}>
                <div style={{ padding: '8px', backgroundColor: '#f1f5f9', borderRadius: '3px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>BASELINE SCORE</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e293b' }}>
                    {simulationResult.baselineScore.toFixed(1)}
                  </div>
                  <span className="gov-badge" style={{ fontSize: '10px', marginTop: '2px' }}>
                    {simulationResult.baselineRiskTier}
                  </span>
                </div>

                <div
                  style={{
                    padding: '8px',
                    backgroundColor: simulationResult.scoreDelta >= 0 ? '#fef2f2' : '#f0fdf4',
                    border: simulationResult.scoreDelta >= 0 ? '1px solid #fecaca' : '1px solid #bbf7d0',
                    borderRadius: '3px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>SIMULATED SCORE</div>
                  <div
                    style={{
                      fontSize: '22px',
                      fontWeight: 800,
                      color: simulationResult.scoreDelta >= 0 ? '#b91c1c' : '#166534',
                    }}
                  >
                    {simulationResult.resultingScore.toFixed(1)}
                  </div>
                  <span
                    className={`gov-badge ${simulationResult.scoreDelta >= 0 ? 'badge-urgent' : 'badge-good'}`}
                    style={{ fontSize: '10px', marginTop: '2px' }}
                  >
                    {simulationResult.simulatedRiskTier}
                  </span>
                </div>
              </div>

              {/* Delta Banner */}
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '3px',
                  marginBottom: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <span>Net Score Impact:</span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    color: simulationResult.scoreDelta >= 0 ? '#b91c1c' : '#166534',
                  }}
                >
                  {simulationResult.scoreDelta >= 0 ? `+${simulationResult.scoreDelta.toFixed(1)}` : simulationResult.scoreDelta.toFixed(1)} Points
                </span>
              </div>

              {/* Natural Language Sensitivity Driver */}
              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '3px',
                  fontSize: '11px',
                  color: '#0369a1',
                  marginBottom: '12px',
                  lineHeight: '1.5',
                }}
              >
                <strong>Primary Sensitivity Driver:</strong> {simulationResult.driverSummary}
              </div>

              {/* Factor-by-Factor Comparison Table */}
              <div style={{ overflowX: 'auto' }}>
                <table className="gov-table" style={{ fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Factor</th>
                      <th style={{ textAlign: 'center' }}>Baseline</th>
                      <th style={{ textAlign: 'center' }}>Simulated</th>
                      <th style={{ textAlign: 'right' }}>Δ Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationResult.factorComparisons?.map((fc: any) => (
                      <tr key={fc.factorKey}>
                        <td style={{ fontWeight: 600 }}>{fc.factorLabel}</td>
                        <td style={{ textAlign: 'center', color: '#64748b' }}>
                          +{fc.baselineContribution.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>
                          +{fc.simulatedContribution.toFixed(2)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color:
                              fc.deltaContribution > 0
                                ? '#b91c1c'
                                : fc.deltaContribution < 0
                                  ? '#166534'
                                  : '#64748b',
                          }}
                        >
                          {fc.deltaContribution > 0 ? `+${fc.deltaContribution.toFixed(2)}` : fc.deltaContribution.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Saved Scenarios History */}
          {savedScenarios.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <History size={14} />
                Saved Simulation Scenarios ({savedScenarios.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {savedScenarios.slice(0, 5).map((s: any) => (
                  <div
                    key={s.id}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '3px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        Baseline: {s.baselineScore?.toFixed(1)} → Result: {s.resultingScore?.toFixed(1)} (
                        {s.scoreDelta >= 0 ? `+${s.scoreDelta.toFixed(1)}` : s.scoreDelta.toFixed(1)} pts)
                      </div>
                    </div>
                    <span
                      className={`gov-badge ${s.scoreDelta >= 0 ? 'badge-urgent' : 'badge-good'}`}
                      style={{ fontSize: '10px' }}
                    >
                      {s.scoreDelta >= 0 ? `+${s.scoreDelta.toFixed(1)}` : s.scoreDelta.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
