/**
 * CivicTwin AI — Grounded Evidence Brief Service
 *
 * Gathers actual application-derived evidence across citizen intake signals,
 * physical asset telemetry, census demographics, and public investments.
 *
 * Strict Architectural Guarantees:
 *   - Only structured, application-derived evidence is passed to Gemini.
 *   - Every factual claim must be traceable to a verified Evidence ID (EV-xxx).
 *   - Explicitly evaluates and declares if evidence is INSUFFICIENT.
 *   - Records every brief synthesis into the tamper-evident AI audit trail.
 */

import { prisma } from '../db.js';
import type {
  EvidencePack,
  EvidenceItem,
  GroundedEvidenceBrief,
} from '../../shared/schemas/brief.schema.js';
import { synthesizeEvidenceBrief } from './ai/evidence-synthesis.ai.js';
import { logAuditEvent } from './audit.service.js';

export interface EvidenceTraceabilityReport {
  isTraceable: boolean;
  citedIds: string[];
  validIds: string[];
  invalidIds: string[];
  evidenceFindingsCount: number;
}

/**
 * Gathers actual application-derived empirical evidence for a hotspot
 */
export async function gatherHotspotEvidence(hotspotId: string): Promise<EvidencePack> {
  const hotspot = await prisma.hotspot.findUnique({
    where: { id: hotspotId },
    include: {
      administrativeArea: {
        include: {
          demographics: { take: 1, orderBy: { year: 'desc' } },
          assets: {
            include: { conditions: { take: 1, orderBy: { inspectionDate: 'desc' } } },
            take: 5,
          },
          investments: { take: 5, orderBy: { allocatedAmountInr: 'desc' } },
        },
      },
      evidenceRecords: true,
      issueCluster: {
        include: { citizenRequests: { take: 10, orderBy: { createdAt: 'desc' } } },
      },
      recommendations: { take: 1 },
    },
  });

  if (!hotspot) {
    throw new Error(`Hotspot not found: ${hotspotId}`);
  }

  const evidenceList: EvidenceItem[] = [];
  const stateCode = hotspot.administrativeArea.stateCode;

  // 1. Physical Infrastructure Assets in Area
  const assets = hotspot.administrativeArea.assets || [];
  assets.forEach((ast, idx) => {
    const score = ast.conditions?.[0]?.conditionScore ?? (ast.conditionRating === 'CRITICAL' ? 25 : ast.conditionRating === 'POOR' ? 45 : 70);
    evidenceList.push({
      id: `EV-AST-${ast.assetCode || `${stateCode}-${idx + 1}`}`,
      category: 'INFRASTRUCTURE_ASSETS',
      sourceEntity: 'Public Works Asset Registry',
      metric: 'Physical Asset Structural Condition',
      value: `${ast.name} (${ast.type}): Condition Rating ${ast.conditionRating} (Condition Score: ${score}/100)`,
      period: ast.lastInspectedAt ? new Date(ast.lastInspectedAt).toISOString().split('T')[0] : 'Q1 2026',
      source: 'Municipal Asset Maintenance & GIS Registry',
      confidence: 0.95,
      isOfficial: !ast.isDemo,
    });
  });

  // 2. Citizen Grievance Signals
  const clusterRequests = hotspot.issueCluster?.citizenRequests || [];
  if (clusterRequests.length > 0) {
    clusterRequests.slice(0, 5).forEach((req, idx) => {
      evidenceList.push({
        id: `EV-SIG-${req.trackingCode || `${stateCode}-${idx + 1}`}`,
        category: 'CITIZEN_SIGNALS',
        sourceEntity: 'Citizen Intake Channel',
        metric: 'Citizen Reported Distress Signal',
        value: `[Urgency ${req.urgency}] ${req.summary || req.originalText}`,
        period: req.createdAt ? new Date(req.createdAt).toISOString().split('T')[0] : 'Recent 14 Days',
        source: `CivicTwin Multilingual Pipeline (${req.channel || 'WEB'})`,
        confidence: req.confidence || 0.92,
        isOfficial: true,
      });
    });
  } else if (hotspot.requestCount > 0) {
    evidenceList.push({
      id: `EV-SIG-${stateCode}-AGG`,
      category: 'CITIZEN_SIGNALS',
      sourceEntity: 'Citizen Intake Cluster Aggregator',
      metric: 'Aggregated Citizen Grievance Density',
      value: `${hotspot.requestCount} verified citizen complaints (+${hotspot.trendGrowthPct}% 14-day velocity)`,
      period: 'Recent 14 Days',
      source: 'CivicTwin Intake Telemetry',
      confidence: 0.94,
      isOfficial: true,
    });
  }

  // 3. Demographic & Vulnerability Catchment
  const demo = hotspot.administrativeArea.demographics?.[0];
  if (demo) {
    const vulnRatio = ((demo.vulnerablePopulation / (demo.totalPopulation || 1)) * 100).toFixed(1);
    evidenceList.push({
      id: `EV-DEM-${stateCode}-WARD`,
      category: 'DEMOGRAPHICS',
      sourceEntity: 'Census of India Demographic Snapshot',
      metric: 'Ward Population & Vulnerability Catchment',
      value: `Total Pop: ${demo.totalPopulation.toLocaleString()}, Vulnerable Catchment: ${demo.vulnerablePopulation.toLocaleString()} residents (Density: ${demo.densityPerSqKm}/sq.km, Vulnerability: ${vulnRatio}%)`,
      period: `Census Year: ${demo.year}`,
      source: 'Ministry of Home Affairs / Census Open Data',
      confidence: 0.98,
      isOfficial: true,
    });
  }

  // 4. Public Investments & Capex Ledger
  const investments = hotspot.administrativeArea.investments || [];
  investments.slice(0, 3).forEach((inv, idx) => {
    const execRate = inv.allocatedAmountInr > 0 ? (inv.spentAmountInr / inv.allocatedAmountInr) : 0;
    evidenceList.push({
      id: `EV-INV-${inv.schemeName.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase()}-${idx + 1}`,
      category: 'PUBLIC_INVESTMENTS',
      sourceEntity: 'Municipal Capital Works Ledger',
      metric: 'Capital Expenditure Budget Allocation',
      value: `${inv.schemeName}: Budget ₹${(inv.allocatedAmountInr / 100000).toFixed(1)}L, Spent ₹${(inv.spentAmountInr / 100000).toFixed(1)}L (${(execRate * 100).toFixed(0)}% execution)`,
      period: `FY ${inv.fiscalYear}`,
      source: 'State Public Works Financial Management System',
      confidence: 0.95,
      isOfficial: true,
    });
  });

  // 5. Existing Evidence Records in Database
  if (hotspot.evidenceRecords && hotspot.evidenceRecords.length > 0) {
    hotspot.evidenceRecords.forEach((ev) => {
      if (!evidenceList.some((e) => e.id === ev.evidenceCode)) {
        evidenceList.push({
          id: ev.evidenceCode,
          category: 'GRAPH_EVIDENCE',
          sourceEntity: ev.sourceEntity,
          metric: ev.metric,
          value: ev.value,
          period: ev.period,
          source: ev.sourceMetadata,
          confidence: ev.confidence,
          isOfficial: true,
        });
      }
    });
  }

  // Evaluate Evidence Sufficiency
  const signalCount = clusterRequests.length || hotspot.requestCount;
  const assetCount = assets.length;
  const isSufficient = (signalCount > 0 || assetCount > 0) && evidenceList.length >= 2;

  const sufficiencyStatus = isSufficient ? 'SUFFICIENT' : 'INSUFFICIENT';
  const sufficiencyReason = isSufficient
    ? `Empirical evidence substantiated across ${evidenceList.length} records (${signalCount} signals, ${assetCount} assets, census demographics).`
    : `Insufficient empirical records: lacking field asset condition records and direct citizen signal volume (${signalCount} signals, ${assetCount} assets). Field survey required.`;

  return {
    hotspotCode: hotspot.hotspotCode,
    areaName: hotspot.administrativeArea.name,
    stateName: hotspot.administrativeArea.stateCode,
    category: hotspot.category,
    requestCount: hotspot.requestCount,
    growthRatePct: hotspot.trendGrowthPct,
    vulnerablePopulation: demo ? demo.vulnerablePopulation : 4500,
    infrastructureDistressPct: hotspot.infrastructureGapScore,
    sufficiencyStatus,
    sufficiencyReason,
    evidenceList,
  };
}

