import { z } from 'zod';
import { HUMAN_REVIEW_ACTIONS } from '../constants.js';

export const HumanReviewInputSchema = z.object({
  targetType: z.enum(['HOTSPOT', 'RECOMMENDATION', 'CLUSTER', 'AI_ANALYSIS']),
  targetId: z.string().min(1, 'Target ID is required'),
  action: z.enum(HUMAN_REVIEW_ACTIONS),
  rationale: z.string().min(5, 'Review rationale must be at least 5 characters long'),
  previousValue: z.string().optional(),
  newValue: z.string().optional(),
});

export type HumanReviewInput = z.infer<typeof HumanReviewInputSchema>;
