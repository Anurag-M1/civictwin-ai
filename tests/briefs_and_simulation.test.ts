import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';
import { prisma } from '../src/server/db.js';
import { generateEvidenceBrief } from '../src/server/services/brief.service.js';
import { runWhatIfSimulation } from '../src/server/services/simulator.service.js';

describe('CivicTwin AI - What-If Simulator & Grounded Evidence Briefs', () => {
  it('runs deterministic what-if scenario with parameter overrides', async () => {
    const hotspot = await prisma.hotspot.findFirst({
      include: {
        priorityAssessments: { take: 1, orderBy: { calculatedAt: 'desc' } },
      },
    });

    expect(hotspot).toBeDefined();
    if (!hotspot || !hotspot.priorityAssessments[0]) return;

    const baselineScore = hotspot.priorityAssessments[0].compositeScore;

    const simResult = await runWhatIfSimulation({
      hotspotId: hotspot.id,
      scenarioName: 'Monsoon Flooding Escalation + 2x Signal Surge',
      description: 'Simulates heavy rainfall causing +25 infrastructure distress and double reporting volume.',
      overrides: {
        requestVolumeFactor: 2.0,
        infrastructureDistressDelta: 25.0,
        vulnerabilityWeightDelta: 0.05,
        urgencyOverride: 'CRITICAL',
      },
    });

    expect(simResult).toBeDefined();
    expect(simResult.baselineScore).toBe(baselineScore);
    expect(simResult.resultingScore).toBeGreaterThan(0);
    expect(typeof simResult.scoreDelta).toBe('number');
  });

  it('synthesizes an explainable evidence brief with grounded citations', async () => {
    const hotspot = await prisma.hotspot.findFirst();
    expect(hotspot).toBeDefined();
    if (!hotspot) return;

    const brief = await generateEvidenceBrief(hotspot.id);
    expect(brief).toBeDefined();
    expect(brief.problemSummary.length).toBeGreaterThanOrEqual(20);
    expect(brief.potentialIntervention.length).toBeGreaterThanOrEqual(20);
    expect(brief.confidenceScore).toBeGreaterThan(0);
    expect(brief.citedEvidenceIds).toBeDefined();

    const cited = JSON.parse(brief.citedEvidenceIds);
    expect(Array.isArray(cited)).toBe(true);
    expect(cited.length).toBeGreaterThanOrEqual(1);
  });

  it('triggers brief synthesis via POST /api/v1/briefs/generate/:hotspotId', async () => {
    const hotspot = await prisma.hotspot.findFirst();
    expect(hotspot).toBeDefined();
    if (!hotspot) return;

    const res = await request(app)
      .post(`/api/v1/briefs/generate/${hotspot.id}`)
      .send();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.problemSummary).toBeDefined();
  });
});
