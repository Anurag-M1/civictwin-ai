import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';
import { prisma } from '../src/server/db.js';
import {
  gatherHotspotEvidence,
  generateEvidenceBrief,
  verifyBriefTraceability,
} from '../src/server/services/brief.service.js';
import {
  deterministicBriefFallback,
  synthesizeEvidenceBrief,
} from '../src/server/services/ai/evidence-synthesis.ai.js';
import type { EvidencePack } from '../src/shared/schemas/brief.schema.js';

describe('Gemini Evidence Brief Workflow & Traceability Suite', () => {
  it('gathers actual application-derived structured evidence for a hotspot', async () => {
    const hotspot = await prisma.hotspot.findFirst({
      include: { administrativeArea: true },
    });
    expect(hotspot).toBeDefined();
    if (!hotspot) return;

    const pack = await gatherHotspotEvidence(hotspot.id);

    expect(pack).toBeDefined();
    expect(pack.hotspotCode).toBe(hotspot.hotspotCode);
    expect(pack.areaName).toBe(hotspot.administrativeArea.name);
    expect(pack.stateName).toBe(hotspot.administrativeArea.stateCode);
    expect(pack.category).toBe(hotspot.category);
    expect(Array.isArray(pack.evidenceList)).toBe(true);
    expect(pack.evidenceList.length).toBeGreaterThanOrEqual(1);

    // Verify all evidence items are strictly structured
    for (const ev of pack.evidenceList) {
      expect(ev.id).toMatch(/^EV-/);
      expect(typeof ev.metric).toBe('string');
      expect(typeof ev.value).toBe('string');
      expect(typeof ev.source).toBe('string');
      expect(typeof ev.confidence).toBe('number');
    }

    // Verify sufficiency status evaluation
    expect(['SUFFICIENT', 'INSUFFICIENT']).toContain(pack.sufficiencyStatus);
    expect(typeof pack.sufficiencyReason).toBe('string');
  });

  it('synthesizes a complete grounded brief with all required sections and citations', async () => {
    const hotspot = await prisma.hotspot.findFirst();
    expect(hotspot).toBeDefined();
    if (!hotspot) return;

    const brief = await generateEvidenceBrief(hotspot.id);

    // Required Fields Validation:
    // problem, evidence, potential intervention, implementation considerations, risks, dependencies, limitations, confidence, human review requirement
    expect(brief.problem).toBeDefined();
    expect(brief.problem.length).toBeGreaterThanOrEqual(20);

    expect(Array.isArray(brief.evidence)).toBe(true);
    expect(brief.evidence.length).toBeGreaterThanOrEqual(1);
    for (const item of brief.evidence) {
      expect(item.evidenceId).toMatch(/^EV-/);
      expect(item.metric).toBeDefined();
      expect(item.finding).toBeDefined();
      expect(item.source).toBeDefined();
    }

    expect(brief.potentialIntervention).toBeDefined();
    expect(brief.potentialIntervention.length).toBeGreaterThanOrEqual(20);

    expect(brief.implementationConsiderations).toBeDefined();
    expect(brief.implementationConsiderations.length).toBeGreaterThanOrEqual(20);

    expect(brief.risks).toBeDefined();
    expect(brief.risks.length).toBeGreaterThanOrEqual(20);

    expect(brief.dependencies).toBeDefined();
    expect(brief.dependencies.length).toBeGreaterThanOrEqual(20);

    expect(brief.limitations).toBeDefined();
    expect(brief.limitations.length).toBeGreaterThanOrEqual(10);

    expect(typeof brief.confidence).toBe('number');
    expect(brief.confidence).toBeGreaterThan(0);
    expect(brief.confidence).toBeLessThanOrEqual(1.0);

    expect(brief.humanReviewRequirement).toBeDefined();
    expect(typeof brief.humanReviewRequirement.required).toBe('boolean');
    expect(typeof brief.humanReviewRequirement.reason).toBe('string');
  });

  it('guarantees that every factual statement is traceable to an evidence ID', async () => {
    const hotspot = await prisma.hotspot.findFirst();
    expect(hotspot).toBeDefined();
    if (!hotspot) return;

    const pack = await gatherHotspotEvidence(hotspot.id);
    const synthesisResult = await synthesizeEvidenceBrief(pack);
    const brief = synthesisResult.data;

    const report = verifyBriefTraceability(brief, pack);

    expect(report.citedIds.length).toBeGreaterThanOrEqual(1);
    expect(report.invalidIds).toHaveLength(0);
    expect(report.isTraceable).toBe(true);

    // Check evidence finding IDs map to pack items
    const packIds = new Set(pack.evidenceList.map((e) => e.id));
    for (const finding of brief.evidence) {
      expect(packIds.has(finding.evidenceId)).toBe(true);
    }
  });

  it('explicitly states that evidence is insufficient when data coverage is sparse', async () => {
    // Construct an artificial sparse EvidencePack with insufficient signals and no physical asset telemetry
    const sparsePack: EvidencePack = {
      hotspotCode: 'HOT-TEST-SPARSE',
      areaName: 'Rural Ward 99 - Outskirts',
      stateName: 'KA',
      category: 'Water',
      requestCount: 0,
      growthRatePct: 0,
      vulnerablePopulation: 300,
      infrastructureDistressPct: 15,
      sufficiencyStatus: 'INSUFFICIENT',
      sufficiencyReason: 'Zero direct citizen reports and unverified physical asset telemetry in this administrative boundary.',
      evidenceList: [
        {
          id: 'EV-INSUFFICIENT-01',
          category: 'CITIZEN_SIGNALS',
          sourceEntity: 'Telemetry Probe',
          metric: 'Citizen Signal Volume',
          value: '0 reports recorded',
          period: 'Past 90 Days',
          source: 'Intake Gateway',
          confidence: 0.3,
          isOfficial: false,
        },
      ],
    };

    const brief = deterministicBriefFallback(sparsePack);

    // Must explicitly declare that evidence is insufficient
    expect(brief.problem.toUpperCase()).toContain('INSUFFICIENT');
    expect(brief.limitations.toUpperCase()).toContain('INSUFFICIENT');

    // Confidence must be downgraded (< 0.50)
    expect(brief.confidence).toBeLessThan(0.50);

    // Human review requirement must be mandatory
    expect(brief.humanReviewRequirement.required).toBe(true);
    expect(brief.humanReviewRequirement.reason.toLowerCase()).toContain('insufficient');

    // Potential intervention must recommend field inspection rather than blind capex spending
    expect(brief.potentialIntervention.toLowerCase()).toMatch(/field|inspection|audit|verification/);
  });

  it('records an immutable AI audit trail entry for every evidence brief synthesis', async () => {
    const hotspot = await prisma.hotspot.findFirst();
    expect(hotspot).toBeDefined();
    if (!hotspot) return;

    const initialAuditCount = await prisma.auditEvent.count({
      where: {
        eventType: 'BRIEF_SYNTHESIS',
        sourceModule: 'EVIDENCE_BRIEF',
      },
    });

    const brief = await generateEvidenceBrief(hotspot.id);
    expect(brief.auditRecordId).toBeDefined();

    const latestAuditLog = await prisma.auditEvent.findUnique({
      where: { id: brief.auditRecordId },
    });

    expect(latestAuditLog).toBeDefined();
    expect(latestAuditLog?.eventType).toBe('BRIEF_SYNTHESIS');
    expect(latestAuditLog?.sourceModule).toBe('EVIDENCE_BRIEF');
    expect(latestAuditLog?.performedBy).toBe('GEMINI_EVIDENCE_ENGINE');
    expect(latestAuditLog?.inputDigest).toBeDefined();
    expect(latestAuditLog?.outputDigest).toBeDefined();

    const parsedMetadata = JSON.parse(latestAuditLog!.metadataJson!);
    expect(parsedMetadata.hotspotCode).toBe(hotspot.hotspotCode);
    expect(parsedMetadata.isTraceable).toBe(true);
    expect(parsedMetadata.citedEvidenceCount).toBeGreaterThanOrEqual(1);

    const postAuditCount = await prisma.auditEvent.count({
      where: {
        eventType: 'BRIEF_SYNTHESIS',
        sourceModule: 'EVIDENCE_BRIEF',
      },
    });
    expect(postAuditCount).toBeGreaterThan(initialAuditCount);
  });

  it('provides raw structured evidence pack inspection via GET /api/v1/briefs/:hotspotId/evidence-pack', async () => {
    const hotspot = await prisma.hotspot.findFirst();
    expect(hotspot).toBeDefined();
    if (!hotspot) return;

    const res = await request(app).get(`/api/v1/briefs/${hotspot.id}/evidence-pack`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hotspotCode).toBe(hotspot.hotspotCode);
    expect(Array.isArray(res.body.data.evidenceList)).toBe(true);
    expect(res.body.data.evidenceList.length).toBeGreaterThanOrEqual(1);
    expect(['SUFFICIENT', 'INSUFFICIENT']).toContain(res.body.data.sufficiencyStatus);
  });

  it('retrieves synthesized brief via GET /api/v1/briefs/:hotspotId with structured findings', async () => {
    const hotspot = await prisma.hotspot.findFirst();
    expect(hotspot).toBeDefined();
    if (!hotspot) return;

    // Ensure brief exists
    await generateEvidenceBrief(hotspot.id);

    const res = await request(app).get(`/api/v1/briefs/${hotspot.id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.problem).toBeDefined();
    expect(Array.isArray(res.body.data.evidence)).toBe(true);
    expect(res.body.data.potentialIntervention).toBeDefined();
    expect(res.body.data.humanReviewRequirement).toBeDefined();
    expect(Array.isArray(res.body.data.citedEvidenceIds)).toBe(true);
  });
});
