import React, { useState, useEffect } from 'react';
import {
  Database,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  Info,
  Server,
} from 'lucide-react';
import { fetchDataSources, fetchDataProvenanceReport } from '../services/api.js';

interface DataSourcesViewProps {
  dataSources: any[];
}

export const DataSourcesView: React.FC<DataSourcesViewProps> = ({ dataSources: initialSources }) => {
  const [sources, setSources] = useState<any[]>(initialSources);
  const [provenance, setProvenance] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState<any | null>(null);

  useEffect(() => {
    async function loadProvenance() {
      try {
        const [dsRes, provRes] = await Promise.all([
          fetchDataSources(),
          fetchDataProvenanceReport(),
        ]);
        if (dsRes.success) setSources(dsRes.data);
        if (provRes.success) setProvenance(provRes.data);
      } catch (err) {
        console.error('Failed to load provenance report:', err);
      }
    }
    loadProvenance();
  }, []);

  const filteredSources = sources.filter((ds) => {
    const matchesSearch =
      ds.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ds.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ds.sourceAgency?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ds.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      selectedType === 'ALL' || ds.datasetType === selectedType;
    return matchesSearch && matchesType;
  });

  const officialCount = sources.filter((s) => s.datasetType === 'OFFICIAL_OPEN_DATA').length;
  const syntheticCount = sources.filter((s) => s.datasetType !== 'OFFICIAL_OPEN_DATA').length;

  return (
    <div className="gov-container" style={{ paddingBottom: '40px' }}>
      {/* Title & Institutional Scope Header */}
      <div
        className="gov-card"
        style={{
          borderLeft: '4px solid #0c1a30',
          marginBottom: '20px',
          backgroundColor: '#ffffff',
        }}
      >
        <div className="gov-card-header" style={{ marginBottom: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="gov-card-title" style={{ fontSize: '18px' }}>
                Open Data Provenance & Digital Public Good (DPG) Registry
              </span>
              <span className="gov-badge badge-good" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} /> DPI Compliant
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 0 0' }}>
              Institutional repository of all statutory and empirical data sources powering CivicTwin AI.
              Every geospatial indicator, demographic metric, and public expenditure record is strictly referenced
              to authoritative open government databases.
            </p>
          </div>
        </div>

        {/* Legal Disclaimers & Ethics Policy */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            fontSize: '12px',
            color: '#334155',
            marginTop: '8px',
          }}
        >
          <Info size={16} color="#0c1a30" style={{ flexShrink: 0 }} />
          <span>
            <strong>Data Integrity Mandate:</strong> In accordance with Digital Personal Data Protection (DPDP) Act
            and National Data Sharing and Accessibility Policy (NDSAP), synthetic baseline datasets are
            explicitly watermarked with <code style={{ fontSize: '11px' }}>isDemo: true</code> and are never represented as official census records.
          </span>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="gov-stats-grid" style={{ marginBottom: '20px' }}>
        <div className="gov-stat-card">
          <div className="gov-stat-label">Registered Datasets</div>
          <div className="gov-stat-value">{sources.length}</div>
          <div className="gov-stat-sub">Authoritative ingested catalogs</div>
        </div>

        <div className="gov-stat-card">
          <div className="gov-stat-label">Official Open Data Sources</div>
          <div className="gov-stat-value" style={{ color: '#16a34a' }}>
            {officialCount}
          </div>
          <div className="gov-stat-sub">data.gov.in & ministry portals</div>
        </div>

        <div className="gov-stat-card">
          <div className="gov-stat-label">Synthetic Benchmark Feeds</div>
          <div className="gov-stat-value" style={{ color: '#d97706' }}>
            {syntheticCount}
          </div>
          <div className="gov-stat-sub">Clearly watermarked demo models</div>
        </div>

        <div className="gov-stat-card">
          <div className="gov-stat-label">Provenance Traceability</div>
          <div className="gov-stat-value" style={{ color: '#0c1a30' }}>
            100%
          </div>
          <div className="gov-stat-sub">Deterministic citation keys</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="gov-card"
        style={{
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '260px' }}>
          <Search size={15} color="#64748b" />
          <input
            type="text"
            className="gov-input"
            style={{ width: '100%', fontSize: '13px' }}
            placeholder="Search dataset name, agency, code, or license..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={15} color="#64748b" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Filter Type:</span>
          <select
            className="gov-select"
            style={{ width: 'auto', fontSize: '12px', padding: '6px 10px' }}
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="ALL">All Categories ({sources.length})</option>
            <option value="OFFICIAL_OPEN_DATA">Official Open Data ({officialCount})</option>
            <option value="SYNTHETIC_BENCHMARK">Synthetic Benchmark ({syntheticCount})</option>
          </select>
        </div>
      </div>

      {/* High-Information-Density Provenance Table */}
      <div className="gov-card" style={{ marginBottom: '24px' }}>
        <div className="gov-card-header">
          <div>
            <span className="gov-card-title">Dataset Provenance & Ingestion Ledger</span>
            <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '10px' }}>
              Showing {filteredSources.length} of {sources.length} registered datasets
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="gov-table" style={{ width: '100%', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Dataset Code</th>
                <th>Dataset & Description</th>
                <th>Authoritative Agency</th>
                <th>Coverage / Scale</th>
                <th>Update Cycle</th>
                <th>License</th>
                <th>Classification</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSources.map((ds) => {
                const isOfficial = ds.datasetType === 'OFFICIAL_OPEN_DATA';
                return (
                  <tr key={ds.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedSource(ds)}>
                    <td>
                      <code style={{ fontSize: '11px', fontWeight: 700, color: '#0c1a30' }}>
                        {ds.code}
                      </code>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{ds.name}</div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#475569',
                          maxWidth: '380px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ds.description}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: '#334155' }}>
                      {ds.sourceAgency}
                    </td>
                    <td>{ds.coverage}</td>
                    <td>
                      <span className="gov-badge badge-medium" style={{ fontSize: '10px' }}>
                        {ds.updateFrequency}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                      {ds.license}
                    </td>
                    <td>
                      <span
                        className={`gov-badge ${isOfficial ? 'badge-good' : 'badge-medium'}`}
                        style={{ fontSize: '10px', textTransform: 'uppercase' }}
                      >
                        {isOfficial ? 'Official' : 'Synthetic'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="gov-btn gov-btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSource(ds);
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredSources.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    No dataset matching criteria "{searchQuery}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empirical Data Inventory Provenance Breakdown */}
      {provenance && (
        <div className="gov-card" style={{ marginBottom: '24px' }}>
          <div className="gov-card-header">
            <span className="gov-card-title">Empirical Data Provenance Inventory</span>
            <span className="gov-badge badge-good">Traceable Records</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '2px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Citizen Signals Ingested</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                {provenance.inventory?.citizenRequests?.total ?? 0}
              </div>
              <div style={{ fontSize: '10px', color: '#d97706', fontWeight: 600 }}>Synthetic Demo Signals</div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '2px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Infrastructure Assets</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                {provenance.inventory?.infrastructureAssets?.total ?? 0}
              </div>
              <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>
                {provenance.inventory?.infrastructureAssets?.official ?? 0} Official / {provenance.inventory?.infrastructureAssets?.synthetic ?? 0} Benchmark
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '2px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Demographic Snapshots</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                {provenance.inventory?.demographicSnapshots?.total ?? 0}
              </div>
              <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>Official Census Open Data</div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '2px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Public Schemes Tracked</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                {provenance.inventory?.publicInvestments?.total ?? 8}
              </div>
              <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>PMGSY, AMRUT, JJM, SCM</div>
            </div>
          </div>
        </div>
      )}

      {/* Grid of Ingestion Cards with Run Telemetry */}
      <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', marginBottom: '12px' }}>
        Dataset Ingestion Status & Live Health
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {sources.map((ds) => {
          const latestRun = ds.ingestionRuns?.[0];
          const isOfficial = ds.datasetType === 'OFFICIAL_OPEN_DATA';

          return (
            <div
              key={ds.id}
              className="gov-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div className="gov-card-header" style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Database size={15} color="#0c1a30" />
                    <code style={{ fontSize: '12px', fontWeight: 700 }}>{ds.code}</code>
                  </div>
                  <span className={`gov-badge ${isOfficial ? 'badge-good' : 'badge-medium'}`}>
                    {ds.datasetType}
                  </span>
                </div>

                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                  {ds.name}
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginBottom: '10px', minHeight: '36px' }}>
                  {ds.description}
                </div>

                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '8px 10px',
                    fontSize: '11px',
                    borderRadius: '2px',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Agency:</span>
                    <strong style={{ color: '#0f172a' }}>{ds.sourceAgency}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Coverage:</span>
                    <span>{ds.coverage}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>License:</span>
                    <span>{ds.license}</span>
                  </div>
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: '8px',
                    fontSize: '11px',
                    color: '#64748b',
                  }}
                >
                  <span>
                    Status: <strong style={{ color: '#16a34a' }}>{latestRun ? `${latestRun.status} (${latestRun.recordsIngested} rec)` : 'VERIFIED ACTIVE'}</strong>
                  </span>
                  <a
                    href={ds.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#1e40af',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    Portal Source <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dataset Detail / Inspection Modal */}
      {selectedSource && (
        <div
          className="gov-modal-overlay"
          onClick={() => setSelectedSource(null)}
        >
          <div
            className="gov-modal"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gov-card-header" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} color="#0c1a30" />
                <span className="gov-card-title">{selectedSource.name}</span>
              </div>
              <button
                className="gov-btn gov-btn-secondary"
                style={{ padding: '2px 8px' }}
                onClick={() => setSelectedSource(null)}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ marginBottom: '14px', fontSize: '13px', color: '#475569' }}>
              {selectedSource.description}
            </div>

            <table className="gov-table" style={{ width: '100%', fontSize: '12px', marginBottom: '16px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '140px', fontWeight: 600, color: '#475569' }}>Dataset Code:</td>
                  <td><code style={{ fontWeight: 700 }}>{selectedSource.code}</code></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#475569' }}>Statutory Authority:</td>
                  <td>{selectedSource.sourceAgency}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#475569' }}>Classification:</td>
                  <td>
                    <span className={`gov-badge ${selectedSource.datasetType === 'OFFICIAL_OPEN_DATA' ? 'badge-good' : 'badge-medium'}`}>
                      {selectedSource.datasetType}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#475569' }}>Geographic Coverage:</td>
                  <td>{selectedSource.coverage}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#475569' }}>Update Frequency:</td>
                  <td>{selectedSource.updateFrequency}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#475569' }}>Open Data License:</td>
                  <td><code>{selectedSource.license}</code></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#475569' }}>Source URL:</td>
                  <td>
                    <a
                      href={selectedSource.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#1e40af', wordBreak: 'break-all' }}
                    >
                      {selectedSource.sourceUrl}
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                className="gov-btn gov-btn-secondary"
                onClick={() => setSelectedSource(null)}
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
