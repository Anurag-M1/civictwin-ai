import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  RotateCcw,
  TrendingUp,
  Sliders,
} from 'lucide-react';
import { fetchInvestments, fetchCapexGapAnalysis } from '../services/api.js';

interface InvestmentsViewProps {
  onNavigate?: (tab: string) => void;
}

export const InvestmentsView: React.FC<InvestmentsViewProps> = ({ onNavigate }) => {
  const [investments, setInvestments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [gapAnalysis, setGapAnalysis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'registry' | 'gaps'>('registry');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState('');
  const [selectedState, setSelectedState] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [invRes, gapRes] = await Promise.all([
        fetchInvestments({
          category: selectedCategory || undefined,
          status: selectedStatus || undefined,
          fiscalYear: selectedFiscalYear || undefined,
          stateCode: selectedState || undefined,
          search: search || undefined,
        }),
        fetchCapexGapAnalysis(),
      ]);

      if (invRes.success) {
        setInvestments(invRes.data);
        setSummary(invRes.summary);
      }
      if (gapRes.success) {
        setGapAnalysis(gapRes.data);
      }
    } catch (err) {
      console.error('Error fetching investments data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedStatus, selectedFiscalYear, selectedState]);

  const formatInr = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} Lakh`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="gov-badge badge-good">Completed</span>;
      case 'ONGOING':
        return <span className="gov-badge badge-medium">Ongoing Works</span>;
      case 'APPROVED':
        return <span className="gov-badge badge-warning">Sanctioned</span>;
      case 'DELAYED':
        return <span className="gov-badge badge-critical">Execution Delayed</span>;
      default:
        return <span className="gov-badge badge-medium">{status}</span>;
    }
  };

  const filteredInvestments = investments.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.schemeName.toLowerCase().includes(q) ||
      inv.category.toLowerCase().includes(q) ||
      inv.administrativeArea?.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="gov-container">
      {/* Title & Description */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0c1a30', marginBottom: '4px' }}>
          Public Capital Investments & Municipal Capex Tracker
        </h2>
        <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
          Tracking national, state, and municipal capital outlay (PMGSY, AMRUT 2.0, Jal Jeevan Mission, Smart Cities) cross-referenced against citizen demand distress.
        </p>
      </div>

      {/* Summary KPI Strip */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Total Capital Outlay</span>
            <DollarSign size={16} color="#0c1a30" />
          </div>
          <div className="stat-value" style={{ color: '#0c1a30' }}>
            {summary ? formatInr(summary.totalAllocatedInr) : '₹0'}
          </div>
          <div className="stat-subtext">Across {investments.length} sanctioned municipal schemes</div>
        </div>

        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Disbursed Expenditure</span>
            <CheckCircle2 size={16} color="#166534" />
          </div>
          <div className="stat-value" style={{ color: '#166534' }}>
            {summary ? formatInr(summary.totalSpentInr) : '₹0'}
          </div>
          <div className="stat-subtext">Verified capital work completion invoices</div>
        </div>

        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Capex Execution Rate</span>
            <TrendingUp size={16} color="#2563eb" />
          </div>
          <div className="stat-value" style={{ color: '#2563eb' }}>
            {summary ? `${summary.executionRatePct}%` : '0%'}
          </div>
          <div className="stat-subtext">
            Unspent pipeline: {summary ? formatInr(summary.unspentInr) : '₹0'}
          </div>
        </div>

        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Underfunded Deficit Wards</span>
            <Clock size={16} color="#b91c1c" />
          </div>
          <div className="stat-value" style={{ color: '#b91c1c' }}>
            {gapAnalysis.filter((g) => g.isUnderfunded).length}
          </div>
          <div className="stat-subtext">High citizen distress with delayed or zero capex</div>
        </div>
      </div>

      {/* Tabs Switcher: Investment Registry vs Capex Deficit Analysis */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className={`gov-btn ${activeTab === 'registry' ? 'gov-btn-primary' : 'gov-btn-secondary'}`}
          onClick={() => setActiveTab('registry')}
          style={{ fontSize: '12px' }}
        >
          Public Investment Registry ({investments.length})
        </button>
        <button
          className={`gov-btn ${activeTab === 'gaps' ? 'gov-btn-primary' : 'gov-btn-secondary'}`}
          onClick={() => setActiveTab('gaps')}
          style={{ fontSize: '12px' }}
        >
          Capex Deficit vs Citizen Demand Correlation ({gapAnalysis.length} Wards)
        </button>
      </div>

      {activeTab === 'registry' && (
        <>
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
                placeholder="Search scheme name or ward..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} color="#64748b" />
              <select
                className="gov-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '12px', minWidth: '130px' }}
              >
                <option value="">All Sectors</option>
                <option value="Roads">Roads & Bridges</option>
                <option value="Water">Water Supply</option>
                <option value="Sanitation">Sanitation & Drainage</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Electricity">Electricity</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <select
                className="gov-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '12px', minWidth: '130px' }}
              >
                <option value="">All Statuses</option>
                <option value="ONGOING">Ongoing</option>
                <option value="DELAYED">Delayed</option>
                <option value="APPROVED">Approved / Sanctioned</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <select
                className="gov-select"
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '12px', minWidth: '110px' }}
              >
                <option value="">All Fiscal Years</option>
                <option value="2025-2026">FY 2025-2026</option>
                <option value="2024-2025">FY 2024-2025</option>
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

            {(search || selectedCategory || selectedStatus || selectedFiscalYear || selectedState) && (
              <button
                className="gov-btn gov-btn-secondary"
                style={{ padding: '6px 10px', fontSize: '12px' }}
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('');
                  setSelectedStatus('');
                  setSelectedFiscalYear('');
                  setSelectedState('');
                }}
              >
                <RotateCcw size={12} />
                Clear
              </button>
            )}
          </div>

          {/* Investments Table */}
          <div className="gov-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0c1a30' }}>
                Municipal & State Capital Schemes ({filteredInvestments.length} Records)
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Source: State Finance & Urban Mission Dashboards (PMGSY, AMRUT 2.0, JJM)
              </span>
            </div>

            <div className="gov-table-container" style={{ border: 'none' }}>
              <table className="gov-table">
                <thead>
                  <tr>
                    <th>Scheme Name & Objective</th>
                    <th>Sector</th>
                    <th>Jurisdiction</th>
                    <th style={{ textAlign: 'right' }}>Allocated</th>
                    <th style={{ textAlign: 'right' }}>Disbursed</th>
                    <th style={{ textAlign: 'center' }}>Execution %</th>
                    <th>Fiscal Year</th>
                    <th>Status</th>
                    <th>Data Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        Loading public capital schemes...
                      </td>
                    </tr>
                  ) : filteredInvestments.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        No investment records match the specified filters.
                      </td>
                    </tr>
                  ) : (
                    filteredInvestments.map((inv) => {
                      const execPct =
                        inv.allocatedAmountInr > 0
                          ? Number(((inv.spentAmountInr / inv.allocatedAmountInr) * 100).toFixed(1))
                          : 0;
                      return (
                        <tr key={inv.id}>
                          <td style={{ maxWidth: '300px' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{inv.schemeName}</div>
                          </td>
                          <td>
                            <span className="gov-badge badge-medium">{inv.category}</span>
                          </td>
                          <td>
                            <div>{inv.administrativeArea?.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              State: {inv.administrativeArea?.stateCode}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#0c1a30' }}>
                            {formatInr(inv.allocatedAmountInr)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#166534' }}>
                            {formatInr(inv.spentAmountInr)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 700, fontSize: '12px' }}>{execPct}%</span>
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
                                    width: `${Math.min(100, execPct)}%`,
                                    height: '100%',
                                    backgroundColor: execPct > 70 ? '#166534' : execPct > 40 ? '#2563eb' : '#b91c1c',
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: '12px', color: '#475569' }}>{inv.fiscalYear}</td>
                          <td>{getStatusBadge(inv.status)}</td>
                          <td>
                            <code style={{ fontSize: '10px', color: '#64748b' }}>{inv.sourceDataset}</code>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: CAPEX DEFICIT VS CITIZEN DEMAND CORRELATION */}
      {activeTab === 'gaps' && (
        <div className="gov-card">
          <div className="gov-card-header">
            <div>
              <span className="gov-card-title">Municipal Capex Deficit vs Citizen Demand Correlation</span>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Correlates citizen distress density with historical municipal capital allocations to uncover structural underfunding.
              </div>
            </div>
          </div>

          <div className="gov-table-container">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>Jurisdiction / Ward</th>
                  <th>State</th>
                  <th style={{ textAlign: 'center' }}>Active Hotspots</th>
                  <th style={{ textAlign: 'center' }}>Max Risk Index</th>
                  <th style={{ textAlign: 'right' }}>Total Capex Allocated</th>
                  <th style={{ textAlign: 'right' }}>Capex Disbursed</th>
                  <th style={{ textAlign: 'center' }}>Capex Deficit Index</th>
                  <th>Assessment Status</th>
                  <th style={{ textAlign: 'right' }}>Policy Action</th>
                </tr>
              </thead>
              <tbody>
                {gapAnalysis.map((g) => (
                  <tr key={g.areaId}>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{g.areaName}</td>
                    <td>{g.stateCode}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{g.activeHotspotsCount}</td>
                    <td style={{ textAlign: 'center' }}>
                      {g.maxPriorityScore > 0 ? (
                        <span
                          className={`gov-badge ${
                            g.maxPriorityScore >= 75
                              ? 'badge-critical'
                              : g.maxPriorityScore >= 60
                                ? 'badge-high'
                                : 'badge-medium'
                          }`}
                        >
                          {g.maxPriorityScore.toFixed(1)} / 100
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>None</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatInr(g.allocatedInr)}</td>
                    <td style={{ textAlign: 'right', color: '#166534' }}>{formatInr(g.spentInr)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: g.capexDeficitIndex > 70 ? '#b91c1c' : '#166534',
                        }}
                      >
                        {g.capexDeficitIndex.toFixed(0)} / 100
                      </span>
                    </td>
                    <td>
                      {g.isUnderfunded ? (
                        <span className="gov-badge badge-critical">Severe Capex Deficit</span>
                      ) : (
                        <span className="gov-badge badge-good">Capital Aligned</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {onNavigate && (
                        <button
                          className="gov-btn gov-btn-secondary"
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                          onClick={() => onNavigate('priority')}
                        >
                          <Sliders size={12} />
                          Simulate Capex
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
