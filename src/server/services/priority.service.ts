/**
 * CivicTwin AI — Explainable Priority Engine Service
 *
 * Deterministic multi-factor prioritization engine.
 * Computes explainable, auditable, reproducible, and versioned priority scores combining:
 *   1. Infrastructure physical distress / asset condition gap (28%)
 *   2. Citizen request volume & spatial concentration (22%)
 *   3. Vulnerable population & demographic equity (19%)
 *   4. Citizen perceived urgency & safety criticality (14%)
 *   5. Essential public service criticality (10%)
 *   6. Historic public capex investment gap (7%)
 *
 * Strict architectural boundary:
 *   Gemini does NOT compute numerical priorities, weights, or arithmetic.
 *   All arithmetic is pure deterministic math, fully verifiable and auditable.
 */

import { prisma } from '../db.js';
import { DEFAULT_PRIORITY_WEIGHTS, PRIORITY_FACTOR_LABELS } from '../../shared/constants.js';
import { logAuditEvent } from './audit.service.js';

export interface PriorityWeights {
  infrastructure_gap: number;
  request_volume: number;
  affected_population: number;
  urgency: number;
  service_criticality: number;
  investment_gap: number;
}

export type PriorityFactorKey = keyof PriorityWeights;

export const PRIORITY_FACTOR_UNITS: Record<PriorityFactorKey, string> = {
  infrastructure_gap: '% physical distress rating',
  request_volume: 'citizen distress complaints',
  affected_population: '% vulnerable population in catchment',
  urgency: 'hazard urgency index (0-100)',
  service_criticality: 'service criticality index (0-100)',
  investment_gap: 'capex deficit index (0-100)',
};

export const PRIORITY_MODEL_VERSIONS: Record<
  string,
  { name: string; description: string; weights: PriorityWeights }
> = {
  'v1.0-deterministic': {
    name: 'Standard Balanced DPI Model',
    description: 'Balanced framework weighting infrastructure condition (28%), citizen signals (22%), and demographics (19%).',
    weights: { ...DEFAULT_PRIORITY_WEIGHTS },
  },
  'v1.1-monsoon-weighted': {
    name: 'Monsoon Hazard & Emergency Model',
    description: 'Crisis framework prioritizing infrastructure failure (35%) and citizen urgency (18%).',
    weights: {
      infrastructure_gap: 0.35,
      request_volume: 0.20,
      affected_population: 0.15,
      urgency: 0.18,
      service_criticality: 0.08,
      investment_gap: 0.04,
    },
  },
  'v1.2-equity-focused': {
    name: 'Social Equity & Demographic Vulnerability Model',
    description: 'DPI equity framework placing highest weight on vulnerable communities and historically underfunded wards.',
    weights: {
      infrastructure_gap: 0.20,
      request_volume: 0.15,
      affected_population: 0.35,
      urgency: 0.12,
      service_criticality: 0.10,
      investment_gap: 0.08,
    },
  },
};

export interface FactorBreakdown {
  factorKey: PriorityFactorKey;
  factorLabel: string;
  rawValue: number;
  rawUnit: string;
  normalizedValue: number;
  weight: number;
  contributionPct: number;
  formulaDescription: string;
}

export interface PriorityCalculationResult {
  assessmentCode: string;
  hotspotId: string;
  compositeScore: number;
  riskTier: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL';
  modelVersion: string;
  calculatedAt: Date;
  mathematicalProof: string;
  factors: FactorBreakdown[];
}

/**
 * Normalizes custom weights so the sum is strictly 1.00000.
 */
