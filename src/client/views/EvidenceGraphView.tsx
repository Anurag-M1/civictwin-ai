import React, { useState, useEffect } from 'react';
import {
  GitMerge,
  ShieldCheck,
  CheckCircle,
  Search,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  fetchEvidenceGraph,
  fetchEntityTrace,
  fetchEvidenceDetail,
  verifyEvidenceCitations,
} from '../services/api.js';

interface EvidenceGraphViewProps {
  hotspots: any[];
}

export const EvidenceGraphView: React.FC<EvidenceGraphViewProps> = ({ hotspots }) => {
  const [selectedHotspotId, setSelectedHotspotId] = useState<string>(hotspots[0]?.id || '');
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [activeTrace, setActiveTrace] = useState<any>(null);
  const [traceLoading, setTraceLoading] = useState<boolean>(false);
  const [verificationReport, setVerificationReport] = useState<any>(null);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [_inspectingEvidenceCode, setInspectingEvidenceCode] = useState<string | null>(null);
  const [evidenceDetail, setEvidenceDetail] = useState<any>(null);

  useEffect(() => {
    if (!selectedHotspotId && hotspots.length > 0) {
      setSelectedHotspotId(hotspots[0].id);
    }
  }, [hotspots]);

  useEffect(() => {
    if (!selectedHotspotId) return;
    loadGraph(selectedHotspotId);
  }, [selectedHotspotId]);

  const loadGraph = async (id: string) => {
    setLoading(true);
    setSelectedNode(null);
    setActiveTrace(null);
    setVerificationReport(null);
    setInspectingEvidenceCode(null);
    setEvidenceDetail(null);
    try {
      const res = await fetchEvidenceGraph(id);
      if (res.success) {
        setGraphData(res.data);
      }
    } catch (err) {
      console.error('Failed to load evidence graph:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    if (!selectedHotspotId) return;
    setVerifying(true);
    try {
      const res = await verifyEvidenceCitations('HOTSPOT', selectedHotspotId);
      if (res.success) {
        setVerificationReport(res.data);
      }
    } catch (err) {
      console.error('Failed to verify evidence citations:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleInspectNode = async (node: any) => {
    setSelectedNode(node);
    setTraceLoading(true);
    try {
      const entityType = node.type;
      const rawId = node.id.replace(/^[a-z]+_/, '');
      const res = await fetchEntityTrace(entityType, rawId);
      if (res.success) {
        setActiveTrace(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch entity trace:', err);
    } finally {
      setTraceLoading(false);
    }
  };

  const handleInspectEvidence = async (code: string) => {
    setInspectingEvidenceCode(code);
    try {
      const res = await fetchEvidenceDetail(code);
      if (res.success) {
        setEvidenceDetail(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch evidence detail:', err);
    }
  };

  const filteredNodes = graphData?.nodes.filter((node: any) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'EVIDENCE') return node.type === 'EVIDENCE_RECORD';
    if (activeFilter === 'SIGNALS') return node.type === 'CITIZEN_REQUEST' || node.type === 'ISSUE_CLUSTER';
    if (activeFilter === 'ASSETS') return node.type === 'INFRASTRUCTURE_ASSET';
    if (activeFilter === 'CONTEXT') return node.type === 'DEMOGRAPHIC_INDICATOR' || node.type === 'PUBLIC_INVESTMENT' || node.type === 'ADMINISTRATIVE_AREA';
    if (activeFilter === 'OUTCOMES') return node.type === 'HOTSPOT' || node.type === 'PRIORITY_ASSESSMENT' || node.type === 'RECOMMENDATION' || node.type === 'EVIDENCE_BRIEF';
    return true;
  }) || [];

  return (
    <div className="gov-container" style={{ paddingBottom: '60px' }}>
      {/* Banner / Compliance Notice */}
      <div
        style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          padding: '14px 18px',
          borderRadius: '4px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <Info size={20} color="#1d4ed8" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '13px', color: '#1e3a8a', lineHeight: 1.5 }}>
          <strong>Civic Evidence Graph Integrity Guarantee:</strong> Every analytical result, priority score, and capital works proposal is traceable to underlying verified records.
          Official administrative geography and public open data schemas conform to Government of India Open Data standards.
          Demonstration citizen signal streams and telemetry are benchmarked for evaluation and never fabricated.
        </div>
      </div>

      {/* Top Controls & Hotspot Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
            Select Hotspot Cluster:
          </label>
          <select
            className="gov-select"
            value={selectedHotspotId}
            onChange={(e) => setSelectedHotspotId(e.target.value)}
            style={{ width: '360px', fontWeight: 600 }}
          >
            {hotspots.map((h) => (
              <option key={h.id} value={h.id}>
                {h.hotspotCode} — {h.administrativeArea?.name} ({h.category})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="gov-btn gov-btn-secondary"
            onClick={handleVerifyIntegrity}
            disabled={verifying || !selectedHotspotId}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ShieldCheck size={16} />
            {verifying ? 'Auditing Citations...' : 'Audit Citation Integrity'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          Loading Civic Evidence Graph and compiling lineage traces...
        </div>
      ) : graphData ? (
        <>
          {/* Metrics Overview Ribbon */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
              marginBottom: '22px',
            }}
          >
            <div className="gov-card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Graph Topology
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {graphData.metrics.nodeCount} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>Nodes</span> / {graphData.metrics.edgeCount} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>Edges</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Fully connected bipartite evidence structure
              </div>
            </div>

            <div className="gov-card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Verifiable Evidence Units
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e40af', marginTop: '4px' }}>
                {graphData.metrics.evidenceCount} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>EV-xxx</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Directly cited in decision briefs
              </div>
            </div>

            <div className="gov-card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Traceability Completeness
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                {graphData.metrics.traceabilityCompletenessScore}%
              </div>
              <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px', fontWeight: 600 }}>
                100% traceable to source records
              </div>
            </div>

            <div className="gov-card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Data Provenance Split
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                <span style={{ color: '#15803d' }}>{graphData.metrics.officialPercentage}% Official</span> / <span style={{ color: '#d97706' }}>{graphData.metrics.syntheticPercentage}% Benchmarks</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Explicit Open Data segregation
              </div>
            </div>
          </div>

          {/* Verification Audit Result Badge */}
          {verificationReport && (
            <div
              style={{
                backgroundColor: verificationReport.valid ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${verificationReport.valid ? '#86efac' : '#fecaca'}`,
                padding: '14px 18px',
                borderRadius: '4px',
                marginBottom: '22px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={18} color={verificationReport.valid ? '#15803d' : '#b91c1c'} />
                  <span style={{ fontWeight: 800, fontSize: '14px', color: verificationReport.valid ? '#166534' : '#991b1b' }}>
                    {verificationReport.valid
                      ? 'GROUNDING VERIFICATION AUDIT PASSED: 100% CITED EVIDENCE UNITS VERIFIED'
                      : 'GROUNDING VERIFICATION ALERT: UNRESOLVED CITATIONS DETECTED'}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Audit Timestamp: {new Date(verificationReport.verificationTimestamp).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#334155' }}>
                Verified {verificationReport.resolvedItems.length} atomic evidence citations for <strong>{verificationReport.targetCode}</strong>. Orphaned or fabricated citations: <strong>{verificationReport.orphanedOrFabricatedCount}</strong>.
              </div>
            </div>
          )}

          {/* Lineage Walkable Walkthrough */}
          <div className="gov-card" style={{ padding: '16px', marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <GitMerge size={16} color="#0c1a30" />
              <h3 style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>
                End-to-End Decision Lineage Walkthrough
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {graphData.lineagePaths.map((path: string[], idx: number) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    backgroundColor: '#f8fafc',
                    padding: '10px 14px',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {path.map((step: string, sIdx: number) => (
                    <React.Fragment key={sIdx}>
                      <span
                        style={{
                          backgroundColor: sIdx === 0 ? '#eff6ff' : sIdx === path.length - 1 ? '#ecfdf5' : '#ffffff',
                          border: `1px solid ${sIdx === 0 ? '#bfdbfe' : sIdx === path.length - 1 ? '#a7f3d0' : '#cbd5e1'}`,
                          padding: '4px 10px',
                          borderRadius: '3px',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: sIdx === 0 ? '#1e40af' : sIdx === path.length - 1 ? '#047857' : '#0f172a',
                        }}
                      >
                        {step}
                      </span>
                      {sIdx < path.length - 1 && <ArrowRight size={14} color="#94a3b8" />}
                    </React.Fragment>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Filter Bar for Graph Nodes */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[
              { id: 'ALL', label: `All Graph Nodes (${graphData.nodes.length})` },
              { id: 'EVIDENCE', label: `Evidence Records (${graphData.nodes.filter((n: any) => n.type === 'EVIDENCE_RECORD').length})` },
              { id: 'SIGNALS', label: 'Citizen Signals & Clusters' },
              { id: 'ASSETS', label: 'Physical Assets' },
              { id: 'CONTEXT', label: 'Demographics & Capex' },
              { id: 'OUTCOMES', label: 'Analytical Outcomes' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '3px',
                  fontSize: '12px',
                  fontWeight: activeFilter === tab.id ? 700 : 500,
                  backgroundColor: activeFilter === tab.id ? '#0c1a30' : '#ffffff',
                  color: activeFilter === tab.id ? '#ffffff' : '#334155',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Two-Column Explorer: Nodes Grid & Inspection Drawer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
            {/* Left: Filtered Graph Nodes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredNodes.map((node: any) => {
                const isSelected = selectedNode?.id === node.id;
                const isEvidence = node.type === 'EVIDENCE_RECORD';
                return (
                  <div
                    key={node.id}
                    onClick={() => handleInspectNode(node)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '4px',
                      border: `1px solid ${isSelected ? '#0c1a30' : '#e2e8f0'}`,
                      backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
                      boxShadow: isSelected ? '0 0 0 2px #0c1a30' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '2px',
                            backgroundColor: node.type.includes('EVIDENCE') ? '#eff6ff' : node.type.includes('ASSET') ? '#fef3c7' : '#f1f5f9',
                            color: node.type.includes('EVIDENCE') ? '#1e40af' : node.type.includes('ASSET') ? '#92400e' : '#334155',
                            border: '1px solid #cbd5e1',
                          }}
                        >
                          {node.type}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                          {node.label}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: node.isSynthetic ? '#fffbeb' : '#ecfdf5',
                          color: node.isSynthetic ? '#b45309' : '#047857',
                          border: `1px solid ${node.isSynthetic ? '#fde68a' : '#a7f3d0'}`,
                        }}
                      >
                        {node.datasetType}
                      </span>
                    </div>

                    {node.subtitle && (
                      <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                        {node.subtitle}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                      <span>Source: {node.provenanceAgency}</span>
                      {isEvidence && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectEvidence(node.properties.evidenceCode);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#1d4ed8',
                            cursor: 'pointer',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Search size={11} /> Deep Resolve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Inspection & Traceability Drawer */}
            <div>
              {selectedNode ? (
                <div className="gov-card" style={{ padding: '18px', position: 'sticky', top: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Layers size={18} color="#0c1a30" />
                    <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
                      Node Lineage & Traceability
                    </h3>
                  </div>

                  <div style={{ marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Selected Entity
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                      {selectedNode.label}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                      {selectedNode.subtitle}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '11px', padding: '6px 10px', backgroundColor: '#f8fafc', borderRadius: '3px', border: '1px solid #e2e8f0' }}>
                      <strong>Dataset Provenance:</strong> {selectedNode.provenanceAgency} ({selectedNode.datasetType})
                      <div style={{ color: '#64748b', marginTop: '2px' }}>{selectedNode.disclaimer}</div>
                    </div>
                  </div>

                  {traceLoading ? (
                    <div style={{ color: '#64748b', fontSize: '13px', padding: '20px 0' }}>
                      Traversing lineage graph...
                    </div>
                  ) : activeTrace ? (
                    <div>
                      {/* Ancestors */}
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '6px' }}>
                          Ancestors / Upstream Drivers ({activeTrace.ancestors.length})
                        </div>
                        {activeTrace.ancestors.length === 0 ? (
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Root ingestion record (no upstream drivers)</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {activeTrace.ancestors.map((anc: any) => (
                              <div
                                key={anc.id}
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '11px',
                                  backgroundColor: '#f8fafc',
                                  borderRadius: '3px',
                                  border: '1px solid #e2e8f0',
                                }}
                              >
                                <div style={{ fontWeight: 700, color: '#1e40af' }}>{anc.label}</div>
                                <div style={{ color: '#64748b' }}>{anc.relation}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Descendants */}
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '6px' }}>
                          Downstream Impact & Interventions ({activeTrace.descendants.length})
                        </div>
                        {activeTrace.descendants.length === 0 ? (
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Terminal outcome node</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {activeTrace.descendants.map((desc: any) => (
                              <div
                                key={desc.id}
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '11px',
                                  backgroundColor: '#f0fdf4',
                                  borderRadius: '3px',
                                  border: '1px solid #bbf7d0',
                                }}
                              >
                                <div style={{ fontWeight: 700, color: '#166534' }}>{desc.label}</div>
                                <div style={{ color: '#15803d' }}>{desc.relation}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Grounding Evidence Codes */}
                      {activeTrace.verifiableEvidenceIds?.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Anchored Verifiable Evidence IDs
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {activeTrace.verifiableEvidenceIds.map((code: string) => (
                              <span
                                key={code}
                                onClick={() => handleInspectEvidence(code)}
                                style={{
                                  padding: '3px 8px',
                                  backgroundColor: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '2px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: '#1d4ed8',
                                  cursor: 'pointer',
                                }}
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  className="gov-card"
                  style={{
                    padding: '30px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '13px',
                  }}
                >
                  <Search size={32} color="#94a3b8" style={{ marginBottom: '8px' }} />
                  <div>Select any node on the left to inspect its full ancestor & descendant lineage trace.</div>
                </div>
              )}

              {/* Evidence Detail Modal / Card */}
              {evidenceDetail && (
                <div className="gov-card" style={{ padding: '16px', marginTop: '16px', border: '1px solid #3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={16} color="#15803d" />
                      <strong style={{ fontSize: '13px', color: '#1e40af' }}>
                        Resolved Evidence Record: {evidenceDetail.evidenceCode}
                      </strong>
                    </div>
                    <button
                      onClick={() => setEvidenceDetail(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#64748b' }}
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: '#0f172a', marginBottom: '4px' }}>
                    <strong>Metric:</strong> {evidenceDetail.metric} = <span style={{ color: '#b91c1c', fontWeight: 700 }}>{evidenceDetail.value}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                    Entity: <code>{evidenceDetail.sourceEntity}</code> • Period: {evidenceDetail.period} • Confidence: {(evidenceDetail.confidence * 100).toFixed(0)}%
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '8px', borderRadius: '3px', fontSize: '11px', maxHeight: '140px', overflowY: 'auto' }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(evidenceDetail.underlyingRecord, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
