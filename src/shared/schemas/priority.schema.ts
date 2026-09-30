import { z } from 'zod';

export const PriorityWeightsSchema = z.object({
  infrastructure_gap: z.number().min(0).max(1),
  request_volume: z.number().min(0).max(1),
  affected_population: z.number().min(0).max(1),
  urgency: z.number().min(0).max(1),
  service_criticality: z.number().min(0).max(1),
  investment_gap: z.number().min(0).max(1),
});

export type PriorityWeights = z.infer<typeof PriorityWeightsSchema>;

export const CalculatePriorityInputSchema = z.object({
  weights: PriorityWeightsSchema.partial().optional(),
  modelVersion: z.string().optional(),
});

export type CalculatePriorityInput = z.infer<typeof CalculatePriorityInputSchema>;

export const WhatIfScenarioInputSchema = z.object({
  hotspotId: z.string().uuid(),
  scenarioName: z.string().min(3),
  description: z.string().optional(),
  overrides: z.object({
    requestVolumeFactor: z.number().min(0.1).max(5.0).default(1.0),
    infrastructureDistressDelta: z.number().min(-50).max(50).default(0.0),
    vulnerabilityWeightDelta: z.number().min(-0.2).max(0.2).default(0.0),
    investmentGapDelta: z.number().min(-50).max(50).default(0.0),
    serviceCriticalityDelta: z.number().min(-30).max(30).default(0.0),
    urgencyOverride: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    customWeights: PriorityWeightsSchema.partial().optional(),
  }),
});

export type WhatIfScenarioInput = z.infer<typeof WhatIfScenarioInputSchema>;

export interface SimulationPreset {
  id: string;
  name: string;
  description: string;
  badge: string;
  overrides: {
    requestVolumeFactor: number;
    infrastructureDistressDelta: number;
    vulnerabilityWeightDelta: number;
    investmentGapDelta: number;
    urgencyOverride?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
}

