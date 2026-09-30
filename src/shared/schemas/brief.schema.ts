import { z } from 'zod';

export const EvidenceCategoryEnum = z.enum([
  'CITIZEN_SIGNALS',
  'INFRASTRUCTURE_ASSETS',
  'DEMOGRAPHICS',
  'PUBLIC_INVESTMENTS',
  'GRAPH_EVIDENCE',
]);
export type EvidenceCategory = z.infer<typeof EvidenceCategoryEnum>;

export const EvidenceItemSchema = z.object({
  id: z.string(), // e.g. EV-SIG-01, EV-AST-01, EV-DEM-01
  category: z.string().default('CITIZEN_SIGNALS'),
  sourceEntity: z.string(),
  metric: z.string(),
  value: z.string(),
  period: z.string(),
  source: z.string(),
  confidence: z.number().default(0.9),
  isOfficial: z.boolean().default(true),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const EvidencePackSchema = z.object({
  hotspotCode: z.string(),
  areaName: z.string(),
  stateName: z.string(),
  category: z.string(),
  requestCount: z.number(),
  growthRatePct: z.number(),
  vulnerablePopulation: z.number(),
  infrastructureDistressPct: z.number(),
  sufficiencyStatus: z.enum(['SUFFICIENT', 'INSUFFICIENT']).default('SUFFICIENT'),
  sufficiencyReason: z.string().default('Evidence verified against empirical datasets'),
  evidenceList: z.array(EvidenceItemSchema),
});

export type EvidencePack = z.infer<typeof EvidencePackSchema>;

export const EvidenceFindingSchema = z.object({
  evidenceId: z.string(),
  metric: z.string(),
  finding: z.string(),
  source: z.string(),
});
export type EvidenceFinding = z.infer<typeof EvidenceFindingSchema>;

export const HumanReviewRequirementSchema = z.object({
  required: z.boolean(),
  reason: z.string(),
});
export type HumanReviewRequirement = z.infer<typeof HumanReviewRequirementSchema>;

// Strict schema for Gemini Brief output
export const GroundedEvidenceBriefSchema = z.object({
  problem: z.string().min(20),
  evidence: z.array(EvidenceFindingSchema).min(1, 'Must cite at least one verified evidence finding'),
  potentialIntervention: z.string().min(20),
  implementationConsiderations: z.string().min(20),
  risks: z.string().min(20),
  dependencies: z.string().min(20),
  limitations: z.string().min(10),
  confidence: z.number().min(0).max(1),
  humanReviewRequirement: HumanReviewRequirementSchema,

  // Compatibility aliases for existing database fields
  problemSummary: z.string().optional(),
  whyEmerging: z.string().optional(),
  dataLimitations: z.string().optional(),
  confidenceScore: z.number().optional(),
  requiresHumanReview: z.boolean().optional(),
  citedEvidenceIds: z.array(z.string()).default([]),
});

export type GroundedEvidenceBrief = z.infer<typeof GroundedEvidenceBriefSchema>;
