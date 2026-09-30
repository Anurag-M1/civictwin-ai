/**
 * CivicTwin AI — Isolated Recommendation Generation Service
 *
 * Responsibilities:
 *   - Generates actionable infrastructure capital project scopes from verified hotspots
 *   - Determines realistic INR budget ranges, delivery milestones, and risk contingencies
 *   - Maps alignment to national infrastructure missions (AMRUT 2.0, PM GatiShakti, Smart Cities)
 *   - Evaluates alternative engineering interventions (e.g. patching vs full reconstruction)
 *   - Schema-enforced structured JSON output
 *
 * CRITICAL ARCHITECTURAL CONSTRAINT:
 * Gemini is NEVER permitted to calculate the final numerical priority score.
 * Priority scores are calculated deterministically by the mathematical priority engine
 * (`priority.service.ts`) using the multi-criteria formula.
 */

import {
  ProjectRecommendationAiSchema,
  type ProjectRecommendationAi,
} from '../../../shared/schemas/recommendation.schema.js';
import type { EvidencePack } from '../../../shared/schemas/brief.schema.js';
import { getAiProvider, type AiStructuredResult, type IAiProvider } from './ai-provider.js';

const RECOMMENDATION_SYSTEM_PROMPT = `You are CivicTwin AI's Principal Infrastructure Project Planner.

Your responsibility: Given a validated infrastructure hotspot and evidence pack, generate a concrete, actionable public works project proposal.

STRICT POLICY & ARCHITECTURAL CONSTRAINTS:
1. DO NOT calculate or propose any final priority score. Priority scoring is calculated strictly by the deterministic mathematical engine.
2. Formulate realistic cost estimations in Indian Rupees (INR) benchmarked to Central Public Works Department (CPWD) or State Schedule of Rates.
3. Structure clear delivery milestones with timeline estimates.
4. Compare at least two alternative engineering approaches (e.g., Quick Overlay vs Full Depth Reconstruction).
5. Ground scope in the evidence pack. Do NOT invent locations or unrelated assets.`;

export function deterministicRecommendationFallback(
  pack: EvidencePack,
): ProjectRecommendationAi {
  const isRoads = pack.category === 'Roads';
  const isWater = pack.category === 'Water';

  let projectTitle = `Infrastructure Upgrade & Resilience Project — ${pack.areaName}`;
  let scopeSummary = `Comprehensive rehabilitation of public infrastructure in ${pack.areaName}, directly resolving distress signals from ${pack.requestCount} citizen reports and protecting ${pack.vulnerablePopulation.toLocaleString()} residents.`;
  let recommendedAction = `Issue expedited administrative sanction for capital rehabilitation in ${pack.areaName}.`;
  let minCost = 3500000;
  let maxCost = 8500000;

  if (isRoads) {
    projectTitle = `Reconstruction & Stormwater Invert Lining of ${pack.areaName} Arterial Access Corridor`;
    scopeSummary = `Full-depth asphalt pavement reconstruction, heavy-duty subsurface aggregate stabilization, and roadside stormwater culvert integration along the primary PHC approach corridor in ${pack.areaName}.`;
    recommendedAction = 'Execute emergency road resurfacing with reinforced concrete drainage cross-culverts to prevent monsoon washout.';
    minCost = 4500000;
    maxCost = 11500000;
  } else if (isWater) {
    projectTitle = `Feeder Pipeline Replacement & Pressure Balancing in ${pack.areaName}`;
    scopeSummary = `Replacement of ruptured ductile iron trunk feeder line, installation of non-return pressure valves, and localized filtration augmentation across ${pack.areaName}.`;
    recommendedAction = 'Sanction emergency pipeline replacement under AMRUT 2.0 to restore potable water supply to affected ward residents.';
    minCost = 3800000;
    maxCost = 9200000;
  }

  return {
    projectTitle,
    scopeSummary,
    recommendedAction,
    targetHotspotCode: pack.hotspotCode,
    infrastructureType: pack.category,
    estimatedCost: {
      minInr: minCost,
      maxInr: maxCost,
      currency: 'INR',
    },
    implementationTimelineMonths: 6,
    keyRisks: [
      'Monsoon excavation delays leading to water accumulation',
      'Underground utility conflicts requiring inter-departmental clearances',
      'Traffic diversion management along arterial lanes',
    ],
    policyAlignment: [
      'AMRUT 2.0 (Atal Mission for Rejuvenation and Urban Transformation)',
      'PM GatiShakti National Master Plan',
      'Digital Public Infrastructure for Municipal Governance',
    ],
    milestones: [
      { stage: 'Detailed Project Report (DPR) & Geotechnical Survey', durationWeeks: 3, deliverables: 'Final DPR, soil bearing test, utility cross-sectional map' },
      { stage: 'Tender Publication & Contractor Award', durationWeeks: 4, deliverables: 'Transparent e-procurement award & work order' },
      { stage: 'Sub-surface Drainage & Earthwork', durationWeeks: 8, deliverables: 'Excavation, pipeline laying, culvert precast placement' },
      { stage: 'Surface Paving & Quality Certification', durationWeeks: 6, deliverables: 'Asphalt laydown, rebound hammer test, third-party audit' },
    ],
    alternativeOptions: [
      {
        title: 'Option A: Full Reconstruction with Integrated Stormwater Conduit (Recommended)',
        pros: '15-year design life, permanent resolution of recurrent flooding and pavement disintegration',
        cons: 'Higher initial capital expenditure and 6-month delivery window',
      },
      {
        title: 'Option B: Localized Cold-Mix Patching and Surface Sealing',
        pros: 'Immediate 2-week execution at 25% of capital cost',
        cons: 'High risk of failure during subsequent monsoon; recurring maintenance expense',
      },
    ],
    requiresHumanReview: true,
    confidenceScore: 0.9,
    explanationBrief: `Project scope designed specifically to eliminate systemic failure at ${pack.hotspotCode} without relying on AI for priority ranking.`,
  };
}

export async function generateProjectRecommendation(
  pack: EvidencePack,
  options?: {
    provider?: IAiProvider;
    timeoutMs?: number;
  },
): Promise<AiStructuredResult<ProjectRecommendationAi>> {
  const provider = options?.provider || getAiProvider();

  const prompt = `EVIDENCE PACK FOR PROJECT RECOMMENDATION:
Hotspot Code: ${pack.hotspotCode}
Administrative Area: ${pack.areaName}, ${pack.stateName}
Category: ${pack.category}
Verified Citizen Signal Volume: ${pack.requestCount} reports (+${pack.growthRatePct}% 14-day spike)
Vulnerable Population Catchment: ${pack.vulnerablePopulation.toLocaleString()} residents
Physical Infrastructure Distress Score: ${pack.infrastructureDistressPct}%

Generate a comprehensive, actionable project recommendation proposal adhering strictly to the schema.
DO NOT calculate a final priority score.`;

  return provider.generateStructured<ProjectRecommendationAi>({
    prompt,
    systemInstruction: RECOMMENDATION_SYSTEM_PROMPT,
    schema: ProjectRecommendationAiSchema,
    temperature: 0.1,
    maxTokens: 2048,
    timeoutMs: options?.timeoutMs || 15000,
    fallbackGenerator: () => deterministicRecommendationFallback(pack),
  });
}
