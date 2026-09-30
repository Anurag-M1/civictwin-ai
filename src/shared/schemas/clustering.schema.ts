import { z } from 'zod';
import { CIVIC_CATEGORIES } from '../constants.js';

export const ClusterSignalInputSchema = z.object({
  id: z.string(),
  text: z.string(),
  category: z.string().optional(),
  urgency: z.string().optional(),
  language: z.string().optional(),
  locationAddress: z.string().optional(),
});

export type ClusterSignalInput = z.infer<typeof ClusterSignalInputSchema>;

export const ClusterSynthesisSchema = z.object({
  clusterTitle: z.string().min(10, 'Cluster title must be descriptive (at least 10 chars)'),
  primaryCategory: z.enum(CIVIC_CATEGORIES),
  secondaryCategory: z.string().optional(),
  thematicSummary: z.string().min(20, 'Thematic summary must be at least 20 chars'),
  rootCauseHypothesis: z.string().min(15, 'Root cause hypothesis must be at least 15 chars'),
  geographicScope: z.string().min(5),
  representativeSignalIds: z.array(z.string()).min(1, 'Must include at least 1 representative signal ID'),
  coherenceScore: z.number().min(0).max(1),
  suggestedInterventionType: z.string().min(5),
  requiresHumanReview: z.boolean().default(false),
});

export type ClusterSynthesis = z.infer<typeof ClusterSynthesisSchema>;
