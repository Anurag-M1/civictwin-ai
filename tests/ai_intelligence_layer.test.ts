/**
 * CivicTwin AI — Gemini Intelligence Layer Unit Tests
 *
 * Tests:
 *   1. AI Provider Abstraction (GoogleGenAiProvider, MockAiProvider, provider registry)
 *   2. Request Analysis & Entity Extraction Service (signal-analysis.ai.ts)
 *   3. Semantic Clustering Support Service (clustering.ai.ts)
 *   4. Grounded Evidence Synthesis Service (evidence-synthesis.ai.ts)
 *   5. Project Recommendation Generation Service (recommendation.ai.ts)
 *   6. Strict Constraint Enforcement: Gemini is NEVER permitted to calculate priority scores
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  MockAiProvider,
  setAiProvider,
  resetAiProvider,
  analyzeCitizenSignal,
  synthesizeSignalCluster,
  synthesizeEvidenceBrief,
  generateProjectRecommendation,
  deterministicSignalFallback,
  deterministicClusteringFallback,
  deterministicBriefFallback,
  deterministicRecommendationFallback,
} from '../src/server/services/ai/index.js';
import type { EvidencePack } from '../src/shared/schemas/brief.schema.js';
import type { ClusterSignalInput } from '../src/shared/schemas/clustering.schema.js';
import { computeMathematicalCompositeScore } from '../src/server/services/priority.service.js';

describe('CivicTwin AI — Gemini Intelligence Layer', () => {
  let mockProvider: MockAiProvider;

  beforeEach(() => {
    mockProvider = new MockAiProvider();
    setAiProvider(mockProvider);
  });

  afterEach(() => {
    resetAiProvider();
  });

  // ─── 1. Provider Abstraction & Mocking Tests ──────────────────────────────

  describe('AI Provider Abstraction', () => {
    it('executes structured generation with schema validation via MockAiProvider', async () => {
      const TestSchema = z.object({
        city: z.string(),
        wardNumber: z.number().int(),
      });

      mockProvider.setMockStructuredResponse('Bangalore test', {
        city: 'Bengaluru',
        wardNumber: 82,
      });

      const result = await mockProvider.generateStructured({
        prompt: 'Bangalore test prompt',
        schema: TestSchema,
      });

      expect(result.data.city).toBe('Bengaluru');
      expect(result.data.wardNumber).toBe(82);
      expect(result.validationResult).toBe('VALID');
      expect(result.isFallback).toBe(false);
      expect(mockProvider.getCalls()).toHaveLength(1);
    });

    it('falls back gracefully when mock response violates Zod schema', async () => {
      const StrictSchema = z.object({
        requiredFlag: z.boolean(),
        validRange: z.number().min(10).max(20),
      });

      // Inject invalid data violating range
      mockProvider.setMockStructuredResponse('Invalid Data Test', {
        requiredFlag: true,
        validRange: 999, // Out of bounds
      });

      const result = await mockProvider.generateStructured({
        prompt: 'Invalid Data Test',
        schema: StrictSchema,
        fallbackGenerator: () => ({ requiredFlag: false, validRange: 15 }),
      });

      expect(result.validationResult).toBe('WARN');
      expect(result.isFallback).toBe(true);
      expect(result.data.validRange).toBe(15);
    });

    it('handles simulated timeout gracefully via fallback generator', async () => {
      mockProvider.setSimulateTimeout(true);

      const SimpleSchema = z.object({ status: z.string() });
      const result = await mockProvider.generateStructured({
        prompt: 'Timeout Test',
        schema: SimpleSchema,
        fallbackGenerator: () => ({ status: 'TIMEOUT_RECOVERED' }),
      });

      expect(result.isFallback).toBe(true);
      expect(result.validationResult).toBe('WARN');
      expect(result.data.status).toBe('TIMEOUT_RECOVERED');
    });
  });

  // ─── 2. Request Analysis & Entity Extraction Tests ─────────────────────────

  describe('Isolated Request Analysis Service', () => {
    it('extracts structured intelligence and entities from English citizen reports', async () => {
      const input =
        'Severe road collapse, deep potholes, and waterlogging near Garudachar Palya PHC blocking emergency ambulances.';
      const result = await analyzeCitizenSignal(input, 'en', { provider: mockProvider });

      expect(result.data).toBeDefined();
      expect(['Roads', 'Healthcare']).toContain(result.data.category);
      expect(['HIGH', 'CRITICAL']).toContain(result.data.urgency);
      expect(result.data.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.data.locationMentions.length).toBeGreaterThanOrEqual(1);
      expect(result.data.requiresHumanReview).toBe(false);
    });

    it('processes Hindi water crisis complaint and detects Indic script language', async () => {
      const input =
        'सिगरा स्टेडियम के पास पेयजल की पाइपलाइन टूट गई है और नलों में गंदा पानी आ रहा है।';
      const result = await analyzeCitizenSignal(input, 'hi', { provider: mockProvider });

      expect(result.data.detectedLanguage).toBe('hi');
      expect(result.data.category).toBe('Water');
      expect(result.data.urgency).toBe('CRITICAL');
      expect(result.data.summary.length).toBeGreaterThan(10);
    });

    it('classifies ambiguous input with low confidence and flags for human review', async () => {
      const input = 'Something is wrong here, please fix immediately.';
      const result = await analyzeCitizenSignal(input, 'en', { provider: mockProvider });

      expect(result.data.category).toBe('Other');
      expect(result.data.confidence).toBeLessThan(0.7);
      expect(result.data.requiresHumanReview).toBe(true);
    });

    it('deterministic fallback produces valid schema compliant signal', () => {
      const fallback = deterministicSignalFallback('Heavy transformer sparks on high road', 'en');
      expect(fallback.category).toBe('Electricity');
      expect(fallback.urgency).toBe('CRITICAL');
      expect(fallback.confidence).toBeGreaterThan(0.7);
    });
  });

  // ─── 3. Semantic Clustering Support Tests ─────────────────────────────────

  describe('Isolated Semantic Clustering Support Service', () => {
    const mockSignals: ClusterSignalInput[] = [
      {
        id: 'REQ-101',
        text: 'Potholes on Garudachar Palya approach road blocking PHC ambulances',
        category: 'Roads',
        urgency: 'CRITICAL',
        locationAddress: 'Ward 82, Mahadevapura, Bengaluru',
      },
      {
        id: 'REQ-102',
        text: 'Road surface collapsed after drain overflow near hospital gate',
        category: 'Roads',
        urgency: 'HIGH',
        locationAddress: 'Ward 82, Mahadevapura, Bengaluru',
      },
      {
        id: 'REQ-103',
        text: 'Waterlogging on arterial link road causing severe vehicle damage',
        category: 'Roads',
        urgency: 'HIGH',
        locationAddress: 'Ward 82, Mahadevapura, Bengaluru',
      },
    ];

    it('synthesizes coherent thematic cluster with root cause hypothesis', async () => {
      const result = await synthesizeSignalCluster(mockSignals, 'Mahadevapura Ward 82', {
        provider: mockProvider,
      });

      expect(result.data).toBeDefined();
      expect(result.data.clusterTitle.length).toBeGreaterThanOrEqual(10);
      expect(result.data.primaryCategory).toBe('Roads');
      expect(result.data.thematicSummary.length).toBeGreaterThanOrEqual(20);
      expect(result.data.rootCauseHypothesis.length).toBeGreaterThanOrEqual(15);
      expect(result.data.representativeSignalIds).toContain('REQ-101');
      expect(result.data.coherenceScore).toBeGreaterThanOrEqual(0.7);
      expect(result.data.suggestedInterventionType.length).toBeGreaterThan(5);
    });

    it('deterministic fallback groups signals accurately by dominant category', () => {
      const fallback = deterministicClusteringFallback(mockSignals, 'Varanasi Sigra');
      expect(fallback.primaryCategory).toBe('Roads');
      expect(fallback.representativeSignalIds).toHaveLength(3);
      expect(fallback.coherenceScore).toBe(0.82);
    });
  });

  // ─── 4. Grounded Evidence Synthesis Tests ─────────────────────────────────

  describe('Isolated Evidence Synthesis Service', () => {
    const samplePack: EvidencePack = {
      hotspotCode: 'HOT-KA-BLR-001',
      areaName: 'Mahadevapura Ward 82',
      stateName: 'KA',
      category: 'Roads',
      requestCount: 18,
      growthRatePct: 42.5,
      vulnerablePopulation: 17200,
      infrastructureDistressPct: 67.5,
      evidenceList: [
        {
          id: 'EV-101',
          sourceEntity: 'CITIZEN_SIGNALS',
          metric: 'Citizen Incident Concentration',
          value: '18 verified reports (+42.5% spike)',
          period: 'Sept 2026',
          source: 'CivicTwin Ingestion Stream',
        },
        {
          id: 'EV-102',
          sourceEntity: 'ASSET_INSPECTION',
          metric: 'Pavement Failure Score',
          value: '32.5 / 100 (Critical Failure)',
          period: 'Aug 2026',
          source: 'BBMP Engineering Cell',
        },
        {
          id: 'EV-103',
          sourceEntity: 'CENSUS_SURVEY',
          metric: 'Vulnerable Population in Catchment',
          value: '17,200 residents reliant on PHC',
          period: '2026 Census Model',
          source: 'Census Analytics Cell',
        },
      ],
    };

    it('synthesizes grounded executive brief strictly citing verifiable evidence IDs', async () => {
      const result = await synthesizeEvidenceBrief(samplePack, { provider: mockProvider });

      expect(result.data).toBeDefined();
      expect(result.data.problemSummary.length).toBeGreaterThanOrEqual(20);
      expect(result.data.whyEmerging.length).toBeGreaterThanOrEqual(20);
      expect(result.data.potentialIntervention.length).toBeGreaterThanOrEqual(20);
      expect(result.data.dataLimitations.length).toBeGreaterThanOrEqual(10);
      expect(result.data.citedEvidenceIds.length).toBeGreaterThanOrEqual(1);

      // Verify cited IDs match verified evidence in pack
      const validIds = samplePack.evidenceList.map((e) => e.id);
      for (const id of result.data.citedEvidenceIds) {
        expect(validIds).toContain(id);
      }
    });

    it('deterministic fallback strictly cites verified evidence IDs without hallucination', () => {
      const fallback = deterministicBriefFallback(samplePack);
      expect(fallback.citedEvidenceIds).toContain('EV-101');
      expect(fallback.problemSummary).toContain(samplePack.areaName);
      expect(fallback.confidenceScore).toBeGreaterThanOrEqual(0.85);
    });
  });

  // ─── 5. Recommendation Generation & Priority Scoring Boundary ─────────────

  describe('Isolated Recommendation Service & Priority Boundary', () => {
    const samplePack: EvidencePack = {
      hotspotCode: 'HOT-KA-BLR-001',
      areaName: 'Mahadevapura Ward 82',
      stateName: 'KA',
      category: 'Roads',
      requestCount: 18,
      growthRatePct: 42.5,
      vulnerablePopulation: 17200,
      infrastructureDistressPct: 67.5,
      evidenceList: [
        {
          id: 'EV-101',
          sourceEntity: 'CITIZEN_SIGNALS',
          metric: 'Citizen Incident Concentration',
          value: '18 verified reports',
          period: 'Sept 2026',
          source: 'CivicTwin Ingestion Stream',
        },
      ],
    };

    it('generates comprehensive project proposal with milestones, cost ranges, and risk scoping', async () => {
      const result = await generateProjectRecommendation(samplePack, { provider: mockProvider });

      expect(result.data).toBeDefined();
      expect(result.data.projectTitle.length).toBeGreaterThanOrEqual(10);
      expect(result.data.scopeSummary.length).toBeGreaterThanOrEqual(25);
      expect(result.data.recommendedAction.length).toBeGreaterThanOrEqual(15);
      expect(result.data.targetHotspotCode).toBe(samplePack.hotspotCode);
      expect(result.data.infrastructureType).toBe(samplePack.category);

      // Cost ranges in INR
      expect(result.data.estimatedCost.currency).toBe('INR');
      expect(result.data.estimatedCost.minInr).toBeGreaterThan(0);
      expect(result.data.estimatedCost.maxInr).toBeGreaterThan(result.data.estimatedCost.minInr);

      // Milestones and risks
      expect(result.data.milestones.length).toBeGreaterThanOrEqual(1);
      expect(result.data.keyRisks.length).toBeGreaterThanOrEqual(1);
      expect(result.data.alternativeOptions.length).toBeGreaterThanOrEqual(1);
    });

    it('CRITICAL CONSTRAINT ENFORCEMENT: Gemini does NOT calculate or contain final priority score', async () => {
      const result = await generateProjectRecommendation(samplePack, { provider: mockProvider });

      // 1. Verify schema output has NO numerical priority score property
      expect((result.data as any).priorityScore).toBeUndefined();
      expect((result.data as any).finalPriorityScore).toBeUndefined();
      expect((result.data as any).compositeScore).toBeUndefined();
      expect((result.data as any).score).toBeUndefined();

      // 2. Verify priority score is calculated SOLELY by mathematical priority engine
      const mathematicalScore = computeMathematicalCompositeScore({
        request_volume: 85,
        infrastructure_gap: 67.5,
        affected_population: 75,
        urgency: 90,
        service_criticality: 80,
        investment_gap: 66.5,
      });

      expect(mathematicalScore).toBeDefined();
      expect(mathematicalScore.compositeScore).toBeGreaterThan(0);
      expect(mathematicalScore.compositeScore).toBeLessThanOrEqual(100);
      expect(mathematicalScore.factors).toBeDefined();
      expect(mathematicalScore.factors.length).toBe(6);
      expect(mathematicalScore.factors.some((f) => f.factorKey === 'request_volume')).toBe(true);
      expect(mathematicalScore.factors.some((f) => f.factorKey === 'infrastructure_gap')).toBe(true);
    });

    it('deterministic recommendation fallback provides structured scoping', () => {
      const fallback = deterministicRecommendationFallback(samplePack);
      expect(fallback.projectTitle).toContain(samplePack.areaName);
      expect(fallback.estimatedCost.minInr).toBe(4500000);
      expect(fallback.estimatedCost.maxInr).toBe(11500000);
      expect(fallback.milestones.length).toBe(4);
      expect(fallback.policyAlignment).toContain('AMRUT 2.0 (Atal Mission for Rejuvenation and Urban Transformation)');
    });
  });
});
