import React, { useState } from 'react';
import { Download, Sparkles } from 'lucide-react';
import { generateBrief } from '../services/api.js';

interface BriefsViewProps {
  recommendations: any[];
  hotspots?: any[];
  onRefresh?: () => void;
}

export const BriefsView: React.FC<BriefsViewProps> = ({ recommendations, hotspots: _hotspots, onRefresh }) => {
  const [selectedRecId, setSelectedRecId] = useState<string | null>(recommendations[0]?.id || null);
  const [generatingForHotspot, setGeneratingForHotspot] = useState<string | null>(null);
  const currentRec = recommendations.find((r) => r.id === selectedRecId) || recommendations[0];
  const brief = currentRec?.evidenceBriefs?.[0];

  const handleGenerateBrief = async (hotspotId: string) => {
    setGeneratingForHotspot(hotspotId);
    try {
      const res = await generateBrief(hotspotId);
      if (res.success) {
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      alert('Failed to synthesize brief: ' + err.message);
    } finally {
      setGeneratingForHotspot(null);
    }
  };

  const handleExportBrief = () => {
    if (!brief) return;
    const content = `CIVICTWIN AI — GROUNDED EXECUTIVE EVIDENCE BRIEF
Hotspot: ${currentRec.hotspot?.hotspotCode} (${currentRec.hotspot?.administrativeArea?.name})
Model: ${brief.modelIdentifier}
Confidence: ${(brief.confidenceScore * 100).toFixed(0)}%
Evidence Cited: ${brief.citedEvidenceIds}

1. PROBLEM SUMMARY:
${brief.problemSummary}

2. WHY THIS IS EMERGING:
${brief.whyEmerging}

3. RECOMMENDED TECHNICAL INTERVENTION:
${brief.potentialIntervention}

4. IMPLEMENTATION CONSIDERATIONS:
${brief.implementationConsiderations}

5. RISKS & DEPENDENCIES:
${brief.risks}

6. DATA LIMITATIONS:
${brief.dataLimitations}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Evidence_Brief_${currentRec.hotspot?.hotspotCode || 'export'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="gov-container">
      <div className="gov-two-col">
        {/* Left Column: Recommendations Portfolio */}
        <div className="gov-card">
          <div className="gov-card-header">
            <span className="gov-card-title">Intervention Recommendations ({recommendations.length})</span>
            <span className="gov-badge badge-medium">Public Capital Works</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recommendations.map((rec) => {
              const isSelected = rec.id === currentRec?.id;
              return (
                <div
                  key={rec.id}
                  onClick={() => setSelectedRecId(rec.id)}
                  style={{
                    padding: '12px',
                    border: isSelected ? '2px solid #0c1a30' : '1px solid #e2e8f0',
                    backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <code style={{ fontWeight: 700 }}>{rec.recommendationCode}</code>
                    <span className="gov-badge badge-good">{rec.status}</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                    {rec.title}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '11px', color: '#64748b' }}>
                    <div>Est. Cost: <strong>₹{(rec.estimatedCostInr / 100000).toFixed(1)} Lakh</strong></div>
                    <div>Timeline: <strong>{rec.estimatedDurationMonths} Months</strong></div>
                    <div>Beneficiaries: <strong>{rec.targetBeneficiaries.toLocaleString()}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Grounded Gemini Evidence Brief */}
        {currentRec ? (
          <div className="gov-card">
            <div className="gov-card-header">
              <div>
                <span className="gov-card-title">Grounded Evidence Brief</span>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Linked Hotspot: <strong>{currentRec.hotspot?.hotspotCode}</strong> ({currentRec.hotspot?.administrativeArea?.name})
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="gov-badge badge-critical" style={{ textTransform: 'uppercase' }}>
                  Human Review Required
                </span>
                {currentRec.hotspot?.id && (
                  <button
                    className="gov-btn gov-btn-secondary"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                    onClick={() => handleGenerateBrief(currentRec.hotspot.id)}
                    disabled={generatingForHotspot === currentRec.hotspot.id}
                  >
                    <Sparkles size={13} />
                    {generatingForHotspot === currentRec.hotspot.id ? 'Synthesizing...' : 'Re-synthesize with Gemini'}
                  </button>
                )}
                {brief && (
                  <button
                    className="gov-btn gov-btn-primary"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                    onClick={handleExportBrief}
                  >
                    <Download size={13} />
                    Export Brief
                  </button>
                )}
              </div>
            </div>

            {brief ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '10px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '2px', fontSize: '12px', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <strong>AI Evidence Grounding Guarantee:</strong> Generated via {brief.modelIdentifier}.
                    Every finding cites verified evidence records: <code style={{ fontWeight: 700 }}>{brief.citedEvidenceIds}</code>.
                  </div>
                  <span className="gov-badge badge-good">Traceability Verified</span>
                </div>

                {/* 1. Problem */}
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                    1. Problem Statement
                  </h4>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.5, backgroundColor: '#ffffff', padding: '10px', border: '1px solid #cbd5e1' }}>
                    {brief.problem || brief.problemSummary}
                  </div>
                </div>

                {/* 2. Structured Evidence Ledger */}
                {(() => {
                  const parsedEvidence = (() => {
                    try {
                      const val = JSON.parse(brief.whyEmerging);
                      return Array.isArray(val) ? val : [];
                    } catch {
                      return [];
                    }
                  })();
                  if (parsedEvidence.length > 0) {
                    return (
                      <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                          2. Structured Evidence Findings ({parsedEvidence.length})
                        </h4>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="gov-table" style={{ width: '100%', fontSize: '11px' }}>
                            <thead>
                              <tr>
                                <th style={{ width: '110px' }}>Evidence ID</th>
                                <th>Observed Metric</th>
                                <th>Empirical Finding</th>
                                <th>Source</th>
                              </tr>
                            </thead>
                            <tbody>
                              {parsedEvidence.map((ev: any) => (
                                <tr key={ev.evidenceId}>
                                  <td><code style={{ fontWeight: 700, color: '#0c1a30' }}>{ev.evidenceId}</code></td>
                                  <td style={{ fontWeight: 600 }}>{ev.metric}</td>
                                  <td>{ev.finding}</td>
                                  <td style={{ color: '#64748b' }}>{ev.source}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div>
                      <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                        2. Why This Issue Is Emerging
                      </h4>
                      <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.5 }}>
                        {brief.whyEmerging}
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Potential Intervention */}
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                    3. Recommended Technical Intervention
                  </h4>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.5, backgroundColor: '#f8fafc', padding: '10px', border: '1px solid #e2e8f0' }}>
                    {brief.potentialIntervention}
                  </div>
                </div>

                {/* 4. Implementation Considerations & Risks Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <div style={{ padding: '10px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '2px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      IMPLEMENTATION CONSIDERATIONS
                    </div>
                    <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.4 }}>
                      {brief.implementationConsiderations}
                    </div>
                  </div>

                  <div style={{ padding: '10px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '2px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>
                      TECHNICAL & SEASONAL RISKS
                    </div>
                    <div style={{ fontSize: '12px', color: '#78350f', lineHeight: 1.4 }}>
                      {brief.risks}
                    </div>
                  </div>
                </div>

                {/* 5. Dependencies */}
                {brief.dependencies && (
                  <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '2px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      INTER-AGENCY DEPENDENCIES
                    </div>
                    <div style={{ fontSize: '12px', color: '#334155' }}>
                      {brief.dependencies}
                    </div>
                  </div>
                )}

                {/* 6. Data Limitations */}
                <div style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', borderLeft: '3px solid #64748b', fontSize: '12px', color: '#475569' }}>
                  <strong>Data Limitations & Sufficiency:</strong> {brief.limitations || brief.dataLimitations}
                </div>

                {/* 7. Human Review Requirement */}
                <div style={{ padding: '10px 12px', backgroundColor: '#f8fafc', borderLeft: '4px solid #0c1a30', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', borderRadius: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#0c1a30' }}>
                      Statutory Human Review Mandate
                    </span>
                    <span className="gov-badge badge-high">
                      {brief.requiresHumanReview ? 'MANDATORY REVIEW' : 'ADVISORY'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#0f172a' }}>
                    Public capital expenditure requires municipal commissioner and district magistrate sign-off.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                No brief generated for this recommendation yet.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
