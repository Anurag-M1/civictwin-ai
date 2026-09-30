import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Search,
  Filter,
  Eye,
  X,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { updateRecommendationStatus, generateBrief } from '../services/api.js';

interface RecommendationsViewProps {
  recommendations: any[];
  hotspots?: any[];
  onRefresh?: () => void;
  onNavigate?: (tab: string) => void;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  recommendations,
  hotspots: _hotspots,
  onRefresh,
  onNavigate: _onNavigate,
}) => {
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Selected recommendation for review / brief modal
  const [selectedRec, setSelectedRec] = useState<any | null>(null);
  const [actionStatus, setActionStatus] = useState<'APPROVED' | 'MODIFIED' | 'REJECTED' | 'UNDER_REVIEW'>('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewerRole, setReviewerRole] = useState<'COMMISSIONER' | 'ANALYST' | 'FIELD_OFFICER'>('COMMISSIONER');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);

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
      case 'APPROVED':
        return <span className="gov-badge badge-good">Approved for Tendering</span>;
      case 'UNDER_REVIEW':
        return <span className="gov-badge badge-medium">Under Review</span>;
      case 'PROPOSED':
        return <span className="gov-badge badge-warning">Proposed</span>;
      case 'REJECTED':
        return <span className="gov-badge badge-critical">Rejected</span>;
      default:
        return <span className="gov-badge badge-medium">{status}</span>;
    }
  };

  const filteredRecs = recommendations.filter((r) => {
    if (selectedStatus && r.status !== selectedStatus) return false;
    if (selectedCategory && r.hotspot?.category !== selectedCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.recommendationCode.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.hotspot?.administrativeArea?.name && r.hotspot.administrativeArea.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // KPI metrics
  const totalCount = recommendations.length;
  const approvedCount = recommendations.filter((r) => r.status === 'APPROVED').length;
  const pendingCount = recommendations.filter((r) => r.status === 'PROPOSED' || r.status === 'UNDER_REVIEW').length;
  const totalCapexInr = recommendations.reduce((sum, r) => sum + (r.estimatedCostInr || 0), 0);
  const totalBeneficiaries = recommendations.reduce((sum, r) => sum + (r.targetBeneficiaries || 0), 0);

  const handleSubmitReview = async () => {
    if (!selectedRec) return;
    setSubmittingReview(true);
    try {
      const res = await updateRecommendationStatus(
        selectedRec.id,
        actionStatus,
        reviewNotes,
        reviewerRole,
      );
      if (res.success) {
        setSelectedRec(null);
        setReviewNotes('');
        if (onRefresh) onRefresh();
      } else {
        alert(res.error || 'Failed to submit human review decision');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleGenerateBrief = async (hotspotId: string) => {
    setGeneratingBrief(true);
    try {
      const res = await generateBrief(hotspotId);
      if (res.success) {
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      alert('Error generating brief: ' + err.message);
    } finally {
      setGeneratingBrief(false);
    }
  };

  const handleExportBrief = (rec: any) => {
    const b = rec?.evidenceBriefs?.[0];
    if (!b) return;
    const content = `CIVICTWIN AI — GROUNDED EXECUTIVE EVIDENCE BRIEF
Recommendation: ${rec.recommendationCode} — ${rec.title}
Target Jurisdiction: ${rec.hotspot?.administrativeArea?.name}
Hotspot: ${rec.hotspot?.hotspotCode}
Estimated Cost: ₹${(rec.estimatedCostInr / 100000).toFixed(1)} Lakh
Beneficiaries: ${rec.targetBeneficiaries?.toLocaleString()}
Model Identifier: ${b.modelIdentifier}
Confidence: ${(b.confidenceScore * 100).toFixed(0)}%
Evidence Cited: ${b.citedEvidenceIds}

1. PROBLEM SUMMARY:
${b.problemSummary}

2. WHY THIS IS EMERGING:
${b.whyEmerging}

3. RECOMMENDED TECHNICAL INTERVENTION:
${b.potentialIntervention}

4. IMPLEMENTATION CONSIDERATIONS:
${b.implementationConsiderations}

5. RISKS & DEPENDENCIES:
${b.risks}

6. DATA LIMITATIONS:
${b.dataLimitations}
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Evidence_Brief_${rec.recommendationCode}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="gov-container">
      {/* Title & Description */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0c1a30', marginBottom: '4px' }}>
          DPI Project Recommendations & Human Governance Review
        </h2>
        <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
          High-priority capital works and infrastructure interventions synthesized from grounded citizen signals and verified open data, subject to mandatory human municipal approval.
        </p>
      </div>

      {/* Summary KPI Strip */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Interventions Proposed</span>
            <span className="gov-badge badge-medium">DPI Portfolio</span>
          </div>
          <div className="stat-value">{totalCount}</div>
          <div className="stat-subtext">Synthesized from validated citizen hotspots</div>
        </div>

        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Approved for Tendering</span>
            <CheckCircle2 size={16} color="#166534" />
          </div>
          <div className="stat-value" style={{ color: '#166534' }}>{approvedCount}</div>
          <div className="stat-subtext">Passed commissioner human governance review</div>
        </div>

        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Pending Governance Review</span>
            <Clock size={16} color="#d97706" />
          </div>
          <div className="stat-value" style={{ color: '#d97706' }}>{pendingCount}</div>
          <div className="stat-subtext">Awaiting administrative sanction decision</div>
        </div>

        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Total Capital Demand</span>
            <DollarSign size={16} color="#0c1a30" />
          </div>
          <div className="stat-value" style={{ color: '#0c1a30' }}>{formatInr(totalCapexInr)}</div>
          <div className="stat-subtext">Benefiting {totalBeneficiaries.toLocaleString()} citizens</div>
        </div>
      </div>

      {/* Filter Bar */}
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
            placeholder="Search recommendation code, title, or ward..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} color="#64748b" />
          <select
            className="gov-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', minWidth: '130px' }}
          >
            <option value="">All Review Statuses</option>
            <option value="PROPOSED">Proposed</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select
            className="gov-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', minWidth: '130px' }}
          >
            <option value="">All Sectors</option>
            <option value="Roads">Roads & Transport</option>
            <option value="Water">Water Infrastructure</option>
            <option value="Sanitation">Sanitation</option>
            <option value="Healthcare">Healthcare</option>
          </select>
        </div>

        {(search || selectedStatus || selectedCategory) && (
          <button
            className="gov-btn gov-btn-secondary"
            style={{ padding: '6px 10px', fontSize: '12px' }}
            onClick={() => {
              setSearch('');
              setSelectedStatus('');
              setSelectedCategory('');
            }}
          >
            <RotateCcw size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Recommendations Table */}
      <div className="gov-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0c1a30' }}>
            Recommended Interventions Registry ({filteredRecs.length} Projects)
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Multi-Criteria Decision Analysis & Grounded Evidence Briefs
          </span>
        </div>

        <div className="gov-table-container" style={{ border: 'none' }}>
          <table className="gov-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Project Title & Scope</th>
                <th>Sector</th>
                <th>Jurisdiction</th>
                <th style={{ textAlign: 'right' }}>Est. Capex</th>
                <th style={{ textAlign: 'center' }}>Duration</th>
                <th style={{ textAlign: 'right' }}>Beneficiaries</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecs.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No project recommendations match the specified criteria.
                  </td>
                </tr>
              ) : (
                filteredRecs.map((rec) => (
                  <tr key={rec.id}>
                    <td>
                      <code style={{ fontSize: '12px', fontWeight: 700, color: '#0c1a30' }}>
                        {rec.recommendationCode}
                      </code>
                    </td>
                    <td style={{ maxWidth: '300px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{rec.title}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {rec.summary}
                      </div>
                    </td>
                    <td>
                      <span className="gov-badge badge-medium">
                        {rec.hotspot?.category || 'Urban Infrastructure'}
                      </span>
                    </td>
                    <td>
                      <div>{rec.hotspot?.administrativeArea?.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        State: {rec.hotspot?.administrativeArea?.stateCode}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0c1a30' }}>
                      {formatInr(rec.estimatedCostInr)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '12px' }}>
                      {rec.estimatedDurationMonths} mos
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {rec.targetBeneficiaries?.toLocaleString()}
                    </td>
                    <td>{getStatusBadge(rec.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="gov-btn gov-btn-primary"
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                          onClick={() => setSelectedRec(rec)}
                        >
                          <Eye size={12} />
                          Review & Brief
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Human Review & Evidence Brief Modal */}
      {selectedRec && (
        <div className="gov-modal-overlay" onClick={() => setSelectedRec(null)}>
          <div className="gov-modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className="gov-modal-header">
              <div>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>
                  Project Review Dossier — {selectedRec.recommendationCode}
                </span>
                <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                  {selectedRec.title}
                </div>
              </div>
              <button
                onClick={() => setSelectedRec(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="gov-modal-body">
              {/* Project Snapshot Grid */}
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
                  <div style={{ color: '#64748b', fontSize: '11px' }}>ESTIMATED OUTLAY</div>
                  <div style={{ fontWeight: 700, color: '#0c1a30' }}>{formatInr(selectedRec.estimatedCostInr)}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>DURATION</div>
                  <div style={{ fontWeight: 600 }}>{selectedRec.estimatedDurationMonths} Months</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>BENEFICIARIES</div>
                  <div style={{ fontWeight: 600 }}>{selectedRec.targetBeneficiaries?.toLocaleString()} Citizens</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>CURRENT STATUS</div>
                  <div>{getStatusBadge(selectedRec.status)}</div>
                </div>
              </div>

              {/* Grounded Evidence Brief Card */}
              {selectedRec.evidenceBriefs?.[0] ? (
                <div
                  style={{
                    padding: '14px',
                    border: '1px solid #bfdbfe',
                    backgroundColor: '#eff6ff',
                    borderRadius: '4px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={16} color="#1e40af" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a8a' }}>
                        Grounded Executive Evidence Brief
                      </span>
                    </div>
                    <button
                      className="gov-btn gov-btn-secondary"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={() => handleExportBrief(selectedRec)}
                    >
                      <Download size={12} />
                      Export Brief
                    </button>
                  </div>

                  <div style={{ fontSize: '12px', color: '#1e293b', marginBottom: '8px', lineHeight: '1.5' }}>
                    <strong>Problem Summary:</strong> {selectedRec.evidenceBriefs[0].problemSummary}
                  </div>

                  <div style={{ fontSize: '12px', color: '#1e293b', marginBottom: '8px', lineHeight: '1.5' }}>
                    <strong>Technical Solution:</strong> {selectedRec.evidenceBriefs[0].potentialIntervention}
                  </div>

                  <div style={{ fontSize: '12px', color: '#1e293b', marginBottom: '8px', lineHeight: '1.5' }}>
                    <strong>Risks & Dependencies:</strong> {selectedRec.evidenceBriefs[0].risks}
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                    Evidence Cited: <code style={{ fontSize: '10px' }}>{selectedRec.evidenceBriefs[0].citedEvidenceIds}</code>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '14px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '3px',
                    textAlign: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                    No synthesized evidence brief attached to this recommendation yet.
                  </div>
                  {selectedRec.hotspotId && (
                    <button
                      className="gov-btn gov-btn-primary"
                      style={{ fontSize: '12px' }}
                      onClick={() => handleGenerateBrief(selectedRec.hotspotId)}
                      disabled={generatingBrief}
                    >
                      <Sparkles size={14} />
                      {generatingBrief ? 'Synthesizing Grounded Brief...' : 'Synthesize Evidence Brief with AI'}
                    </button>
                  )}
                </div>
              )}

              {/* Human Governance Review Decision Box */}
              <div
                style={{
                  padding: '14px',
                  border: '2px solid #0c1a30',
                  borderRadius: '4px',
                  backgroundColor: '#ffffff',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0c1a30', marginBottom: '10px' }}>
                  Human Governance Approval & Audit Sign-Off
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label className="gov-label" style={{ fontSize: '11px' }}>Governance Decision:</label>
                    <select
                      className="gov-select"
                      value={actionStatus}
                      onChange={(e) => setActionStatus(e.target.value as any)}
                      style={{ fontSize: '12px', padding: '6px' }}
                    >
                      <option value="APPROVED">APPROVE for Municipal Tendering</option>
                      <option value="MODIFIED">MODIFY Project Scope / Budget</option>
                      <option value="REJECTED">REJECT Intervention</option>
                      <option value="UNDER_REVIEW">Hold for Technical Ground Inspection</option>
                    </select>
                  </div>

                  <div>
                    <label className="gov-label" style={{ fontSize: '11px' }}>Reviewer Official Role:</label>
                    <select
                      className="gov-select"
                      value={reviewerRole}
                      onChange={(e) => setReviewerRole(e.target.value as any)}
                      style={{ fontSize: '12px', padding: '6px' }}
                    >
                      <option value="COMMISSIONER">Municipal Commissioner</option>
                      <option value="ANALYST">Senior Urban Policy Analyst</option>
                      <option value="FIELD_OFFICER">Executive Engineer / Field Officer</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label className="gov-label" style={{ fontSize: '11px' }}>Official Decision Rationale & Engineering Notes:</label>
                  <textarea
                    className="gov-textarea"
                    placeholder="Enter formal justification for municipal tender approval or modification notes..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    style={{ minHeight: '60px', fontSize: '12px' }}
                  />
                </div>

                <button
                  className="gov-btn gov-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '13px' }}
                  onClick={handleSubmitReview}
                  disabled={submittingReview}
                >
                  <CheckCircle2 size={15} />
                  {submittingReview ? 'Submitting Governance Record...' : 'Confirm Official Governance Decision'}
                </button>
              </div>
            </div>

            <div className="gov-modal-footer">
              <button
                className="gov-btn gov-btn-secondary"
                onClick={() => setSelectedRec(null)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