export function normalizeWeights(customWeights?: Partial<PriorityWeights>): PriorityWeights {
  const base: PriorityWeights = {
    ...DEFAULT_PRIORITY_WEIGHTS,
    ...(customWeights || {}),
  };

  const keys = Object.keys(DEFAULT_PRIORITY_WEIGHTS) as PriorityFactorKey[];
  const sum = keys.reduce((acc, k) => acc + (base[k] ?? 0), 0);

  if (sum <= 0) {
    return { ...DEFAULT_PRIORITY_WEIGHTS };
  }

  // Scale weights proportionally
  const normalized: any = {};
  for (const k of keys) {
    normalized[k] = Number(((base[k] ?? 0) / sum).toFixed(4));
  }

  // Adjust any minor rounding residue onto the largest weight (infrastructure_gap)
  const normSum = keys.reduce((acc, k) => acc + normalized[k], 0);
  const residue = Number((1.0 - normSum).toFixed(4));
  normalized.infrastructure_gap = Number((normalized.infrastructure_gap + residue).toFixed(4));

  return normalized as PriorityWeights;
}

/**
 * Assigns a standardized DPI Risk Tier based on priority composite score.
 */
export function getRiskTier(score: number): 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL' {
  if (score >= 75) return 'CRITICAL';
  if (score >= 60) return 'ELEVATED';
  if (score >= 40) return 'MODERATE';
  return 'LOW';
}

/**
 * Pure mathematical priority scoring function.
 * Enforces strict deterministic boundary: Gemini NEVER calculates numerical priorities.
 */
export function computeMathematicalCompositeScore(
  factorValues: Record<PriorityFactorKey, number>,
  customWeights?: Partial<PriorityWeights>,
  modelVersion = 'v1.0-deterministic',
): {
  compositeScore: number;
  riskTier: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL';
  mathematicalProof: string;
  factors: FactorBreakdown[];
} {
  const selectedModel = PRIORITY_MODEL_VERSIONS[modelVersion];
  const baseWeights = selectedModel ? selectedModel.weights : DEFAULT_PRIORITY_WEIGHTS;

  const weights: PriorityWeights = customWeights
    ? normalizeWeights({ ...baseWeights, ...customWeights })
    : { ...baseWeights };

  const factors: FactorBreakdown[] = (
    Object.keys(DEFAULT_PRIORITY_WEIGHTS) as PriorityFactorKey[]
  ).map((key) => {
    const rawValue = factorValues[key] ?? 50;
    // Normalized to 0–100 bounded scale
    const normalizedValue = Number(Math.min(Math.max(rawValue, 0), 100).toFixed(2));
    const weight = weights[key];
    const contributionPct = Number((normalizedValue * weight).toFixed(2));
    const rawUnit = PRIORITY_FACTOR_UNITS[key] || '';
    const formulaDescription = `${normalizedValue.toFixed(1)} [norm] × ${(weight * 100).toFixed(1)}% = ${contributionPct.toFixed(2)} pts`;

    return {
      factorKey: key,
      factorLabel: PRIORITY_FACTOR_LABELS[key] || key,
      rawValue: Number(rawValue.toFixed(2)),
      rawUnit,
      normalizedValue,
      weight,
      contributionPct,
      formulaDescription,
    };
  });

  const compositeScore = Number(
    factors.reduce((sum, f) => sum + f.contributionPct, 0).toFixed(2),
  );

  const proofTerms = factors.map((f) => `${f.contributionPct.toFixed(2)} [${f.factorKey}]`).join(' + ');
  const mathematicalProof = `Composite Score = ${proofTerms} = ${compositeScore.toFixed(2)} / 100`;
  const riskTier = getRiskTier(compositeScore);

  return { compositeScore, riskTier, mathematicalProof, factors };
}

/**
 * Calculates priority score for an existing hotspot using grounded database records.
 */
