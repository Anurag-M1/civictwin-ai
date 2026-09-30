import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Filter,
  CheckCircle2,
  MapPin,
  Calendar,
  User,
  Wrench,
  X,
  RotateCcw,
  Zap,
  Droplet,
  Building2,
  Trash2,
} from 'lucide-react';
import { fetchAssets } from '../services/api.js';

interface InfrastructureViewProps {
  onNavigate?: (tab: string) => void;
}

export const InfrastructureView: React.FC<InfrastructureViewProps> = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [selectedState, setSelectedState] = useState('');

  // Selected asset for inspection drawer/modal
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const res = await fetchAssets({
        type: selectedType || undefined,
        conditionRating: selectedCondition || undefined,
        stateCode: selectedState || undefined,
      });
      if (res.success) {
        setAssets(res.data);
      }
    } catch (err) {
      console.error('Error fetching infrastructure assets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [selectedType, selectedCondition, selectedState]);

  const filteredAssets = assets.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.assetCode.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.administrativeArea?.name.toLowerCase().includes(q) ||
      (a.location?.landmark && a.location.landmark.toLowerCase().includes(q))
    );
  });

  // Calculate summary metrics
  const totalAssets = assets.length;
  const criticalCount = assets.filter((a) => a.conditionRating === 'CRITICAL').length;
  const poorCount = assets.filter((a) => a.conditionRating === 'POOR').length;
  const operationalCount = assets.filter((a) => a.conditionRating === 'GOOD' || a.conditionRating === 'EXCELLENT').length;

  const totalScore = assets.reduce((sum, a) => {
    const score = a.conditions?.[0]?.conditionScore ?? (a.conditionRating === 'CRITICAL' ? 20 : a.conditionRating === 'POOR' ? 40 : 70);
    return sum + score;
  }, 0);
  const avgCondition = totalAssets > 0 ? Number((totalScore / totalAssets).toFixed(1)) : 0;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Road':
        return <Wrench size={14} color="#475569" />;
      case 'WaterNetwork':
        return <Droplet size={14} color="#0284c7" />;
      case 'HealthCentre':
      case 'School':
        return <Building2 size={14} color="#16a34a" />;
      case 'Transformer':
        return <Zap size={14} color="#d97706" />;
      case 'WasteFacility':
        return <Trash2 size={14} color="#7c3aed" />;
      default:
        return <Layers size={14} color="#475569" />;
    }
  };

  const getConditionBadge = (rating: string) => {
    switch (rating) {
      case 'CRITICAL':
        return <span className="gov-badge badge-critical">Critical Distress</span>;
      case 'POOR':
        return <span className="gov-badge badge-high">Poor Condition</span>;
      case 'FAIR':
        return <span className="gov-badge badge-medium">Fair Condition</span>;
      case 'GOOD':
        return <span className="gov-badge badge-good">Good Operational</span>;
      case 'EXCELLENT':
        return <span className="gov-badge badge-good">Excellent</span>;
      default:
        return <span className="gov-badge badge-medium">{rating}</span>;
    }
  };

  return (
    <div className="gov-container">
      {/* Title & Summary Cards */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0c1a30', marginBottom: '4px' }}>
          Physical Infrastructure Asset Registry & Distress Monitoring
        </h2>
        <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
          Master inventory of municipal assets, geotechnical telemetry, acoustic leak detection, and engineering inspection logs across urban jurisdictions.
        </p>
      </div>

      {/* Summary KPI Strip */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Monitored Assets</span>
            <Layers size={16} color="#0c1a30" />
          </div>
          <div className="stat-value">{totalAssets}</div>
          <div className="stat-subtext">Registered across 4 state jurisdictions</div>
        </div>

        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Critical Distress Assets</span>
            <span className="gov-badge badge-critical">Imminent Hazard</span>
          </div>
          <div className="stat-value" style={{ color: '#b91c1c' }}>{criticalCount}</div>
          <div className="stat-subtext">Score &lt; 25 / Active structural failure</div>
        </div>

        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Poor Condition Assets</span>
            <span className="gov-badge badge-high">Maintenance Backlog</span>
          </div>
          <div className="stat-value" style={{ color: '#d97706' }}>{poorCount}</div>
          <div className="stat-subtext">Requires scheduled municipal intervention</div>
        </div>

        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Avg Physical Condition</span>
            <CheckCircle2 size={16} color="#16a34a" />
          </div>
          <div className="stat-value" style={{ color: avgCondition >= 60 ? '#166534' : '#b91c1c' }}>
            {avgCondition} <span style={{ fontSize: '14px', color: '#64748b' }}>/ 100</span>
          </div>
          <div className="stat-subtext">{operationalCount} operational in good condition</div>
        </div>
      </div>

      {/* Multi-Criteria Filter Bar */}
      <div
        className="gov-card"
        style={{
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 240px' }}>
          <Search size={15} color="#64748b" />
          <input
            type="text"
            className="gov-input"
            placeholder="Search asset code, name, or landmark..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} color="#64748b" />
          <select
            className="gov-select"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', minWidth: '130px' }}
          >
            <option value="">All Asset Types</option>
            <option value="Road">Roads</option>
            <option value="WaterNetwork">Water Supply</option>
            <option value="HealthCentre">Health Centres</option>
            <option value="School">Schools</option>
            <option value="Transformer">Transformers</option>
            <option value="WasteFacility">Waste Facilities</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select
            className="gov-select"
            value={selectedCondition}
            onChange={(e) => setSelectedCondition(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', minWidth: '130px' }}
          >
            <option value="">All Conditions</option>
            <option value="CRITICAL">Critical</option>
            <option value="POOR">Poor</option>
            <option value="FAIR">Fair</option>
            <option value="GOOD">Good</option>
            <option value="EXCELLENT">Excellent</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select
            className="gov-select"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', minWidth: '110px' }}
          >
            <option value="">All States</option>
            <option value="KA">Karnataka</option>
            <option value="UP">Uttar Pradesh</option>
            <option value="MH">Maharashtra</option>
            <option value="OD">Odisha</option>
          </select>
        </div>

        {(search || selectedType || selectedCondition || selectedState) && (
          <button
            className="gov-btn gov-btn-secondary"
            style={{ padding: '6px 10px', fontSize: '12px' }}
            onClick={() => {
              setSearch('');
              setSelectedType('');
              setSelectedCondition('');
              setSelectedState('');
            }}
          >
            <RotateCcw size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Assets Table */}
      <div className="gov-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0c1a30' }}>
            Infrastructure Asset Registry ({filteredAssets.length} Matching Records)
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Source: Official Municipal Infrastructure Telemetry & Inspection Logs
          </span>
        </div>

        <div className="gov-table-container" style={{ border: 'none' }}>
          <table className="gov-table">
            <thead>
              <tr>
                <th>Asset Code</th>
                <th>Asset Name & Capacity</th>
                <th>Sector</th>
                <th>Jurisdiction</th>
                <th>Condition Rating</th>
                <th style={{ textAlign: 'center' }}>Condition Score</th>
                <th>Primary Distress Diagnostic</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    Loading asset records...
                  </td>
                </tr>
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No infrastructure assets match the specified filters.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const latestCond = asset.conditions?.[0];
                  const score = latestCond?.conditionScore ?? 50;
                  return (
                    <tr key={asset.id}>
                      <td>
                        <code style={{ fontSize: '12px', fontWeight: 700, color: '#0c1a30' }}>
                          {asset.assetCode}
                        </code>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{asset.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Capacity: {asset.capacity || 'Standard Operational Duty'} • Radius: {asset.serviceAreaRadiusKm} km
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {getTypeIcon(asset.type)}
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>{asset.type}</span>
                        </div>
                      </td>
                      <td>
                        <div>{asset.administrativeArea?.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          State: {asset.administrativeArea?.stateCode}
                        </div>
                      </td>
                      <td>{getConditionBadge(asset.conditionRating)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: score < 30 ? '#b91c1c' : score < 60 ? '#d97706' : '#166534',
                            }}
                          >
                            {score.toFixed(1)}
                          </span>
                          <div
                            style={{
                              width: '40px',
                              height: '5px',
                              backgroundColor: '#e2e8f0',
                              borderRadius: '2px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${score}%`,
                                height: '100%',
                                backgroundColor: score < 30 ? '#b91c1c' : score < 60 ? '#d97706' : '#166534',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ maxWidth: '240px' }}>
                        <div style={{ fontSize: '12px', color: '#334155', fontWeight: 500 }}>
                          {latestCond?.distressType || 'Routine operational wear'}
                        </div>
                        {latestCond?.inspectorName && (
                          <div style={{ fontSize: '10px', color: '#64748b' }}>
                            By: {latestCond.inspectorName}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="gov-btn gov-btn-secondary"
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                          onClick={() => setSelectedAsset(asset)}
                        >
                          Inspection Log
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Inspection Diagnostic Modal */}
      {selectedAsset && (
        <div className="gov-modal-overlay" onClick={() => setSelectedAsset(null)}>
          <div className="gov-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gov-modal-header">
              <div>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>
                  Infrastructure Diagnostic Log — {selectedAsset.assetCode}
                </span>
                <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                  {selectedAsset.name}
                </div>
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="gov-modal-body">
              {/* Asset Snapshot Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '10px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '3px',
                  marginBottom: '16px',
                  fontSize: '12px',
                }}
              >
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>ASSET TYPE</div>
                  <div style={{ fontWeight: 600 }}>{selectedAsset.type}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>RATING</div>
                  <div>{getConditionBadge(selectedAsset.conditionRating)}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>JURISDICTION</div>
                  <div style={{ fontWeight: 600 }}>{selectedAsset.administrativeArea?.name}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>LAST INSPECTED</div>
                  <div style={{ fontWeight: 600 }}>
                    {selectedAsset.lastInspectedAt
                      ? new Date(selectedAsset.lastInspectedAt).toLocaleDateString()
                      : 'Pending'}
                  </div>
                </div>
              </div>

              {/* Latest Inspection Notes */}
              {selectedAsset.conditions?.[0] ? (
                <div
                  style={{
                    padding: '14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '3px',
                    backgroundColor: '#ffffff',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0c1a30' }}>
                      Diagnostic Inspection Findings
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 800,
                        color:
                          selectedAsset.conditions[0].conditionScore < 30
                            ? '#b91c1c'
                            : selectedAsset.conditions[0].conditionScore < 60
                              ? '#d97706'
                              : '#166534',
                      }}
                    >
                      Condition Score: {selectedAsset.conditions[0].conditionScore.toFixed(1)} / 100
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#b91c1c', marginBottom: '6px' }}>
                    Fault Diagnostic: {selectedAsset.conditions[0].distressType}
                  </div>

                  <p style={{ fontSize: '12px', color: '#334155', lineHeight: '1.6', margin: 0 }}>
                    {selectedAsset.conditions[0].notes}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      marginTop: '12px',
                      paddingTop: '10px',
                      borderTop: '1px solid #f1f5f9',
                      fontSize: '11px',
                      color: '#64748b',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={13} />
                      <span>Inspector: {selectedAsset.conditions[0].inspectorName || 'Authorized Municipal Engineer'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} />
                      <span>{new Date(selectedAsset.conditions[0].inspectionDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                  No detailed inspection logs recorded for this asset.
                </div>
              )}

              {/* Geographic Coordinates & Landmark */}
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '3px',
                  fontSize: '12px',
                  color: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <MapPin size={16} color="#0c1a30" />
                <span>
                  <strong>Location:</strong> {selectedAsset.location?.address || 'Designated ward corridor'}{' '}
                  {selectedAsset.location?.latitude && (
                    <code style={{ fontSize: '11px', marginLeft: '6px' }}>
                      [{selectedAsset.location.latitude}, {selectedAsset.location.longitude}]
                    </code>
                  )}
                </span>
              </div>
            </div>

            <div className="gov-modal-footer">
              <button
                className="gov-btn gov-btn-secondary"
                onClick={() => setSelectedAsset(null)}
              >
                Close Diagnostic Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
