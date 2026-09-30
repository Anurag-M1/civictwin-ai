/**
 * CivicTwin AI — What-If Scenario Simulator Service
 *
 * Deterministic counterfactual simulation engine allowing urban planners, municipal
 * commissioners, and policy analysts to simulate policy, climate, and operational scenarios:
 *   - "What if citizen reporting surges by 3x due to viral mobile uptake?"
 *   - "What if monsoon flooding causes an additional +25% physical distress?"
 *   - "What if we adopt an equity-weighted policy prioritizing vulnerable wards?"
 *   - "What if AMRUT 2.0 infuses targeted capital to close the capex gap?"
 *
 * Strict architectural boundary:
 *   Gemini does NOT compute numerical priorities or scenario arithmetic.
 *   All calculations are deterministic, reproducible, auditable, and transparent.
 */

import { prisma } from '../db.js';
import { DEFAULT_PRIORITY_WEIGHTS, PRIORITY_FACTOR_LABELS } from '../../shared/constants.js';
import type { WhatIfScenarioInput, SimulationPreset } from '../../shared/schemas/priority.schema.js';
import {
  computeMathematicalCompositeScore,
  calculateHotspotPriority,
  normalizeWeights,
  getRiskTier,
  PriorityWeights,
  PriorityFactorKey,
  PRIORITY_FACTOR_UNITS,
} from './priority.service.js';
import { logAuditEvent } from './audit.service.js';

export const STANDARD_SIMULATION_PRESETS: SimulationPreset[] = [
  {
    id: 'monsoon_crisis',
    name: 'Monsoon Flooding & Drainage Collapse',
    description: 'Simulates severe monsoon inundation causing +25% road/drainage distress, 2.5x citizen distress calls, and emergency hazards.',
    badge: 'Climate Stress',
    overrides: {
      requestVolumeFactor: 2.5,
      infrastructureDistressDelta: 25.0,
      vulnerabilityWeightDelta: 0.0,
      investmentGapDelta: 0.0,
      urgencyOverride: 'CRITICAL',
    },
  },
  {
    id: 'citizen_intake_surge',
    name: 'Citizen Awareness & Mobile Intake Surge',
    description: 'Simulates high citizen engagement with 3.0x reporting volume across multilingual channels.',
    badge: 'Civic Demand',
    overrides: {
      requestVolumeFactor: 3.0,
      infrastructureDistressDelta: 0.0,
      vulnerabilityWeightDelta: 0.0,
      investmentGapDelta: 0.0,
    },
  },
  {
    id: 'equity_first',
    name: 'Social Equity & Vulnerable Catchment Prioritization',
    description: 'Reallocates analytical weights to prioritize informal settlements and vulnerable demographics (+15% demographic weight).',
    badge: 'Policy Reform',
    overrides: {
      requestVolumeFactor: 1.0,
      infrastructureDistressDelta: 0.0,
      vulnerabilityWeightDelta: 0.15,
      investmentGapDelta: 0.0,
    },
  },
  {
    id: 'capex_repair_grant',
    name: 'Targeted AMRUT 2.0 / PMGSY Asset Repair Grant',
    description: 'Simulates capital expenditure infusion closing 30% of the historical capex deficit and repairing physical assets (-35% distress).',
    badge: 'Capital Infusion',
    overrides: {
      requestVolumeFactor: 1.0,
      infrastructureDistressDelta: -35.0,
      vulnerabilityWeightDelta: 0.0,
      investmentGapDelta: -30.0,
    },
  },
  {
    id: 'rapid_triage_mitigation',
    name: 'Municipal Rapid Desilting & Emergency Triage',
    description: 'Simulates emergency municipal team dispatch resolving immediate safety hazards (Urgency reduced to LOW, distress reduced by -15%).',
    badge: 'Rapid Response',
    overrides: {
      requestVolumeFactor: 0.8,
      infrastructureDistressDelta: -15.0,
      vulnerabilityWeightDelta: 0.0,
      investmentGapDelta: 0.0,
      urgencyOverride: 'LOW',
    },
  },
];

export interface FactorComparison {
  factorKey: PriorityFactorKey;
  factorLabel: string;
  rawUnit: string;
  baselineRaw: number;
  simulatedRaw: number;
  deltaRaw: number;
  baselineNorm: number;
  simulatedNorm: number;
  deltaNorm: number;
  baselineWeight: number;
  simulatedWeight: number;
  baselineContribution: number;
  simulatedContribution: number;
  deltaContribution: number;
  impactDirection: 'INCREASE' | 'DECREASE' | 'NEUTRAL';
}