export async function calculateHotspotPriority(
  hotspotId: string,
  customWeights?: Partial<PriorityWeights>,
  modelVersion = 'v1.0-deterministic',
): Promise<PriorityCalculationResult> {
  const hotspot = await prisma.hotspot.findUnique({
    where: { id: hotspotId },
    include: {
      administrativeArea: {
        include: {
          demographics: { take: 1, orderBy: { year: 'desc' } },
          investments: true,
        },
      },
      issueCluster: {
        include: {
          citizenRequests: true,
        },
      },
    },
  });

  if (!hotspot) {
    throw new Error(`Hotspot not found: ${hotspotId}`);
  }

  // 1. Calculate raw factor values from actual database entities
  // Factor 1: Infrastructure gap (0-100)
  const rawInfraGap = hotspot.infrastructureGapScore;

  // Factor 2: Request volume (scaled deterministically: 1 request ~ 14.5 pts, capped at 100)
  const rawVolume = hotspot.requestCount;
  const normVolume = Math.min(100, Math.max(10, rawVolume * 14.5));

  // Factor 3: Affected vulnerable population percentage
  const demographic = hotspot.administrativeArea.demographics?.[0];
  const rawVuln =
    demographic && demographic.totalPopulation > 0
      ? Number(((demographic.vulnerablePopulation / demographic.totalPopulation) * 100).toFixed(1))
      : hotspot.vulnerabilityScore;

  // Factor 4: Perceived citizen urgency
  let rawUrgency = 50;
  if (hotspot.issueCluster?.citizenRequests?.length) {
    const urgencyMap: Record<string, number> = { LOW: 25, MEDIUM: 50, HIGH: 75, CRITICAL: 100 };
    const sum = hotspot.issueCluster.citizenRequests.reduce(
      (acc, r) => acc + (urgencyMap[r.urgency] ?? 50),
      0,
    );
    rawUrgency = Number((sum / hotspot.issueCluster.citizenRequests.length).toFixed(1));
  }

  // Factor 5: Service criticality
  const rawCriticality = hotspot.serviceCriticalityScore;

  // Factor 6: Investment gap
  const rawInvestmentGap = hotspot.investmentGapScore;

  // Factor values mapping
  const factorValues: Record<PriorityFactorKey, number> = {
    infrastructure_gap: rawInfraGap,
    request_volume: normVolume, // Normalized volume value
    affected_population: rawVuln,
    urgency: rawUrgency,
    service_criticality: rawCriticality,
    investment_gap: rawInvestmentGap,
  };

  const { compositeScore, riskTier, mathematicalProof, factors } =
    computeMathematicalCompositeScore(factorValues, customWeights, modelVersion);

  // Use raw volume in the factor record for human clarity
  const factorRecords = factors.map((f) => {
    if (f.factorKey === 'request_volume') {
      return { ...f, rawValue: rawVolume };
    }
    return f;
  });

  const assessmentCode = `PA-2026-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  // Persist assessment & factor contributions in transaction
  await prisma.$transaction(async (tx) => {
    const assessment = await tx.priorityAssessment.create({
      data: {
        assessmentCode,
        hotspotId,
        administrativeAreaId: hotspot.administrativeAreaId,
        compositeScore,
        modelVersion,
      },
    });

    for (const factor of factorRecords) {
      await tx.priorityFactorContribution.create({
        data: {
          priorityAssessmentId: assessment.id,
          factorKey: factor.factorKey,
          factorLabel: factor.factorLabel,
          rawValue: factor.rawValue,
          normalizedValue: factor.normalizedValue,
          weight: factor.weight,
          contributionPct: factor.contributionPct,
        },
      });
    }

    // Update hotspot's prioritySignalScore
    await tx.hotspot.update({
      where: { id: hotspotId },
      data: {
        prioritySignalScore: compositeScore,
      },
    });
  });

  // Audit event
  await logAuditEvent({
    eventType: 'PRIORITY_COMPUTED',
    sourceModule: 'PRIORITY_ENGINE',
    modelIdentifier: modelVersion,
    inputContent: { hotspotId, factorValues, weights: customWeights },
    outputContent: { compositeScore, riskTier, factors: factorRecords },
    validationStatus: 'VALID',
    performedBy: 'PRIORITY_SERVICE',
    metadata: {
      assessmentCode,
      hotspotId,
      compositeScore,
      riskTier,
    },
  });

  return {
    assessmentCode,
    hotspotId,
    compositeScore,
    riskTier,
    modelVersion,
    calculatedAt: new Date(),
    mathematicalProof,
    factors: factorRecords,
  };
}

/**
 * Retrieves historical assessments for a hotspot, ordered newest to oldest.
 */
export async function getHistoricalAssessments(hotspotId: string) {
  const assessments = await prisma.priorityAssessment.findMany({
    where: { hotspotId },
    include: {
      factorContributions: true,
      scenarios: {
        take: 3,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { calculatedAt: 'desc' },
    take: 20,
  });

  return assessments.map((a) => ({
    id: a.id,
    assessmentCode: a.assessmentCode,
    compositeScore: a.compositeScore,
    riskTier: getRiskTier(a.compositeScore),
    modelVersion: a.modelVersion,
    calculatedAt: a.calculatedAt,
    factors: a.factorContributions.map((fc) => ({
      factorKey: fc.factorKey,
      factorLabel: fc.factorLabel,
      rawValue: fc.rawValue,
      rawUnit: PRIORITY_FACTOR_UNITS[fc.factorKey as PriorityFactorKey] || '',
      normalizedValue: fc.normalizedValue,
      weight: fc.weight,
      contributionPct: fc.contributionPct,
    })),
    scenariosCount: a.scenarios.length,
  }));
}

/**
 * Retrieves a single assessment by ID with complete factor breakdown.
 */
export async function getSingleAssessment(assessmentId: string) {
  const assessment = await prisma.priorityAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      hotspot: {
        include: {
          administrativeArea: true,
          issueCluster: true,
        },
      },
      factorContributions: true,
      scenarios: true,
    },
  });

  if (!assessment) {
    throw new Error(`Assessment not found: ${assessmentId}`);
  }

  return {
    id: assessment.id,
    assessmentCode: assessment.assessmentCode,
    compositeScore: assessment.compositeScore,
    riskTier: getRiskTier(assessment.compositeScore),
    modelVersion: assessment.modelVersion,
    calculatedAt: assessment.calculatedAt,
    hotspot: assessment.hotspot,
    factors: assessment.factorContributions.map((fc) => ({
      factorKey: fc.factorKey,
      factorLabel: fc.factorLabel,
      rawValue: fc.rawValue,
      rawUnit: PRIORITY_FACTOR_UNITS[fc.factorKey as PriorityFactorKey] || '',
      normalizedValue: fc.normalizedValue,
      weight: fc.weight,
      contributionPct: fc.contributionPct,
      formulaDescription: `${fc.normalizedValue.toFixed(1)} × ${(fc.weight * 100).toFixed(1)}% = ${fc.contributionPct.toFixed(2)} pts`,
    })),
    scenarios: assessment.scenarios,
  };
}

/**
 * Compares two assessments side-by-side to show factor shifts.
 */
export async function compareAssessments(assessmentIdA: string, assessmentIdB: string) {
  const [a, b] = await Promise.all([
    getSingleAssessment(assessmentIdA),
    getSingleAssessment(assessmentIdB),
  ]);

  const factorDeltas = a.factors.map((fA) => {
    const fB = b.factors.find((f) => f.factorKey === fA.factorKey);
    const bContrib = fB ? fB.contributionPct : 0;
    const deltaContrib = Number((bContrib - fA.contributionPct).toFixed(2));

    return {
      factorKey: fA.factorKey,
      factorLabel: fA.factorLabel,
      assessmentAContrib: fA.contributionPct,
      assessmentBContrib: bContrib,
      deltaContribution: deltaContrib,
      direction: deltaContrib > 0 ? 'INCREASE' : deltaContrib < 0 ? 'DECREASE' : 'UNCHANGED',
    };
  });

  return {
    assessmentA: {
      id: a.id,
      code: a.assessmentCode,
      score: a.compositeScore,
      modelVersion: a.modelVersion,
      date: a.calculatedAt,
    },
    assessmentB: {
      id: b.id,
      code: b.assessmentCode,
      score: b.compositeScore,
      modelVersion: b.modelVersion,
      date: b.calculatedAt,
    },
    scoreDelta: Number((b.compositeScore - a.compositeScore).toFixed(2)),
    factorDeltas,
  };
}
