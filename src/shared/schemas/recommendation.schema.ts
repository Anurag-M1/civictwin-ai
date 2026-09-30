import { z } from 'zod';

export const MilestoneSchema = z.object({
  stage: z.string().min(3),
  durationWeeks: z.number().min(1),
  deliverables: z.string().min(5),
});

export const AlternativeOptionSchema = z.object({
  title: z.string().min(5),
  pros: z.string().min(5),
  cons: z.string().min(5),
});

/**
 * AI Project Recommendation Schema
 *
 * CRITICAL ARCHITECTURAL CONSTRAINT:
 * Gemini is NEVER allowed to calculate the final priority score.
 * Priority scoring is strictly computed by the deterministic mathematical priority engine
 * using the multi-criteria weighted formula in `priority.service.ts`.
 */
export const ProjectRecommendationAiSchema = z.object({
  projectTitle: z.string().min(10, 'Project title must be at least 10 characters'),
  scopeSummary: z.string().min(25, 'Scope summary must be at least 25 characters'),
  recommendedAction: z.string().min(15, 'Recommended action must be at least 15 characters'),
  targetHotspotCode: z.string(),
  infrastructureType: z.string().min(3),
  estimatedCost: z.object({
    minInr: z.number().positive(),
    maxInr: z.number().positive(),
    currency: z.literal('INR'),
  }),
  implementationTimelineMonths: z.number().min(1).max(60),
  keyRisks: z.array(z.string().min(5)).min(1, 'At least one key risk must be documented'),
  policyAlignment: z.array(z.string()).default([]),
  milestones: z.array(MilestoneSchema).min(1, 'At least one project milestone must be specified'),
  alternativeOptions: z.array(AlternativeOptionSchema).default([]),
  requiresHumanReview: z.boolean().default(true),
  confidenceScore: z.number().min(0).max(1),
  explanationBrief: z.string().min(20),
});

export type ProjectRecommendationAi = z.infer<typeof ProjectRecommendationAiSchema>;