export interface SimulationResult {
  scenarioId: string;
  scenarioName: string;
  description: string | null;
  hotspotId: string;
  hotspotCode: string;
  category: string;
  administrativeArea: string;
  baselineScore: number;
  baselineRiskTier: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL';
  resultingScore: number;
  simulatedRiskTier: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL';
  scoreDelta: number;
  tierTransition: {
    from: string;
    to: string;
    changed: boolean;
  };
  sensitivityDrivers: {
    factorKey: PriorityFactorKey;
    factorLabel: string;
    deltaContribution: number;
    contributionSharePct: number;
  }[];
  driverSummary: string;
  factorComparisons: FactorComparison[];
  parameterOverrides: WhatIfScenarioInput['overrides'];
  simulatedAt: Date;
}

export async function runWhatIfSimulation(input: WhatIfScenarioInput): Promise<SimulationResult> {
  const { hotspotId, scenarioName, description, overrides } = input;

  const hotspot = await prisma.hotspot.findUnique({
    where: { id: hotspotId },
    include: {
      administrativeArea: {
        include: {
          demographics: { take: 1, orderBy: { year: 'desc' } },
        },
      },
      issueCluster: {
        include: {
          citizenRequests: true,
        },
      },
      priorityAssessments: {
        orderBy: { calculatedAt: 'desc' },
        take: 1,
        include: { factorContributions: true },
      },
    },
  });

  if (!hotspot) {
    throw new Error(`Hotspot not found: ${hotspotId}`);
  }

  // Ensure baseline assessment exists
  let baselineAssessment = hotspot.priorityAssessments[0];
  if (!baselineAssessment) {
    const computed = await calculateHotspotPriority(hotspotId);
    baselineAssessment = (await prisma.priorityAssessment.findUnique({
      where: { assessmentCode: computed.assessmentCode },
      include: { factorContributions: true },
    }))!;
  }

  // Map baseline factor contributions by key
  const baselineFactorsMap = new Map(
    baselineAssessment.factorContributions.map((fc) => [fc.factorKey as PriorityFactorKey, fc]),
  );

  // Baseline raw values
  const baseInfraGap = hotspot.infrastructureGapScore;
  const baseVolume = hotspot.requestCount;
  const baseDemo = hotspot.administrativeArea.demographics?.[0];
  const baseVuln =
    baseDemo && baseDemo.totalPopulation > 0
      ? Number(((baseDemo.vulnerablePopulation / baseDemo.totalPopulation) * 100).toFixed(1))
      : hotspot.vulnerabilityScore;

  let baseUrgency = 50;
  if (hotspot.issueCluster?.citizenRequests?.length) {
    const urgencyMap: Record<string, number> = { LOW: 25, MEDIUM: 50, HIGH: 75, CRITICAL: 100 };
    const sum = hotspot.issueCluster.citizenRequests.reduce(
      (acc, r) => acc + (urgencyMap[r.urgency] ?? 50),
      0,
    );
    baseUrgency = Number((sum / hotspot.issueCluster.citizenRequests.length).toFixed(1));
  }
  const baseCrit = hotspot.serviceCriticalityScore;
  const baseInvestmentGap = hotspot.investmentGapScore;

  // 1. Compute counterfactual adjusted raw values
  const adjustedInfraGap = Number(
    Math.min(100, Math.max(0, baseInfraGap + (overrides.infrastructureDistressDelta || 0))).toFixed(2),
  );

  const adjustedRawVolume = Number(
    Math.max(1, Math.round(baseVolume * (overrides.requestVolumeFactor || 1.0))),
  );
  const adjustedNormVolume = Number(
    Math.min(100, Math.max(10, adjustedRawVolume * 14.5)).toFixed(2),
  );

  let adjustedUrgency = baseUrgency;
  if (overrides.urgencyOverride) {
    const urgencyMap: Record<string, number> = { LOW: 25, MEDIUM: 50, HIGH: 75, CRITICAL: 100 };
    adjustedUrgency = urgencyMap[overrides.urgencyOverride] ?? 50;
  }

  const adjustedCrit = Number(
    Math.min(100, Math.max(0, baseCrit + (overrides.serviceCriticalityDelta || 0))).toFixed(2),
  );

  const adjustedInvestmentGap = Number(
    Math.min(100, Math.max(0, baseInvestmentGap + (overrides.investmentGapDelta || 0))).toFixed(2),
  );

  const adjustedVuln = baseVuln;

  // 2. Compute counterfactual weights
  let simulatedWeights: PriorityWeights;
  if (overrides.customWeights) {
    simulatedWeights = normalizeWeights(overrides.customWeights);
  } else if (overrides.vulnerabilityWeightDelta && overrides.vulnerabilityWeightDelta !== 0) {
    const baseW = { ...DEFAULT_PRIORITY_WEIGHTS };
    const targetVulnW = Math.min(0.50, Math.max(0.05, baseW.affected_population + overrides.vulnerabilityWeightDelta));
    const delta = targetVulnW - baseW.affected_population;

    // Proportionally deduct from other weights
    const otherKeys: PriorityFactorKey[] = [
      'infrastructure_gap',
      'request_volume',
      'urgency',
      'service_criticality',
      'investment_gap',
    ];
    const otherSum = otherKeys.reduce((acc, k) => acc + baseW[k], 0);

    const rebalanced: any = { affected_population: targetVulnW };
    for (const k of otherKeys) {
      const share = baseW[k] / otherSum;
      rebalanced[k] = Math.max(0.02, baseW[k] - delta * share);
    }
    simulatedWeights = normalizeWeights(rebalanced);
  } else {
    simulatedWeights = { ...DEFAULT_PRIORITY_WEIGHTS };
  }

  // 3. Compute deterministic composite score for simulated state
  const simulatedFactorValues: Record<PriorityFactorKey, number> = {
    infrastructure_gap: adjustedInfraGap,
    request_volume: adjustedNormVolume,
    affected_population: adjustedVuln,
    urgency: adjustedUrgency,
    service_criticality: adjustedCrit,
    investment_gap: adjustedInvestmentGap,
  };

  const simMath = computeMathematicalCompositeScore(simulatedFactorValues, simulatedWeights);
  const resultingScore = simMath.compositeScore;
  const scoreDelta = Number((resultingScore - baselineAssessment.compositeScore).toFixed(2));

  // 4. Construct side-by-side factor comparison
  const factorKeys: PriorityFactorKey[] = [
    'infrastructure_gap',
    'request_volume',
    'affected_population',
    'urgency',
    'service_criticality',
    'investment_gap',
  ];

  const factorComparisons: FactorComparison[] = factorKeys.map((key) => {
    const baseFc = baselineFactorsMap.get(key);
    const simFc = simMath.factors.find((f) => f.factorKey === key)!;

    const baseRaw = baseFc ? baseFc.rawValue : 50;
    const simRaw = key === 'request_volume' ? adjustedRawVolume : simFc.rawValue;
    const deltaRaw = Number((simRaw - baseRaw).toFixed(2));

    const baseNorm = baseFc ? baseFc.normalizedValue : 50;
    const simNorm = simFc.normalizedValue;
    const deltaNorm = Number((simNorm - baseNorm).toFixed(2));

    const baseWeight = baseFc ? baseFc.weight : DEFAULT_PRIORITY_WEIGHTS[key];
    const simWeight = simFc.weight;

    const baseContrib = baseFc ? baseFc.contributionPct : 0;
    const simContrib = simFc.contributionPct;
    const deltaContrib = Number((simContrib - baseContrib).toFixed(2));

    const impactDirection =
      deltaContrib > 0.05 ? 'INCREASE' : deltaContrib < -0.05 ? 'DECREASE' : 'NEUTRAL';

    return {
      factorKey: key,
      factorLabel: PRIORITY_FACTOR_LABELS[key],
      rawUnit: PRIORITY_FACTOR_UNITS[key],
      baselineRaw: Number(baseRaw.toFixed(2)),
      simulatedRaw: Number(simRaw.toFixed(2)),
      deltaRaw,
      baselineNorm: Number(baseNorm.toFixed(2)),
      simulatedNorm: Number(simNorm.toFixed(2)),
      deltaNorm,
      baselineWeight: Number(baseWeight.toFixed(4)),
      simulatedWeight: Number(simWeight.toFixed(4)),
      baselineContribution: baseContrib,
      simulatedContribution: simContrib,
      deltaContribution: deltaContrib,
      impactDirection,
    };
  });

  // 5. Sensitivity & Driver Ranking
  const totalAbsoluteDelta = factorComparisons.reduce(
    (sum, fc) => sum + Math.abs(fc.deltaContribution),
    0,
  );

  const sensitivityDrivers = [...factorComparisons]
    .filter((fc) => Math.abs(fc.deltaContribution) > 0.01)
    .sort((a, b) => Math.abs(b.deltaContribution) - Math.abs(a.deltaContribution))
    .map((fc) => ({
      factorKey: fc.factorKey,
      factorLabel: fc.factorLabel,
      deltaContribution: fc.deltaContribution,
      contributionSharePct:
        totalAbsoluteDelta > 0
          ? Number(((Math.abs(fc.deltaContribution) / totalAbsoluteDelta) * 100).toFixed(1))
          : 0,
    }));

  // Natural language summary of drivers
  let driverSummary = 'No significant factor deviations observed under simulated inputs.';
  if (sensitivityDrivers.length > 0) {
    const top1 = sensitivityDrivers[0];
    const top2 = sensitivityDrivers[1];
    const dirText = scoreDelta >= 0 ? 'increased' : 'decreased';
    const absScore = Math.abs(scoreDelta).toFixed(1);

    if (top2) {
      driverSummary = `Priority score ${dirText} by ${absScore} points, primarily driven by ${top1.factorLabel} (${top1.deltaContribution >= 0 ? '+' : ''}${top1.deltaContribution} pts) and ${top2.factorLabel} (${top2.deltaContribution >= 0 ? '+' : ''}${top2.deltaContribution} pts).`;
    } else {
      driverSummary = `Priority score ${dirText} by ${absScore} points, predominantly driven by ${top1.factorLabel} (${top1.deltaContribution >= 0 ? '+' : ''}${top1.deltaContribution} pts).`;
    }
  }

  // Risk tier transitions
  const baselineRiskTier = getRiskTier(baselineAssessment.compositeScore);
  const simulatedRiskTier = getRiskTier(resultingScore);

  // 6. Persist scenario in database
  const scenario = await prisma.whatIfScenario.create({
    data: {
      name: scenarioName,
      description: description ?? null,
      baselinePriorityAssessmentId: baselineAssessment.id,
      parameterOverridesJson: JSON.stringify(overrides),
      resultingScore,
      scoreDelta,
    },
  });

  // 7. Audit log event
  await logAuditEvent({
    eventType: 'SCENARIO_SIMULATED',
    sourceModule: 'WHAT_IF_SIMULATOR',
    modelIdentifier: 'deterministic-simulator-v1',
    inputContent: { hotspotId, overrides },
    outputContent: {
      baselineScore: baselineAssessment.compositeScore,
      resultingScore,
      scoreDelta,
      baselineRiskTier,
      simulatedRiskTier,
      driverSummary,
    },
    validationStatus: 'VALID',
    performedBy: 'POLICY_ANALYST',
    metadata: {
      scenarioId: scenario.id,
      scenarioName,
      hotspotId,
      scoreDelta,
    },
  });

  return {
    scenarioId: scenario.id,
    scenarioName,
    description: description ?? null,
    hotspotId,
    hotspotCode: hotspot.hotspotCode,
    category: hotspot.category,
    administrativeArea: hotspot.administrativeArea.name,
    baselineScore: baselineAssessment.compositeScore,
    baselineRiskTier,
    resultingScore,
    simulatedRiskTier,
    scoreDelta,
    tierTransition: {
      from: baselineRiskTier,
      to: simulatedRiskTier,
      changed: baselineRiskTier !== simulatedRiskTier,
    },
    sensitivityDrivers,
    driverSummary,
    factorComparisons,
    parameterOverrides: overrides,
    simulatedAt: new Date(),
  };
}

