import { z } from 'zod';

export const EvidenceNodeTypeSchema = z.enum([
  'CITIZEN_REQUEST',
  'ISSUE_CLUSTER',
  'INFRASTRUCTURE_ASSET',
  'ADMINISTRATIVE_AREA',
  'DEMOGRAPHIC_INDICATOR',
  'PUBLIC_INVESTMENT',
  'EVIDENCE_RECORD',
  'HOTSPOT',
  'PRIORITY_ASSESSMENT',
  'RECOMMENDATION',
  'EVIDENCE_BRIEF',
]);
export type EvidenceNodeType = z.infer<typeof EvidenceNodeTypeSchema>;

export const EvidenceEdgeTypeSchema = z.enum([
  'SUBMITTED_IN',
  'CLUSTERED_INTO',
  'SPAWNED_HOTSPOT',
  'LOCATED_IN',
  'IMPLICATES_ASSET',
  'INFORMED_BY_DEMOGRAPHICS',
  'GOVERNED_BY_INVESTMENT',
  'PRODUCED_EVIDENCE',
  'CITES_EVIDENCE',
  'EVALUATED_BY',
  'RESULTED_IN',
  'SUPPORTED_BY',
]);
export type EvidenceEdgeType = z.infer<typeof EvidenceEdgeTypeSchema>;

export const EvidenceDatasetTypeSchema = z.enum([
  'OFFICIAL_OPEN_DATA',
  'SYNTHETIC_BENCHMARK',
  'DEMONSTRATION_SEED',
  'DEMO_SEED',
]);
export type EvidenceDatasetType = z.infer<typeof EvidenceDatasetTypeSchema>;

export const EvidenceGraphNodeSchema = z.object({
  id: z.string(),
  type: EvidenceNodeTypeSchema,
  label: z.string(),
  subtitle: z.string().optional(),
  category: z.string().optional(),
  datasetType: EvidenceDatasetTypeSchema,
  isSynthetic: z.boolean(),
  provenanceAgency: z.string(),
  sourceDataset: z.string(),
  sourceUrl: z.string().optional(),
  disclaimer: z.string(),
  properties: z.record(z.any()),
});
export type EvidenceGraphNode = z.infer<typeof EvidenceGraphNodeSchema>;

export const EvidenceGraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: EvidenceEdgeTypeSchema,
  label: z.string(),
  weight: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});
export type EvidenceGraphEdge = z.infer<typeof EvidenceGraphEdgeSchema>;

export const EvidenceGraphMetricsSchema = z.object({
  nodeCount: z.number(),
  edgeCount: z.number(),
  citizenRequestCount: z.number(),
  assetCount: z.number(),
  evidenceCount: z.number(),
  officialPercentage: z.number(),
  syntheticPercentage: z.number(),
  traceabilityCompletenessScore: z.number(),
});
export type EvidenceGraphMetrics = z.infer<typeof EvidenceGraphMetricsSchema>;

export const ProvenanceSummarySchema = z.object({
  officialSources: z.array(z.string()),
  syntheticBenchmarks: z.array(z.string()),
  disclaimer: z.string(),
});
export type ProvenanceSummary = z.infer<typeof ProvenanceSummarySchema>;

export const EvidenceGraphSchema = z.object({
  hotspotId: z.string(),
  hotspotCode: z.string(),
  areaName: z.string(),
  category: z.string(),
  nodes: z.array(EvidenceGraphNodeSchema),
  edges: z.array(EvidenceGraphEdgeSchema),
  metrics: EvidenceGraphMetricsSchema,
  lineagePaths: z.array(z.array(z.string())),
  provenanceSummary: ProvenanceSummarySchema,
});
export type EvidenceGraph = z.infer<typeof EvidenceGraphSchema>;

export const TraceNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  relation: z.string(),
  isSynthetic: z.boolean(),
  datasetType: EvidenceDatasetTypeSchema,
  properties: z.record(z.any()).optional(),
});
export type TraceNode = z.infer<typeof TraceNodeSchema>;

export const EvidenceTraceSchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  entityLabel: z.string(),
  datasetType: EvidenceDatasetTypeSchema,
  isSynthetic: z.boolean(),
  provenanceAgency: z.string(),
  ancestors: z.array(TraceNodeSchema),
  descendants: z.array(TraceNodeSchema),
  verifiableEvidenceIds: z.array(z.string()),
  isFullyTraceable: z.boolean(),
  traceChain: z.array(z.string()),
});
export type EvidenceTrace = z.infer<typeof EvidenceTraceSchema>;

export const ResolvedEvidenceItemSchema = z.object({
  evidenceCode: z.string(),
  found: z.boolean(),
  sourceEntity: z.string().optional(),
  entityId: z.string().optional(),
  metric: z.string().optional(),
  value: z.string().optional(),
  period: z.string().optional(),
  confidence: z.number().optional(),
  isSynthetic: z.boolean(),
  datasetType: EvidenceDatasetTypeSchema,
  provenanceAgency: z.string().optional(),
  underlyingRecord: z.record(z.any()).nullable(),
  error: z.string().optional(),
});
export type ResolvedEvidenceItem = z.infer<typeof ResolvedEvidenceItemSchema>;

export const EvidenceVerificationReportSchema = z.object({
  targetType: z.string(),
  targetId: z.string(),
  targetCode: z.string().optional(),
  citedEvidenceIds: z.array(z.string()),
  resolvedItems: z.array(ResolvedEvidenceItemSchema),
  valid: z.boolean(),
  orphanedOrFabricatedCount: z.number(),
  provenanceSummary: ProvenanceSummarySchema,
  verificationTimestamp: z.string(),
});
export type EvidenceVerificationReport = z.infer<typeof EvidenceVerificationReportSchema>;