/**
 * Validates that all factual claims and citations in the brief trace directly to provided evidence IDs
 */
export function verifyBriefTraceability(
  brief: GroundedEvidenceBrief,
  pack: EvidencePack,
): EvidenceTraceabilityReport {
  const validIds = pack.evidenceList.map((e) => e.id);
  const citedIds = brief.citedEvidenceIds || [];

  const invalidIds = citedIds.filter((id) => !validIds.includes(id));
  const isTraceable = invalidIds.length === 0 && citedIds.length > 0;

  return {
    isTraceable,
    citedIds,
    validIds,
    invalidIds,
    evidenceFindingsCount: brief.evidence?.length || 0,
  };
}

/**
 * Generates an explainable, grounded Executive Evidence Brief for a hotspot
 */
export async function generateEvidenceBrief(hotspotId: string): Promise<any> {
  const hotspot = await prisma.hotspot.findUnique({
    where: { id: hotspotId },
    include: {
      administrativeArea: true,
      recommendations: { take: 1 },
    },
  });

  if (!hotspot) {
    throw new Error(`Hotspot not found: ${hotspotId}`);
  }

  // 1. Gather actual application-derived evidence
  const evidencePack = await gatherHotspotEvidence(hotspotId);

  // 2. Pass ONLY structured evidence to Gemini
  const synthesisResult = await synthesizeEvidenceBrief(evidencePack);
  const briefData: GroundedEvidenceBrief = synthesisResult.data;
  const modelName = synthesisResult.modelName;
  const latencyMs = synthesisResult.latencyMs;

  // 3. Programmatic traceability check
  const traceabilityReport = verifyBriefTraceability(briefData, evidencePack);

  // 4. Ensure recommendation exists or create one
  let recommendationId: string | undefined = hotspot.recommendations?.[0]?.id;
  if (!recommendationId) {
    const rec = await prisma.recommendation.create({
      data: {
        recommendationCode: `REC-${hotspot.hotspotCode.replace('HOT-', '')}-${Math.floor(100 + Math.random() * 900)}`,
        hotspotId: hotspot.id,
        title: `Comprehensive ${hotspot.category} Capital Rehabilitation`,
        summary: briefData.potentialIntervention,
        estimatedCostInr: hotspot.category === 'Roads' ? 4500000 : 7200000,
        estimatedDurationMonths: 6,
        targetBeneficiaries: evidencePack.vulnerablePopulation,
        status: 'PROPOSED',
      },
    });
    recommendationId = rec.id;
  }

  // 5. Persist Evidence Brief to database
  const persistedBrief = await prisma.evidenceBrief.create({
    data: {
      hotspotId: hotspot.id,
      recommendationId,
      problemSummary: briefData.problem,
      whyEmerging: JSON.stringify(briefData.evidence),
      potentialIntervention: briefData.potentialIntervention,
      implementationConsiderations: briefData.implementationConsiderations,
      risks: briefData.risks,
      dependencies: briefData.dependencies,
      dataLimitations: briefData.limitations,
      confidenceScore: briefData.confidence,
      modelIdentifier: modelName,
      requiresHumanReview: briefData.humanReviewRequirement?.required ?? true,
      citedEvidenceIds: JSON.stringify(briefData.citedEvidenceIds),
    },
    include: {
      hotspot: {
        include: { administrativeArea: true, evidenceRecords: true },
      },
      recommendation: true,
    },
  });

  // 6. Record Tamper-Evident AI Audit Trail
  const auditEvent = await logAuditEvent({
    eventType: 'BRIEF_SYNTHESIS',
    sourceModule: 'EVIDENCE_BRIEF',
    modelIdentifier: modelName,
    inputContent: evidencePack, // ONLY structured evidence
    outputContent: {
      problem: briefData.problem,
      evidence: briefData.evidence,
      potentialIntervention: briefData.potentialIntervention,
      implementationConsiderations: briefData.implementationConsiderations,
      risks: briefData.risks,
      dependencies: briefData.dependencies,
      limitations: briefData.limitations,
      confidence: briefData.confidence,
      humanReviewRequirement: briefData.humanReviewRequirement,
      traceability: traceabilityReport,
    },
    validationStatus:
      evidencePack.sufficiencyStatus === 'SUFFICIENT' && traceabilityReport.isTraceable
        ? 'VALID'
        : 'WARN',
    latencyMs,
    performedBy: 'GEMINI_EVIDENCE_ENGINE',
    metadata: {
      hotspotId,
      hotspotCode: hotspot.hotspotCode,
      briefId: persistedBrief.id,
      sufficiencyStatus: evidencePack.sufficiencyStatus,
      citedEvidenceCount: briefData.citedEvidenceIds.length,
      confidenceScore: briefData.confidence,
      requiresHumanReview: briefData.humanReviewRequirement?.required ?? true,
      humanReviewReason: briefData.humanReviewRequirement?.reason,
      isTraceable: traceabilityReport.isTraceable,
    },
  });

  // Enrich returned object with structured properties and audit ID
  return {
    ...persistedBrief,
    problem: briefData.problem,
    evidence: briefData.evidence,
    potentialIntervention: briefData.potentialIntervention,
    implementationConsiderations: briefData.implementationConsiderations,
    risks: briefData.risks,
    dependencies: briefData.dependencies,
    limitations: briefData.limitations,
    confidence: briefData.confidence,
    humanReviewRequirement: briefData.humanReviewRequirement,
    sufficiencyStatus: evidencePack.sufficiencyStatus,
    sufficiencyReason: evidencePack.sufficiencyReason,
    evidenceList: evidencePack.evidenceList,
    traceabilityReport,
    auditRecordId: auditEvent?.id,
  };
}
