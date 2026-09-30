import { z } from 'zod';
import { CIVIC_CATEGORIES, URGENCY_LEVELS } from '../constants.js';

// Schema for incoming Citizen Submission via Web/Voice
export const CitizenRequestInputSchema = z.object({
  originalText: z
    .string({ required_error: 'Citizen request description is required' })
    .trim()
    .min(5, 'Description must be at least 5 characters long'),
  language: z.enum(['en', 'hi', 'bn', 'ta', 'te', 'mr']).default('en'),
  channel: z.enum(['WEB', 'VOICE', 'MESSAGING']).default('WEB'),
  administrativeAreaId: z.string().optional(),
  location: z
    .object({
      address: z.string().trim().min(2, 'Address must be at least 2 characters long'),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      landmark: z.string().optional().nullable(),
    })
    .optional(),
  mediaUrl: z.string().url().optional().nullable().or(z.literal('')),
  idempotencyKey: z.string().optional(),
});

export type CitizenRequestInput = z.infer<typeof CitizenRequestInputSchema>;

// Schema for Gemini Structured Extraction Output
export const AiNormalizedSignalSchema = z.object({
  category: z.enum(CIVIC_CATEGORIES),
  subcategory: z.string().min(1),
  summary: z.string().min(5),
  requestedAction: z.string().min(3),
  detectedLanguage: z.string(),
  locationMentions: z.array(z.string()).default([]),
  urgency: z.enum(URGENCY_LEVELS),
  affectedService: z.string().min(1),
  confidence: z.number().min(0).max(1),
  requiresHumanReview: z.boolean().default(false),
  reasoningBrief: z.string().optional(),
});

export type AiNormalizedSignal = z.infer<typeof AiNormalizedSignalSchema>;