/**
 * Retrieves all saved scenarios for a specific hotspot.
 */
export async function getScenariosForHotspot(hotspotId: string) {
  const assessments = await prisma.priorityAssessment.findMany({
    where: { hotspotId },
    select: { id: true },
  });

  const assessmentIds = assessments.map((a) => a.id);

  const scenarios = await prisma.whatIfScenario.findMany({
    where: {
      baselinePriorityAssessmentId: { in: assessmentIds },
    },
    include: {
      baselineAssessment: {
        include: {
          hotspot: {
            include: { administrativeArea: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return scenarios.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    baselineScore: s.baselineAssessment.compositeScore,
    baselineRiskTier: getRiskTier(s.baselineAssessment.compositeScore),
    resultingScore: s.resultingScore,
    simulatedRiskTier: getRiskTier(s.resultingScore),
    scoreDelta: s.scoreDelta,
    parameterOverrides: JSON.parse(s.parameterOverridesJson),
    createdAt: s.createdAt,
    hotspotCode: s.baselineAssessment.hotspot?.hotspotCode,
    administrativeArea: s.baselineAssessment.hotspot?.administrativeArea.name,
  }));
}

/**
 * Retrieves details of a single simulation scenario.
 */
export async function getScenarioDetail(scenarioId: string) {
  const scenario = await prisma.whatIfScenario.findUnique({
    where: { id: scenarioId },
    include: {
      baselineAssessment: {
        include: {
          factorContributions: true,
          hotspot: {
            include: {
              administrativeArea: true,
              issueCluster: true,
            },
          },
        },
      },
    },
  });

  if (!scenario) {
    throw new Error(`Scenario not found: ${scenarioId}`);
  }

  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    baselineScore: scenario.baselineAssessment.compositeScore,
    baselineRiskTier: getRiskTier(scenario.baselineAssessment.compositeScore),
    resultingScore: scenario.resultingScore,
    simulatedRiskTier: getRiskTier(scenario.resultingScore),
    scoreDelta: scenario.scoreDelta,
    parameterOverrides: JSON.parse(scenario.parameterOverridesJson),
    baselineAssessment: scenario.baselineAssessment,
    createdAt: scenario.createdAt,
  };
}

/**
 * Returns standard simulation presets for policy analysis.
 */
export function getSimulationPresets(): SimulationPreset[] {
  return STANDARD_SIMULATION_PRESETS;
}
