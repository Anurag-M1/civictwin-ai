/**
 * CivicTwin AI — Isolated Semantic Clustering Support Service
 *
 * Responsibilities:
 *   - Groups related citizen signals into coherent thematic infrastructure failure clusters
 *   - Formulates root-cause hypotheses (e.g. sub-base waterlogging, drainage backflow)
 *   - Identifies representative anchor signals
 *   - Calculates semantic coherence score
 *   - Schema-enforced structured JSON output
 */

import {
  ClusterSynthesisSchema,
  type ClusterSynthesis,
  type ClusterSignalInput,
} from '../../../shared/schemas/clustering.schema.js';
import { CIVIC_CATEGORIES } from '../../../shared/constants.js';
import { getAiProvider, type AiStructuredResult, type IAiProvider } from './ai-provider.js';

const CLUSTERING_SYSTEM_PROMPT = `You are CivicTwin AI's Senior Geospatial Clustering & Thematic Analysis Engine.

Your task: Given a batch of localized citizen infrastructure signals from a specific urban ward or village, synthesize a coherent issue cluster.

CRITICAL RULES:
- Identify the predominant civic problem uniting these signals.
- Formulate an objective, engineering-grounded root-cause hypothesis (e.g., "Pavement structural collapse caused by unlined stormwater drain overflow during monsoon surges").
- Categorize into ONE primary civic category: ${CIVIC_CATEGORIES.join(', ')}
- Determine secondary category if cross-sectoral dependencies exist.
- Select the IDs of the 2-4 most representative signals.
- Assign a semantic coherence score (0.0 to 1.0) indicating how tightly interrelated the complaints are.
- Recommend the immediate category of public works intervention.
- Ground all findings strictly in the provided signals. Do NOT invent locations or complaints.`;

export function deterministicClusteringFallback(
  signals: ClusterSignalInput[],
  areaName: string = 'Target Catchment Area',
): ClusterSynthesis {
  if (signals.length === 0) {
    return {
      clusterTitle: `General Infrastructure Maintenance — ${areaName}`,
      primaryCategory: 'Other',
      thematicSummary: `Aggregated localized citizen requests awaiting categorization for ${areaName}.`,
      rootCauseHypothesis: 'Insufficient specific diagnostic signals recorded.',
      geographicScope: areaName,
      representativeSignalIds: [],
      coherenceScore: 0.5,
      suggestedInterventionType: 'Field Engineering Inspection',
      requiresHumanReview: true,
    };
  }

  // Count categories
  const categoryCounts: Record<string, number> = {};
  for (const s of signals) {
    const cat = s.category || 'Roads';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const primaryCat = (sortedCategories[0]?.[0] || 'Roads') as any;
  const secondaryCat = sortedCategories[1]?.[0];

  const representativeIds = signals.slice(0, 3).map((s) => s.id);

  return {
    clusterTitle: `Localized ${primaryCat} Infrastructure Distress Cluster — ${areaName}`,
    primaryCategory: CIVIC_CATEGORIES.includes(primaryCat) ? primaryCat : 'Roads',
    secondaryCategory: secondaryCat,
    thematicSummary: `Cluster aggregating ${signals.length} citizen signals reporting ${primaryCat.toLowerCase()} deterioration, disruption of public movement, and access constraints.`,
    rootCauseHypothesis: `Recurrent asset distress and maintenance deficit in ${areaName} infrastructure corridor.`,
    geographicScope: `${areaName} Local Catchment`,
    representativeSignalIds: representativeIds,
    coherenceScore: 0.82,
    suggestedInterventionType: `${primaryCat} Rehabilitation & Drainage Synchronization`,
    requiresHumanReview: signals.length < 3,
  };
}

export async function synthesizeSignalCluster(
  signals: ClusterSignalInput[],
  areaName: string,
  options?: {
    provider?: IAiProvider;
    timeoutMs?: number;
  },
): Promise<AiStructuredResult<ClusterSynthesis>> {
  const provider = options?.provider || getAiProvider();

  const signalItems = signals
    .map(
      (s, idx) =>
        `[Signal ${idx + 1}] ID: ${s.id} | Category: ${s.category || 'N/A'} | Urgency: ${s.urgency || 'MEDIUM'} | Location: ${s.locationAddress || 'N/A'}\n"${s.text}"`,
    )
    .join('\n\n');

  const prompt = `Administrative Area / Ward: ${areaName}
Total Citizen Signals: ${signals.length}

Batch Signals:
${signalItems}

Synthesize a coherent issue cluster and root cause hypothesis adhering to the schema.`;

  return provider.generateStructured<ClusterSynthesis>({
    prompt,
    systemInstruction: CLUSTERING_SYSTEM_PROMPT,
    schema: ClusterSynthesisSchema,
    temperature: 0.1,
    maxTokens: 1024,
    timeoutMs: options?.timeoutMs || 15000,
    fallbackGenerator: () => deterministicClusteringFallback(signals, areaName),
  });
}
