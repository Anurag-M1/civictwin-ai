import { describe, it, expect } from 'vitest';
import {
  CitizenRequestInputSchema,
  AiNormalizedSignalSchema,
  WhatIfScenarioInputSchema,
  GroundedEvidenceBriefSchema,
} from '../src/shared/types/index.js';

describe('CivicTwin AI - Zod Schema Validation Guardrails', () => {
  it('validates a correct citizen request submission', () => {
    const valid = CitizenRequestInputSchema.safeParse({
      originalText: 'Road collapsed near district hospital',
      language: 'en',
      channel: 'WEB',
      location: {
        address: 'MG Road Junction',
        latitude: 12.9716,
        longitude: 77.5946,
      },
    });
    expect(valid.success).toBe(true);
  });

  it('rejects an invalid citizen request that is too short', () => {
    const invalid = CitizenRequestInputSchema.safeParse({
      originalText: 'Bad',
      language: 'en',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates structured AI extraction output', () => {
    const validAi = AiNormalizedSignalSchema.safeParse({
      category: 'Roads',
      subcategory: 'Pavement Failure',
      summary: 'Dangerous pothole blocking ambulance ingress',
      requestedAction: 'Resurface approach road',
      detectedLanguage: 'hi',
      urgency: 'HIGH',
      affectedService: 'Healthcare Access',
      confidence: 0.94,
      requiresHumanReview: false,
    });
    expect(validAi.success).toBe(true);
  });

  it('enforces citations in Grounded Evidence Briefs', () => {
    const missingCitations = GroundedEvidenceBriefSchema.safeParse({
      problemSummary: 'A long detailed problem summary for the test suite',
      whyEmerging: 'A long detailed explanation of why the problem is emerging',
      potentialIntervention: 'A long detailed technical intervention proposal',
      implementationConsiderations: 'A long detailed set of implementation considerations',
      risks: 'A long detailed description of technical and weather risks',
      dependencies: 'A long detailed explanation of inter-agency dependencies',
      dataLimitations: 'Data limitations statement',
      confidenceScore: 0.9,
      requiresHumanReview: true,
      citedEvidenceIds: [], // Empty citations should fail!
    });
    expect(missingCitations.success).toBe(false);
  });
});
