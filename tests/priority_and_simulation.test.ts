import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';
import { prisma } from '../src/server/db.js';
import {
  computeMathematicalCompositeScore,
  calculateHotspotPriority,
  getHistoricalAssessments,
  getSingleAssessment,
  compareAssessments,
  normalizeWeights,
  getRiskTier,
  PRIORITY_MODEL_VERSIONS,
  PriorityWeights,
} from '../src/server/services/priority.service.js';
import {
  runWhatIfSimulation,
  getScenariosForHotspot,
  getScenarioDetail,
  getSimulationPresets,
} from '../src/server/services/simulator.service.js';

describe('CivicTwin AI — Explainable Priority Engine & What-If Simulator', () => {
  describe('Deterministic & Reproducible Priority Scoring', () => {
    it('produces bit-for-bit identical results for identical inputs (pure reproducibility)', () => {
      const inputs = {
        infrastructure_gap: 75.0,
        request_volume: 60.0,
        affected_population: 40.0,
        urgency: 80.0,
        service_criticality: 90.0,
        investment_gap: 55.0,
      };

      const run1 = computeMathematicalCompositeScore(inputs);
      const run2 = computeMathematicalCompositeScore(inputs);

      expect(run1.compositeScore).toBe(run2.compositeScore);
      expect(run1.mathematicalProof).toBe(run2.mathematicalProof);
      expect(run1.factors).toEqual(run2.factors);
    });

    it('guarantees that factor contributions sum exactly to the composite score', () => {
      const inputs = {
        infrastructure_gap: 82.4,
        request_volume: 45.0,
        affected_population: 68.2,
        urgency: 95.0,
        service_criticality: 78.0,
        investment_gap: 62.5,
      };

      const result = computeMathematicalCompositeScore(inputs);
      const sumContributions = Number(
        result.factors.reduce((sum, f) => sum + f.contributionPct, 0).toFixed(2),
      );

      expect(Math.abs(sumContributions - result.compositeScore)).toBeLessThanOrEqual(0.01);
      expect(result.mathematicalProof).toContain(`= ${result.compositeScore.toFixed(2)}`);
    });

    it('correctly clamps out-of-bounds inputs to [0, 100]', () => {
      const extremeInputs = {
        infrastructure_gap: -50.0,
        request_volume: 999.0,
        affected_population: -10.0,
        urgency: 250.0,
        service_criticality: 100.0,
        investment_gap: 0.0,
      };

      const result = computeMathematicalCompositeScore(extremeInputs);

      const infra = result.factors.find((f) => f.factorKey === 'infrastructure_gap')!;
      const volume = result.factors.find((f) => f.factorKey === 'request_volume')!;
      const vuln = result.factors.find((f) => f.factorKey === 'affected_population')!;
      const urg = result.factors.find((f) => f.factorKey === 'urgency')!;

      expect(infra.normalizedValue).toBe(0);
      expect(volume.normalizedValue).toBe(100);
      expect(vuln.normalizedValue).toBe(0);
      expect(urg.normalizedValue).toBe(100);
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.compositeScore).toBeLessThanOrEqual(100);
    });

    it('auto-normalizes custom weights to guarantee sum is exactly 1.000', () => {
      const rawWeights: Partial<PriorityWeights> = {
        infrastructure_gap: 0.50,
        request_volume: 0.50,
        affected_population: 0.50,
        urgency: 0.50,
        service_criticality: 0.50,
        investment_gap: 0.50,
      }; // Sum = 3.0

      const normalized = normalizeWeights(rawWeights);
      const sum = Number(
        Object.values(normalized)
          .reduce((acc, v) => acc + v, 0)
          .toFixed(3),
      );

      expect(sum).toBe(1.0);
    });

    it('assigns correct standardized DPI Risk Tiers', () => {
      expect(getRiskTier(85)).toBe('CRITICAL');
      expect(getRiskTier(75)).toBe('CRITICAL');
      expect(getRiskTier(68)).toBe('ELEVATED');
      expect(getRiskTier(60)).toBe('ELEVATED');
      expect(getRiskTier(48)).toBe('MODERATE');
      expect(getRiskTier(39)).toBe('LOW');
    });

    it('supports multiple versioned model frameworks', () => {
      const inputs = {
        infrastructure_gap: 80.0,
        request_volume: 30.0,
        affected_population: 70.0,
        urgency: 50.0,
        service_criticality: 60.0,
        investment_gap: 40.0,
      };

      const balanced = computeMathematicalCompositeScore(inputs, undefined, 'v1.0-deterministic');
      const monsoon = computeMathematicalCompositeScore(inputs, undefined, 'v1.1-monsoon-weighted');
      const equity = computeMathematicalCompositeScore(inputs, undefined, 'v1.2-equity-focused');

      // Monsoon model has higher infra weight (35%), so it scores differently
      expect(monsoon.compositeScore).not.toBe(balanced.compositeScore);
      // Equity model has highest affected_population weight (35%), so it scores higher with high population
      expect(equity.compositeScore).toBeGreaterThan(balanced.compositeScore);
    });
  });

  describe('Grounded Hotspot Priority Calculation & Historical Auditing', () => {
    it('calculates and persists priority assessment with full factor decomposition', async () => {
      const hotspot = await prisma.hotspot.findFirst();
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      const result = await calculateHotspotPriority(hotspot.id, undefined, 'v1.0-deterministic');

      expect(result.assessmentCode).toMatch(/^PA-2026-/);
      expect(result.hotspotId).toBe(hotspot.id);
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.compositeScore).toBeLessThanOrEqual(100);
      expect(result.factors).toHaveLength(6);

      // Verify each factor contains transparency metadata
      for (const f of result.factors) {
        expect(f.factorKey).toBeDefined();
        expect(f.factorLabel).toBeDefined();
        expect(f.rawUnit).toBeDefined();
        expect(typeof f.rawValue).toBe('number');
        expect(typeof f.normalizedValue).toBe('number');
        expect(typeof f.weight).toBe('number');
        expect(typeof f.contributionPct).toBe('number');
        expect(f.formulaDescription).toContain('pts');
      }
    });

    it('retrieves historical assessments for a hotspot in chronological order', async () => {
      const hotspot = await prisma.hotspot.findFirst();
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      const history = await getHistoricalAssessments(hotspot.id);
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(1);

      const latest = history[0];
      expect(latest.id).toBeDefined();
      expect(latest.assessmentCode).toBeDefined();
      expect(latest.factors).toHaveLength(6);
    });

    it('compares two assessments side-by-side with factor delta breakdown', async () => {
      const hotspot = await prisma.hotspot.findFirst();
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      // Run assessment 1 (default balanced)
      const a1 = await calculateHotspotPriority(hotspot.id, undefined, 'v1.0-deterministic');
      // Run assessment 2 (monsoon weighted)
      const a2 = await calculateHotspotPriority(hotspot.id, undefined, 'v1.1-monsoon-weighted');

      // Fetch the generated assessments from DB
      const dbA1 = await prisma.priorityAssessment.findUnique({ where: { assessmentCode: a1.assessmentCode } });
      const dbA2 = await prisma.priorityAssessment.findUnique({ where: { assessmentCode: a2.assessmentCode } });

      expect(dbA1).toBeDefined();
      expect(dbA2).toBeDefined();
      if (!dbA1 || !dbA2) return;

      const comparison = await compareAssessments(dbA1.id, dbA2.id);
      expect(comparison).toBeDefined();
      expect(comparison.assessmentA.code).toBe(a1.assessmentCode);
      expect(comparison.assessmentB.code).toBe(a2.assessmentCode);
      expect(comparison.factorDeltas).toHaveLength(6);

      for (const fd of comparison.factorDeltas) {
        expect(fd.factorKey).toBeDefined();
        expect(typeof fd.deltaContribution).toBe('number');
        expect(['INCREASE', 'DECREASE', 'UNCHANGED']).toContain(fd.direction);
      }
    });
  });

  describe('What-If Scenario Simulator & Counterfactual Modeling', () => {
    it('executes counterfactual simulation with multi-variable overrides', async () => {
      const hotspot = await prisma.hotspot.findFirst();
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      // Reset baseline assessment to standard default weights
      await calculateHotspotPriority(hotspot.id);

      const result = await runWhatIfSimulation({
        hotspotId: hotspot.id,
        scenarioName: 'Test Monsoon Crisis Scenario',
        description: 'Simulating severe rainfall breach and reporting surge.',
        overrides: {
          requestVolumeFactor: 2.5,
          infrastructureDistressDelta: 15.0,
          investmentGapDelta: 15.0,
          urgencyOverride: 'CRITICAL',
        },
      });

      expect(result.scenarioId).toBeDefined();
      expect(result.resultingScore).toBeGreaterThan(result.baselineScore);
      expect(result.scoreDelta).toBeGreaterThan(0);
      expect(result.factorComparisons).toHaveLength(6);

      // Verify factor comparisons show baseline, simulated, and delta
      const infraComp = result.factorComparisons.find((fc) => fc.factorKey === 'infrastructure_gap')!;
      expect(infraComp.deltaRaw).toBe(15.0);
      expect(infraComp.deltaContribution).toBeGreaterThan(0);
      expect(infraComp.impactDirection).toBe('INCREASE');

      // Verify sensitivity driver ranking
      expect(result.sensitivityDrivers.length).toBeGreaterThanOrEqual(1);
      expect(result.driverSummary).toContain('primarily driven by');
    });

    it('simulates capital repair infusion reducing score and distress', async () => {
      const hotspot = await prisma.hotspot.findFirst();
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      const result = await runWhatIfSimulation({
        hotspotId: hotspot.id,
        scenarioName: 'Test Capital Repair Infusion',
        description: 'Testing repair intervention.',
        overrides: {
          requestVolumeFactor: 1.0,
          infrastructureDistressDelta: -30.0,
          investmentGapDelta: -25.0,
          urgencyOverride: 'LOW',
        },
      });

      expect(result.resultingScore).toBeLessThan(result.baselineScore);
      expect(result.scoreDelta).toBeLessThan(0);
      expect(result.tierTransition).toBeDefined();
    });

    it('returns predefined simulation presets', () => {
      const presets = getSimulationPresets();
      expect(Array.isArray(presets)).toBe(true);
      expect(presets.length).toBeGreaterThanOrEqual(4);

      const monsoon = presets.find((p) => p.id === 'monsoon_crisis');
      expect(monsoon).toBeDefined();
      expect(monsoon?.overrides.infrastructureDistressDelta).toBe(25.0);
      expect(monsoon?.overrides.urgencyOverride).toBe('CRITICAL');
    });

    it('retrieves saved scenarios for a hotspot', async () => {
      const hotspot = await prisma.hotspot.findFirst();
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      const scenarios = await getScenariosForHotspot(hotspot.id);
      expect(Array.isArray(scenarios)).toBe(true);
      expect(scenarios.length).toBeGreaterThanOrEqual(1);

      const first = scenarios[0];
      expect(first.id).toBeDefined();
      expect(first.name).toBeDefined();
      expect(typeof first.resultingScore).toBe('number');
      expect(typeof first.scoreDelta).toBe('number');
    });
  });

  describe('Priority & Simulator REST API Integration', () => {
    it('GET /api/v1/priority/factors returns supported models, weights, and units', async () => {
      const res = await request(app).get('/api/v1/priority/factors');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.weights).toBeDefined();
      expect(res.body.labels).toBeDefined();
      expect(res.body.units).toBeDefined();
      expect(res.body.supportedModels).toBeDefined();
      expect(res.body.supportedModels['v1.0-deterministic']).toBeDefined();
    });

    it('POST /api/v1/priority/calculate/:hotspotId triggers calculation with custom weights', async () => {
      const hotspot = await prisma.hotspot.findFirst();
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      const res = await request(app)
        .post(`/api/v1/priority/calculate/${hotspot.id}`)
        .send({
          weights: {
            infrastructure_gap: 0.35,
            urgency: 0.25,
          },
          modelVersion: 'v1.1-monsoon-weighted',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.compositeScore).toBeGreaterThanOrEqual(0);
      expect(res.body.data.factors).toHaveLength(6);
      expect(res.body.data.riskTier).toBeDefined();
    });

    it('POST /api/v1/simulator/what-if runs simulation scenario via API', async () => {
      const hotspot = await prisma.hotspot.findFirst();
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      const res = await request(app)
        .post('/api/v1/simulator/what-if')
        .send({
          hotspotId: hotspot.id,
          scenarioName: 'API Integration Test Scenario',
          description: 'Testing via supertest',
          overrides: {
            requestVolumeFactor: 1.8,
            infrastructureDistressDelta: 15.0,
            urgencyOverride: 'HIGH',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scenarioId).toBeDefined();
      expect(res.body.data.factorComparisons).toHaveLength(6);
      expect(res.body.data.sensitivityDrivers).toBeDefined();
    });

    it('GET /api/v1/simulator/presets returns list of policy presets', async () => {
      const res = await request(app).get('/api/v1/simulator/presets');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('GET /api/v1/simulator/scenarios/:hotspotId returns saved scenarios', async () => {
      const hotspot = await prisma.hotspot.findFirst();
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      const res = await request(app).get(`/api/v1/simulator/scenarios/${hotspot.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/priority/assessments/:hotspotId returns assessment history', async () => {
      const hotspot = await prisma.hotspot.findFirst();
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      const res = await request(app).get(`/api/v1/priority/assessments/${hotspot.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
