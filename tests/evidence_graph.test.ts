import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';
import { prisma } from '../src/server/db.js';
import {
  buildHotspotEvidenceGraph,
  traceEntityLineage,
  getEvidenceRecordDetail,
  verifyEvidenceIntegrity,
  getDataProvenanceReport,
  ensureHotspotEvidenceRecords,
} from '../src/server/services/evidence-graph.service.js';
import { EvidenceGraphSchema } from '../src/shared/schemas/evidence-graph.schema.js';

describe('CivicTwin AI — Civic Evidence Graph & Traceability Suite', () => {
  it('constructs a fully connected evidence graph for a hotspot', async () => {
    const hotspot = await prisma.hotspot.findFirst({
      where: { hotspotCode: 'HOT-KA-BLR-001' },
    });
    expect(hotspot).toBeDefined();
    if (!hotspot) return;

    const graph = await buildHotspotEvidenceGraph(hotspot.id);

    // Validate with Zod schema
    const parsed = EvidenceGraphSchema.safeParse(graph);
    expect(parsed.success).toBe(true);

    expect(graph.hotspotCode).toBe('HOT-KA-BLR-001');
    expect(graph.nodes.length).toBeGreaterThanOrEqual(8);
    expect(graph.edges.length).toBeGreaterThanOrEqual(7);

    // Verify presence of all key node types
    const nodeTypes = new Set(graph.nodes.map((n) => n.type));
    expect(nodeTypes.has('HOTSPOT')).toBe(true);
    expect(nodeTypes.has('ADMINISTRATIVE_AREA')).toBe(true);
    expect(nodeTypes.has('ISSUE_CLUSTER')).toBe(true);
    expect(nodeTypes.has('CITIZEN_REQUEST')).toBe(true);
    expect(nodeTypes.has('INFRASTRUCTURE_ASSET')).toBe(true);
    expect(nodeTypes.has('DEMOGRAPHIC_INDICATOR')).toBe(true);
    expect(nodeTypes.has('PUBLIC_INVESTMENT')).toBe(true);
    expect(nodeTypes.has('EVIDENCE_RECORD')).toBe(true);
    expect(nodeTypes.has('PRIORITY_ASSESSMENT')).toBe(true);
    expect(nodeTypes.has('RECOMMENDATION')).toBe(true);
    expect(nodeTypes.has('EVIDENCE_BRIEF')).toBe(true);

    // Verify key edge relationships
    const edgeTypes = new Set(graph.edges.map((e) => e.type));
    expect(edgeTypes.has('LOCATED_IN')).toBe(true);
    expect(edgeTypes.has('SPAWNED_HOTSPOT')).toBe(true);
    expect(edgeTypes.has('CLUSTERED_INTO')).toBe(true);
    expect(edgeTypes.has('CITES_EVIDENCE')).toBe(true);
    expect(edgeTypes.has('EVALUATED_BY')).toBe(true);
    expect(edgeTypes.has('RESULTED_IN')).toBe(true);

    // Traceability completeness
    expect(graph.metrics.traceabilityCompletenessScore).toBe(100.0);
    expect(graph.lineagePaths.length).toBeGreaterThanOrEqual(1);

    // Ensure lineage path connects raw signal to recommendation
    const primaryPath = graph.lineagePaths[0];
    expect(primaryPath[0]).toMatch(/^REQ-/);
    expect(primaryPath[primaryPath.length - 1]).toMatch(/^REC-/);
  });

  it('correctly labels official open data vs synthetic/demonstration benchmarks', async () => {
    const hotspot = await prisma.hotspot.findFirst({
      where: { hotspotCode: 'HOT-KA-BLR-001' },
    });
    expect(hotspot).toBeDefined();
    if (!hotspot) return;

    const graph = await buildHotspotEvidenceGraph(hotspot.id);

    // Administrative area must be official open data
    const areaNode = graph.nodes.find((n) => n.type === 'ADMINISTRATIVE_AREA');
    expect(areaNode).toBeDefined();
    expect(areaNode?.datasetType).toBe('OFFICIAL_OPEN_DATA');
    expect(areaNode?.isSynthetic).toBe(false);

    // Public investment must be official open data
    const invNode = graph.nodes.find((n) => n.type === 'PUBLIC_INVESTMENT');
    expect(invNode).toBeDefined();
    expect(invNode?.datasetType).toBe('OFFICIAL_OPEN_DATA');
    expect(invNode?.isSynthetic).toBe(false);

    // Citizen intake must be labeled demonstration seed
    const citizenNode = graph.nodes.find((n) => n.type === 'CITIZEN_REQUEST');
    expect(citizenNode).toBeDefined();
    expect(citizenNode?.datasetType).toBe('DEMONSTRATION_SEED');
    expect(citizenNode?.isSynthetic).toBe(true);
    expect(citizenNode?.disclaimer).toContain('Demonstration');

    // Provenance percentages
    expect(graph.metrics.officialPercentage).toBeGreaterThan(0);
    expect(graph.metrics.syntheticPercentage).toBeGreaterThan(0);
    expect(graph.metrics.officialPercentage + graph.metrics.syntheticPercentage).toBeCloseTo(100.0, 1);
  });

  it('traces bidirectional lineage from a Hotspot to ancestors and descendants', async () => {
    const hotspot = await prisma.hotspot.findFirst({
      where: { hotspotCode: 'HOT-KA-BLR-001' },
    });
    expect(hotspot).toBeDefined();
    if (!hotspot) return;

    const trace = await traceEntityLineage('HOTSPOT', hotspot.id);

    expect(trace.entityType).toBe('HOTSPOT');
    expect(trace.isFullyTraceable).toBe(true);
    expect(trace.ancestors.length).toBeGreaterThanOrEqual(4);
    expect(trace.descendants.length).toBeGreaterThanOrEqual(2);
    expect(trace.verifiableEvidenceIds).toEqual(
      expect.arrayContaining(['EV-101', 'EV-102', 'EV-103', 'EV-104']),
    );

    // Ancestor types check
    const ancestorTypes = trace.ancestors.map((a) => a.type);
    expect(ancestorTypes).toContain('ISSUE_CLUSTER');
    expect(ancestorTypes).toContain('CITIZEN_REQUEST');
    expect(ancestorTypes).toContain('ADMINISTRATIVE_AREA');
    expect(ancestorTypes).toContain('EVIDENCE_RECORD');

    // Descendant types check
    const descendantTypes = trace.descendants.map((d) => d.type);
    expect(descendantTypes).toContain('PRIORITY_ASSESSMENT');
    expect(descendantTypes).toContain('RECOMMENDATION');
    expect(descendantTypes).toContain('EVIDENCE_BRIEF');
  });

  it('traces citizen request forward to issue cluster, hotspot, assessment, and recommendation', async () => {
    const req = await prisma.citizenRequest.findFirst({
      where: { trackingCode: 'REQ-2026-001' },
    });
    expect(req).toBeDefined();
    if (!req) return;

    const trace = await traceEntityLineage('CITIZEN_REQUEST', req.id);

    expect(trace.entityType).toBe('CITIZEN_REQUEST');
    expect(trace.isFullyTraceable).toBe(true);
    expect(trace.datasetType).toBe('DEMONSTRATION_SEED');

    const descendantTypes = trace.descendants.map((d) => d.type);
    expect(descendantTypes).toContain('ISSUE_CLUSTER');
    expect(descendantTypes).toContain('HOTSPOT');
    expect(descendantTypes).toContain('PRIORITY_ASSESSMENT');
    expect(descendantTypes).toContain('RECOMMENDATION');
  });

  it('resolves detailed evidence unit EV-101 to underlying citizen request record', async () => {
    const detail = await getEvidenceRecordDetail('EV-101');

    expect(detail.found).toBe(true);
    expect(detail.evidenceCode).toBe('EV-101');
    expect(detail.sourceEntity).toBe('CITIZEN_SIGNAL');
    expect(detail.metric).toContain('Citizen Incident Concentration');
    expect(detail.underlyingRecord).toBeDefined();
    expect(detail.underlyingRecord?.trackingCode).toBe('REQ-2026-001');
  });

  it('resolves detailed evidence unit EV-102 to underlying physical asset record and conditions', async () => {
    const detail = await getEvidenceRecordDetail('EV-102');

    expect(detail.found).toBe(true);
    expect(detail.evidenceCode).toBe('EV-102');
    expect(detail.sourceEntity).toBe('ASSET_INSPECTION');
    expect(detail.underlyingRecord).toBeDefined();
    expect(detail.underlyingRecord?.assetCode).toBe('AST-KA-RDS-004');
    expect(detail.underlyingRecord?.conditions).toBeDefined();
    expect(detail.underlyingRecord?.conditions.length).toBeGreaterThanOrEqual(1);
  });

  it('resolves Varanasi evidence units EV-201 to EV-204 to water infrastructure records', async () => {
    const ev201 = await getEvidenceRecordDetail('EV-201');
    expect(ev201.found).toBe(true);
    expect(ev201.underlyingRecord?.trackingCode).toBe('REQ-2026-003');

    const ev202 = await getEvidenceRecordDetail('EV-202');
    expect(ev202.found).toBe(true);
    expect(ev202.underlyingRecord?.assetCode).toBe('AST-UP-WAT-012');

    const ev203 = await getEvidenceRecordDetail('EV-203');
    expect(ev203.found).toBe(true);
    expect(ev203.sourceEntity).toBe('CENSUS_SURVEY');

    const ev204 = await getEvidenceRecordDetail('EV-204');
    expect(ev204.found).toBe(true);
    expect(ev204.sourceEntity).toBe('CAPITAL_BUDGET');
  });

  it('returns found=false and does NOT fabricate data for non-existent evidence code', async () => {
    const detail = await getEvidenceRecordDetail('EV-FABRICATED-999');

    expect(detail.found).toBe(false);
    expect(detail.underlyingRecord).toBeNull();
    expect(detail.error).toContain('does not exist');
  });

  it('audits and verifies citation integrity for a Grounded Evidence Brief', async () => {
    const brief = await prisma.evidenceBrief.findFirst();
    expect(brief).toBeDefined();
    if (!brief) return;

    const report = await verifyEvidenceIntegrity('BRIEF', brief.id);

    expect(report.valid).toBe(true);
    expect(report.orphanedOrFabricatedCount).toBe(0);
    expect(report.resolvedItems.length).toBeGreaterThanOrEqual(1);
    expect(report.resolvedItems.every((item) => item.found && item.underlyingRecord !== null)).toBe(true);
  });

  it('automatically compiles missing evidence records for dynamic hotspots', async () => {
    const hotspot = await prisma.hotspot.findFirst({
      where: { hotspotCode: 'HOT-KA-BLR-001' },
    });
    expect(hotspot).toBeDefined();
    if (!hotspot) return;

    // ensureHotspotEvidenceRecords is idempotent
    const records = await ensureHotspotEvidenceRecords(hotspot.id);
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThanOrEqual(1);
  });

  it('produces data provenance report disclosing official vs benchmark datasets', async () => {
    const report = await getDataProvenanceReport();

    expect(report.dataSources.length).toBeGreaterThanOrEqual(4);
    expect(report.inventory.citizenRequests.datasetType).toBe('DEMONSTRATION_SEED');
    expect(report.inventory.infrastructureAssets.total).toBeGreaterThan(0);
    expect(report.complianceDeclaration.digitalPublicGoodStatus).toBe('COMPLIANT');
  });

  // REST API Verification
  describe('Civic Evidence Graph REST API Endpoints', () => {
    it('GET /api/v1/evidence-graph/hotspot/:id returns complete graph payload', async () => {
      const hotspot = await prisma.hotspot.findFirst({
        where: { hotspotCode: 'HOT-KA-BLR-001' },
      });
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      const res = await request(app).get(`/api/v1/evidence-graph/hotspot/${hotspot.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hotspotCode).toBe('HOT-KA-BLR-001');
      expect(Array.isArray(res.body.data.nodes)).toBe(true);
      expect(Array.isArray(res.body.data.edges)).toBe(true);
      expect(res.body.data.metrics.traceabilityCompletenessScore).toBe(100);
    });

    it('GET /api/v1/evidence-graph/trace/:entityType/:entityId returns ancestor and descendant lineage', async () => {
      const hotspot = await prisma.hotspot.findFirst({
        where: { hotspotCode: 'HOT-KA-BLR-001' },
      });
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      const res = await request(app).get(`/api/v1/evidence-graph/trace/HOTSPOT/${hotspot.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entityType).toBe('HOTSPOT');
      expect(res.body.data.isFullyTraceable).toBe(true);
    });

    it('GET /api/v1/evidence-graph/evidence/:evidenceCode returns resolved evidence or 404', async () => {
      // Valid evidence code
      const resValid = await request(app).get('/api/v1/evidence-graph/evidence/EV-101');
      expect(resValid.status).toBe(200);
      expect(resValid.body.success).toBe(true);
      expect(resValid.body.data.evidenceCode).toBe('EV-101');
      expect(resValid.body.data.underlyingRecord).toBeDefined();

      // Fabricated / Invalid evidence code
      const resInvalid = await request(app).get('/api/v1/evidence-graph/evidence/EV-FABRICATED-404');
      expect(resInvalid.status).toBe(404);
      expect(resInvalid.body.success).toBe(false);
      expect(resInvalid.body.error).toContain('does not exist');
    });

    it('GET /api/v1/evidence-graph/verify/:targetType/:targetId validates citation integrity', async () => {
      const brief = await prisma.evidenceBrief.findFirst();
      expect(brief).toBeDefined();
      if (!brief) return;

      const res = await request(app).get(`/api/v1/evidence-graph/verify/BRIEF/${brief.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.orphanedOrFabricatedCount).toBe(0);
    });

    it('GET /api/v1/evidence-graph/provenance returns system-wide dataset disclosure', async () => {
      const res = await request(app).get('/api/v1/evidence-graph/provenance');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inventory).toBeDefined();
      expect(res.body.data.complianceDeclaration).toBeDefined();
    });
  });
});
