import React from 'react';
import {
  AlertTriangle,
  Layers,
  ShieldCheck,
  MapPin,
  ArrowRight,
  Radio,
  Sliders,
} from 'lucide-react';

interface DashboardViewProps {
  hotspots: any[];
  requests: any[];
  assets: any[];
  onSelectHotspot: (hotspotId: string) => void;
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  hotspots,
  requests,
  assets,
  onSelectHotspot,
  onNavigate,
}) => {
  // Aggregate KPIs
  const totalHotspots = hotspots.length;
  const criticalHotspots = hotspots.filter((h) => h.prioritySignalScore >= 75).length;
  const elevatedHotspots = hotspots.filter((h) => h.prioritySignalScore >= 60 && h.prioritySignalScore < 75).length;

  const totalSignals = requests.length;
  const criticalUrgencySignals = requests.filter((r) => r.urgency === 'CRITICAL' || r.urgency === 'HIGH').length;

  const totalAssets = assets.length;
  const distressedAssets = assets.filter((a) => a.conditionRating === 'CRITICAL' || a.conditionRating === 'POOR').length;

  // Language count
  const languagesDetected = new Set(requests.map((r) => r.language)).size;

  // Sector breakdown
  const sectors = [
    { name: 'Roads', label: 'Roads & Bridges', iconColor: '#b91c1c' },
    { name: 'Water', label: 'Water Networks', iconColor: '#0284c7' },
    { name: 'Sanitation', label: 'Sanitation & Sewage', iconColor: '#d97706' },
    { name: 'Electricity', label: 'Power Grid', iconColor: '#eab308' },
    { name: 'Healthcare', label: 'Primary Healthcare', iconColor: '#16a34a' },
    { name: 'Waste Management', label: 'Solid Waste', iconColor: '#7c3aed' },
  ];

  const sectorMetrics = sectors.map((s) => {
    const sRequests = requests.filter((r) => r.category === s.name);
    const sHotspots = hotspots.filter((h) => h.category === s.name);
    const avgScore =
      sHotspots.length > 0
        ? Number(
            (sHotspots.reduce((sum, h) => sum + h.prioritySignalScore, 0) / sHotspots.length).toFixed(1),
          )
        : 0;
    return {
      ...s,
      requestCount: sRequests.length,
      hotspotCount: sHotspots.length,
      avgPriorityScore: avgScore,
    };
  });

  return (
    <div className="gov-container">
      {/* Institutional Mission Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          padding: '16px 20px',
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderLeft: '4px solid #0c1a30',
          borderRadius: '2px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#0c1a30' }}>
              Municipal Decision & Infrastructure Risk Command Center
            </span>
            <span className="gov-badge badge-good">National DPI Node</span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569' }}>
            Transforming unstructured citizen complaints across Indian languages into deterministic, verifiable capital infrastructure priorities.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="gov-btn gov-btn-secondary"
            onClick={() => onNavigate('radar')}
            style={{ fontSize: '12px' }}
          >
            <MapPin size={13} />
            Open GIS Radar
          </button>
          <button
            className="gov-btn gov-btn-primary"
            onClick={() => onNavigate('priority')}
            style={{ fontSize: '12px' }}
          >
            <Sliders size={13} />
            Run What-If Scenario
          </button>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="stats-grid">
        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Emerging Risk Hotspots</span>
            <AlertTriangle size={18} color="#b91c1c" />
          </div>
          <div className="stat-value" style={{ color: '#b91c1c' }}>
            {totalHotspots}
          </div>
          <div className="stat-subtext">
            <strong>{criticalHotspots} Critical</strong> • {elevatedHotspots} Elevated risk zones
          </div>
        </div>

        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Citizen Distress Signals</span>
            <Radio size={18} color="#2563eb" />
          </div>
          <div className="stat-value" style={{ color: '#2563eb' }}>
            {totalSignals}
          </div>
          <div className="stat-subtext">
            Across <strong>{languagesDetected} languages</strong> • {criticalUrgencySignals} high urgency
          </div>
        </div>

        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Physical Assets Monitored</span>
            <Layers size={18} color="#d97706" />
          </div>
          <div className="stat-value" style={{ color: '#0c1a30' }}>
            {totalAssets}
          </div>
          <div className="stat-subtext">
            <strong style={{ color: '#b91c1c' }}>{distressedAssets} in severe distress</strong> requiring capex
          </div>
        </div>

        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Governance Integrity</span>
            <ShieldCheck size={18} color="#16a34a" />
          </div>
          <div className="stat-value" style={{ fontSize: '20px', color: '#16a34a', paddingTop: '4px' }}>
            100% Deterministic
          </div>
          <div className="stat-subtext">
            Zero LLM arithmetic • SHA-256 hash chained
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="gov-two-col" style={{ marginBottom: '20px' }}>
        {/* Left: Top Emerging Risk Hotspots Table */}
        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">High-Priority Infrastructure Distress Hotspots</span>
            <button
              className="gov-btn gov-btn-secondary"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() => onNavigate('radar')}
            >
              Full GIS Radar
            </button>
          </div>

          <div className="gov-table-container">
            <table className="gov-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Jurisdiction</th>
                  <th>Sector</th>
                  <th style={{ textAlign: 'center' }}>Signals</th>
                  <th style={{ textAlign: 'center' }}>Growth</th>
                  <th style={{ textAlign: 'center' }}>Priority Index</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hotspots.slice(0, 5).map((h) => (
                  <tr key={h.id}>
                    <td>
                      <code style={{ fontWeight: 700, color: '#0c1a30' }}>{h.hotspotCode}</code>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{h.administrativeArea?.name}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        State: {h.administrativeArea?.stateCode}
                      </div>
                    </td>
                    <td>
                      <span className="gov-badge badge-medium">{h.category}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{h.requestCount}</td>
                    <td
                      style={{
                        textAlign: 'center',
                        color: h.trendGrowthPct > 0 ? '#b91c1c' : '#166534',
                        fontWeight: 600,
                      }}
                    >
                      +{h.trendGrowthPct}%
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`gov-badge ${
                          h.prioritySignalScore >= 75
                            ? 'badge-critical'
                            : h.prioritySignalScore >= 60
                              ? 'badge-high'
                              : 'badge-medium'
                        }`}
                      >
                        {h.prioritySignalScore.toFixed(1)} / 100
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="gov-btn gov-btn-primary"
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        onClick={() => {
                          onSelectHotspot(h.id);
                          onNavigate('radar');
                        }}
                      >
                        Drill Down
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Sector Distress Matrix */}
        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Sector Distress & Priority Distribution</span>
            <span className="gov-badge badge-medium">Multi-Sector Index</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sectorMetrics.map((sec) => (
              <div
                key={sec.name}
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '3px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                    {sec.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {sec.requestCount} citizen signals • {sec.hotspotCount} active hotspots
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color:
                        sec.avgPriorityScore >= 70
                          ? '#b91c1c'
                          : sec.avgPriorityScore >= 50
                            ? '#d97706'
                            : '#2563eb',
                    }}
                  >
                    {sec.avgPriorityScore > 0 ? `${sec.avgPriorityScore} pts` : '—'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Avg Priority Index</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Live Multilingual Signals & Quick Jump to Modules */}
      <div className="gov-two-col">
        {/* Left: Recent Multilingual Signals Feed */}
        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Live Multilingual Citizen Signal Feed</span>
            <button
              className="gov-btn gov-btn-secondary"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() => onNavigate('signals')}
            >
              Intake Portal
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {requests.slice(0, 3).map((r) => (
              <div
                key={r.id}
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '3px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <code style={{ fontSize: '11px', fontWeight: 700 }}>{r.trackingCode}</code>
                    <span className="gov-badge badge-medium">{r.language?.toUpperCase()}</span>
                    <span className="gov-badge badge-good">{r.category}</span>
                  </div>
                  <span
                    className={`gov-badge ${
                      r.urgency === 'CRITICAL'
                        ? 'badge-critical'
                        : r.urgency === 'HIGH'
                          ? 'badge-high'
                          : 'badge-medium'
                    }`}
                  >
                    {r.urgency}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#334155', fontStyle: 'italic', marginBottom: '4px' }}>
                  "{r.originalText}"
                </div>
                {r.summary && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      padding: '4px 8px',
                      borderLeft: '3px solid #0c1a30',
                      marginBottom: '4px',
                    }}
                  >
                    <strong>Normalized Intent:</strong> {r.summary}
                  </div>
                )}
                <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={11} />
                  <span>{r.location?.address || 'Geocoded Coordinates Logged'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Quick Module Directory & Institutional Trust Summary */}
        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Digital Public Good Architecture Navigation</span>
            <span className="gov-badge badge-good">System Active</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              onClick={() => onNavigate('infrastructure')}
              style={{
                padding: '10px 14px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#0c1a30' }}>
                  Infrastructure Asset Registry
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Inspect physical conditions, telemetry scores, and diagnostic engineering logs.
                </div>
              </div>
              <ArrowRight size={16} color="#64748b" />
            </div>

            <div
              onClick={() => onNavigate('investments')}
              style={{
                padding: '10px 14px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#0c1a30' }}>
                  Public Capital Investments & Capex Deficits
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Track PMGSY, AMRUT 2.0, and JJM outlays vs underfunded distress wards.
                </div>
              </div>
              <ArrowRight size={16} color="#64748b" />
            </div>

            <div
              onClick={() => onNavigate('recommendations')}
              style={{
                padding: '10px 14px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#0c1a30' }}>
                  DPI Recommendations & Human Review
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Approve, modify, or reject synthesized capital interventions with formal audit trail.
                </div>
              </div>
              <ArrowRight size={16} color="#64748b" />
            </div>

            <div
              onClick={() => onNavigate('audit')}
              style={{
                padding: '10px 14px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#0c1a30' }}>
                  Cryptographic AI Audit & Review Log
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Verify tamper-evident SHA-256 hash chains across all intelligence inferences.
                </div>
              </div>
              <ArrowRight size={16} color="#64748b" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
