/**
 * CivicTwin AI — Infrastructure Risk Radar & Spatial Analytics Service
 *
 * Deterministic geographic aggregation, semantic issue clustering,
 * trend growth velocity, infrastructure deficit scoring, and evidence-grounded
 * hotspot detection engine.
 *
 * Core Guarantees:
 *   1. Deterministic spatial aggregation using Haversine geodesic clustering.
 *   2. Semantic issue clustering combining proximity, category, and urgency signals.
 *   3. Trend velocity and infrastructure distress cross-referencing.
 *   4. Catchment affected-population modeling anchored in Census demographics.
 *   5. Complete explainability: every hotspot is traceable to verifiable evidence units (EV-xxx).
 *   6. Graceful handling of empty states, unclustered areas, and filter boundaries.
 */

import { prisma } from '../db.js';
import { logAuditEvent } from './audit.service.js';
import { calculateHotspotPriority } from './priority.service.js';
import { ensureHotspotEvidenceRecords } from './evidence-graph.service.js';

// Haversine distance in kilometers
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(3));
}

export interface ClusterCandidate {
  category: string;
  administrativeAreaId: string;
  requests: any[];
  centerLat: number;
  centerLng: number;
}

export interface HotspotFilterOptions {
  category?: string;
  stateCode?: string;
  status?: string;
  minScore?: number;
  maxScore?: number;
  urgency?: string;
  search?: string;
  sortBy?: 'prioritySignalScore' | 'trendGrowthPct' | 'requestCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface HotspotExplanation {
  hotspotId: string;
  hotspotCode: string;
  category: string;
  status: string;
  prioritySignalScore: number;
  confidenceScore: number;
  executiveSummary: string;
  metrics: {
    requestCount: number;
    trendGrowthPct: number;
    affectedPopulationSignal: number;
    infrastructureGapScore: number;
    serviceCriticalityScore: number;
    vulnerabilityScore: number;
    investmentGapScore: number;
  };
  factorContributions: Array<{
    factorKey: string;
    factorLabel: string;
    normalizedValue: number;
    weight: number;
    contributionPct: number;
  }>;
  groundedEvidenceRecords: Array<{
    evidenceCode: string;
    sourceEntity: string;
    metric: string;
    value: string;
    period: string;
    confidence: number;
  }>;
  connectedSignalsSummary: {
    totalSignals: number;
    urgencyBreakdown: Record<string, number>;
    channels: string[];
    sampleSignals: Array<{
      trackingCode: string;
      originalText: string;
      language: string;
      urgency: string;
      channel: string;
      createdAt: string;
    }>;
  };
  connectedAssets: Array<{
    assetCode: string;
    name: string;
    type: string;
    conditionRating: string;
    capacity: string | null;
    lastInspectedAt: string | null;
    distressNotes: string | null;
  }>;
  demographicsContext: {
    totalPopulation: number;
    vulnerablePopulation: number;
    vulnerabilityPercentage: number;
    densityPerSqKm: number;
    year: number;
  } | null;
  publicInvestmentContext: Array<{
    schemeName: string;
    allocatedAmountInr: number;
    spentAmountInr: number;
    unspentPercentage: number;
    fiscalYear: string;
    status: string;
  }>;
}

/**
 * Calculates trend growth velocity percentage across two consecutive time windows.
 */
export function calculateTrendVelocity(requests: Array<{ createdAt: Date | string }>): number {
  if (requests.length === 0) return 0.0;
  if (requests.length === 1) return 10.0;

  const now = new Date().getTime();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const twentyEightDaysMs = 28 * 24 * 60 * 60 * 1000;

  let currentWindowCount = 0;
  let priorWindowCount = 0;

  for (const r of requests) {
    const time = new Date(r.createdAt).getTime();
    const ageMs = now - time;
    if (ageMs <= fourteenDaysMs) {
      currentWindowCount++;
    } else if (ageMs <= twentyEightDaysMs) {
      priorWindowCount++;
    }
  }

  if (priorWindowCount === 0) {
    // If all signals are recent, calculate velocity based on density
    return Number(Math.min(100.0, currentWindowCount * 12.5).toFixed(1));
  }

  const growthPct = ((currentWindowCount - priorWindowCount) / priorWindowCount) * 100;
  return Number(Math.max(-50.0, Math.min(250.0, growthPct)).toFixed(1));
}

/**
 * Deterministic spatial clustering and emerging hotspot detection.
 */
export async function detectHotspotsFromSignals(clusteringRadiusKm: number = 3.0) {
  // 1. Fetch active citizen requests with locations
  const requests = await prisma.citizenRequest.findMany({
    where: {
      locationId: { not: null },
      status: { in: ['NORMALIZED', 'INGESTED', 'CLUSTERED', 'FLAGGED'] },
    },
    include: {
      location: {
        include: { administrativeArea: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (requests.length === 0) {
    return {
      detectedCount: 0,
      clustersCount: 0,
      hotspots: [],
      emptyState: true,
      message: 'No active geocoded citizen requests available for spatial clustering.',
    };
  }

  // 2. Spatial Aggregation: Group by category and proximity within administrative areas
  const clusters: ClusterCandidate[] = [];

  for (const req of requests) {
    if (!req.location) continue;
    const lat = req.location.latitude;
    const lng = req.location.longitude;
    const cat = req.category;
    const areaId = req.location.administrativeAreaId;

    let found = false;
    for (const cluster of clusters) {
      if (cluster.category === cat && cluster.administrativeAreaId === areaId) {
        const dist = haversineDistanceKm(lat, lng, cluster.centerLat, cluster.centerLng);
        if (dist <= clusteringRadiusKm) {
          cluster.requests.push(req);
          // Recalculate centroid weighted by request count
          const total = cluster.requests.length;
          cluster.centerLat = Number(((cluster.centerLat * (total - 1) + lat) / total).toFixed(6));
          cluster.centerLng = Number(((cluster.centerLng * (total - 1) + lng) / total).toFixed(6));
          found = true;
          break;
        }
      }
    }

    if (!found) {
      clusters.push({
        category: cat,
        administrativeAreaId: areaId,
        requests: [req],
        centerLat: lat,
        centerLng: lng,
      });
    }
  }

  const generatedHotspots = [];

  // 3. For each candidate cluster, synthesize issue cluster, metrics, and hotspot
  for (const cl of clusters) {
    const area = await prisma.administrativeArea.findUnique({
      where: { id: cl.administrativeAreaId },
      include: {
        demographics: { orderBy: { year: 'desc' }, take: 1 },
        investments: { take: 2 },
      },
    });
    if (!area) continue;

    // Check if an existing hotspot matches this area and category
    let hotspot: any = await prisma.hotspot.findFirst({
      where: {
        administrativeAreaId: cl.administrativeAreaId,
        category: cl.category,
      },
      include: { issueCluster: true },
    });

    // Check nearby infrastructure assets for distress scoring
    const nearbyAssets = await prisma.infrastructureAsset.findMany({
      where: {
        administrativeAreaId: cl.administrativeAreaId,
        type:
          cl.category === 'Water'
            ? 'WaterNetwork'
            : cl.category === 'Roads'
            ? 'Road'
            : cl.category === 'Healthcare'
            ? 'HealthCentre'
            : cl.category === 'Education'
            ? 'School'
            : cl.category === 'Electricity'
            ? 'Transformer'
            : cl.category === 'Waste Management'
            ? 'WasteFacility'
            : undefined,
      },
      include: {
        conditions: { orderBy: { inspectionDate: 'desc' }, take: 1 },
      },
    });

    let infraGapScore = 55.0;
    if (nearbyAssets.length > 0) {
      const conditionWeights: Record<string, number> = {
        CRITICAL: 95.0,
        POOR: 80.0,
        FAIR: 55.0,
        GOOD: 25.0,
        EXCELLENT: 10.0,
      };
      const totalScore = nearbyAssets.reduce((sum, a) => {
        const latest = a.conditions?.[0];
        if (latest) {
          return sum + (100.0 - latest.conditionScore);
        }
        return sum + (conditionWeights[a.conditionRating] ?? 50.0);
      }, 0);
      infraGapScore = Number((totalScore / nearbyAssets.length).toFixed(1));
    } else {
      // If critical service lacks physical assets entirely, mark severe infrastructure deficit
      if (['Water', 'Roads', 'Healthcare', 'Sanitation'].includes(cl.category)) {
        infraGapScore = 78.0;
      }
    }

    // Service criticality baseline
    const criticalityMap: Record<string, number> = {
      Healthcare: 95,
      Water: 92,
      Electricity: 85,
      Roads: 82,
      Sanitation: 78,
      'Disaster Resilience': 94,
      'Waste Management': 68,
      'Public Transport': 72,
      Education: 70,
    };
    const serviceCrit = criticalityMap[cl.category] ?? 60.0;

    // Demographic vulnerability & affected population estimation
    const demo = area.demographics?.[0];
    const vulnScore =
      demo && demo.totalPopulation > 0
        ? Number(((demo.vulnerablePopulation / demo.totalPopulation) * 100).toFixed(1))
        : 55.0;

    const estimatedCatchment = demo
      ? Math.min(
          demo.totalPopulation,
          Math.max(1200, Math.round(demo.densityPerSqKm * Math.PI * Math.pow(Math.min(clusteringRadiusKm, 2.5), 2))),
        )
      : 8500;

    // Public investment gap
    let capexGapScore = 65.0;
    const inv = area.investments?.[0];
    if (inv && inv.allocatedAmountInr > 0) {
      const unspent = inv.allocatedAmountInr - inv.spentAmountInr;
      capexGapScore = Number(Math.min(95.0, Math.max(30.0, (unspent / inv.allocatedAmountInr) * 100)).toFixed(1));
    }

    // Trend growth velocity
    const trendGrowthPct = calculateTrendVelocity(cl.requests);

    // Calculate initial urgency average
    const urgencyWeightMap: Record<string, number> = {
      CRITICAL: 100,
      HIGH: 80,
      MEDIUM: 50,
      LOW: 25,
    };
    const avgUrgency =
      cl.requests.reduce((sum, r) => sum + (urgencyWeightMap[r.urgency] ?? 50), 0) / cl.requests.length;

    // Status state machine
    let hotspotStatus = 'EMERGING';
    if (avgUrgency >= 85 || infraGapScore >= 80 || cl.requests.length >= 10) {
      hotspotStatus = 'ELEVATED';
    }

    // Multichannel confidence score
    const channels = new Set(cl.requests.map((r) => r.channel));
    const confidenceScore = Number(
      Math.min(0.98, Math.max(0.75, 0.70 + cl.requests.length * 0.02 + channels.size * 0.05)).toFixed(2),
    );

    if (!hotspot) {
      const hotspotCode = `HOT-${area.stateCode}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Create or link Issue Cluster
      const issueCluster = await prisma.issueCluster.create({
        data: {
          clusterCode: `CLS-${area.stateCode}-${cl.category.slice(0, 3).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
          administrativeAreaId: cl.administrativeAreaId,
          category: cl.category,
          title: `${cl.category} Service Strain in ${area.name} (${cl.requests.length} Citizen Reports)`,
          description: `Localized citizen distress signals reporting infrastructure failures and access deficits in ${area.name}.`,
          requestCount: cl.requests.length,
          averageUrgency: Number(avgUrgency.toFixed(1)),
          status: 'ACTIVE',
        },
      });

      // Link requests to issue cluster
      for (const req of cl.requests) {
        await prisma.citizenRequest.update({
          where: { id: req.id },
          data: {
            issueClusterId: issueCluster.id,
            status: 'CLUSTERED',
          },
        });
      }

      hotspot = await prisma.hotspot.create({
        data: {
          hotspotCode,
          administrativeAreaId: cl.administrativeAreaId,
          issueClusterId: issueCluster.id,
          category: cl.category,
          requestCount: cl.requests.length,
          trendGrowthPct,
          affectedPopulationSignal: estimatedCatchment,
          infrastructureGapScore: infraGapScore,
          serviceCriticalityScore: serviceCrit,
          vulnerabilityScore: vulnScore,
          investmentGapScore: capexGapScore,
          prioritySignalScore: 70.0, // Initial estimate, recalculate immediately below
          confidenceScore,
          centerLat: cl.centerLat,
          centerLng: cl.centerLng,
          status: hotspotStatus,
        },
      });
    } else {
      // Update existing hotspot
      hotspot = await prisma.hotspot.update({
        where: { id: hotspot.id },
        data: {
          requestCount: Math.max(hotspot.requestCount, cl.requests.length),
          trendGrowthPct,
          infrastructureGapScore: infraGapScore,
          vulnerabilityScore: vulnScore,
          affectedPopulationSignal: Math.max(hotspot.affectedPopulationSignal, estimatedCatchment),
          confidenceScore,
          status: hotspot.status === 'MITIGATING' || hotspot.status === 'RESOLVED' ? hotspot.status : hotspotStatus,
        },
      });

      // Update cluster request count
      if (hotspot.issueClusterId) {
        await prisma.issueCluster.update({
          where: { id: hotspot.issueClusterId },
          data: {
            requestCount: cl.requests.length,
            averageUrgency: Number(avgUrgency.toFixed(1)),
          },
        });

        for (const req of cl.requests) {
          if (!req.issueClusterId) {
            await prisma.citizenRequest.update({
              where: { id: req.id },
              data: {
                issueClusterId: hotspot.issueClusterId,
                status: 'CLUSTERED',
              },
            });
          }
        }
      }
    }

    if (hotspot) {
      // Recalculate priority assessment with multi-factor engine
      await calculateHotspotPriority(hotspot.id);

      // Guarantee that every detected/updated hotspot has verifiable evidence records
      await ensureHotspotEvidenceRecords(hotspot.id);

      // Refresh updated hotspot
      const fullHotspot = await prisma.hotspot.findUnique({
        where: { id: hotspot.id },
        include: {
          administrativeArea: true,
          issueCluster: { include: { citizenRequests: { take: 5 } } },
          evidenceRecords: true,
          priorityAssessments: { orderBy: { calculatedAt: 'desc' }, take: 1, include: { factorContributions: true } },
        },
      });

      if (fullHotspot) generatedHotspots.push(fullHotspot);
    }
  }

  await logAuditEvent({
    eventType: 'HOTSPOT_DETECTED',
    sourceModule: 'RADAR',
    modelIdentifier: 'spatial-clustering-v2',
    outputContent: { count: generatedHotspots.length },
    validationStatus: 'VALID',
    performedBy: 'ANALYTICS_SERVICE',
    metadata: {
      clustersIdentified: clusters.length,
      hotspotsUpdated: generatedHotspots.length,
      clusteringRadiusKm,
    },
  });

  return {
    detectedCount: generatedHotspots.length,
    clustersCount: clusters.length,
    hotspots: generatedHotspots,
    emptyState: false,
  };
}

/**
 * Filter and query hotspots with multi-dimensional criteria.
 */
export async function getFilteredHotspots(options: HotspotFilterOptions = {}) {
  const {
    category,
    stateCode,
    status,
    minScore,
    maxScore,
    urgency,
    search,
    sortBy = 'prioritySignalScore',
    sortOrder = 'desc',
    limit = 50,
    offset = 0,
  } = options;

  const where: any = {};

  if (category) where.category = category;
  if (status) where.status = status;
  if (stateCode) {
    where.administrativeArea = { stateCode };
  }

  if (minScore !== undefined || maxScore !== undefined) {
    where.prioritySignalScore = {};
    if (minScore !== undefined) where.prioritySignalScore.gte = Number(minScore);
    if (maxScore !== undefined) where.prioritySignalScore.lte = Number(maxScore);
  }

  if (search) {
    where.OR = [
      { hotspotCode: { contains: search } },
      { category: { contains: search } },
      { administrativeArea: { name: { contains: search } } },
      { issueCluster: { title: { contains: search } } },
    ];
  }

  if (urgency) {
    where.issueCluster = {
      citizenRequests: {
        some: { urgency },
      },
    };
  }

  const orderBy: any = {};
  orderBy[sortBy] = sortOrder;

  const [hotspots, totalCount, allMatching] = await Promise.all([
    prisma.hotspot.findMany({
      where,
      include: {
        administrativeArea: {
          include: {
            demographics: { take: 1, orderBy: { year: 'desc' } },
            investments: { take: 2 },
          },
        },
        issueCluster: {
          include: {
            citizenRequests: { take: 5, orderBy: { createdAt: 'desc' } },
          },
        },
        evidenceRecords: true,
        recommendations: true,
        priorityAssessments: {
          orderBy: { calculatedAt: 'desc' },
          take: 1,
          include: { factorContributions: true },
        },
      },
      orderBy,
      take: Number(limit),
      skip: Number(offset),
    }),
    prisma.hotspot.count({ where }),
    prisma.hotspot.findMany({
      where,
      select: {
        category: true,
        status: true,
        prioritySignalScore: true,
        affectedPopulationSignal: true,
        trendGrowthPct: true,
      },
    }),
  ]);

  const statusDistribution: Record<string, number> = {
    EMERGING: 0,
    ELEVATED: 0,
    MITIGATING: 0,
    RESOLVED: 0,
  };
  const categoryDistribution: Record<string, number> = {};
  let totalAffectedPop = 0;
  let totalScore = 0;
  let highRiskCount = 0;

  for (const h of allMatching) {
    statusDistribution[h.status] = (statusDistribution[h.status] || 0) + 1;
    categoryDistribution[h.category] = (categoryDistribution[h.category] || 0) + 1;
    totalAffectedPop += h.affectedPopulationSignal || 0;
    totalScore += h.prioritySignalScore || 0;
    if (h.prioritySignalScore >= 75) highRiskCount++;
  }

  const summary = {
    totalHotspots: totalCount,
    elevatedCount: statusDistribution.ELEVATED || 0,
    emergingCount: statusDistribution.EMERGING || 0,
    mitigatingCount: statusDistribution.MITIGATING || 0,
    resolvedCount: statusDistribution.RESOLVED || 0,
    highRiskCount,
    totalAffectedPopulation: totalAffectedPop,
    averagePriorityScore: totalCount > 0 ? Number((totalScore / totalCount).toFixed(1)) : 0,
    statusDistribution,
    categoryDistribution,
  };

  return {
    hotspots,
    count: totalCount,
    summary,
    emptyState: totalCount === 0,
  };
}

/**
 * Generates an evidence-grounded explainability dossier for a single hotspot.
 */
export async function generateHotspotExplanation(hotspotId: string): Promise<HotspotExplanation> {
  const hotspot = await prisma.hotspot.findUnique({
    where: { id: hotspotId },
    include: {
      administrativeArea: {
        include: {
          demographics: { orderBy: { year: 'desc' }, take: 1 },
          investments: true,
        },
      },
      issueCluster: {
        include: {
          citizenRequests: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      },
      evidenceRecords: true,
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

  // Find physical assets in same ward
  const assets = await prisma.infrastructureAsset.findMany({
    where: { administrativeAreaId: hotspot.administrativeAreaId },
    include: { conditions: { orderBy: { inspectionDate: 'desc' }, take: 1 } },
  });

  const demo = hotspot.administrativeArea.demographics?.[0];
  const pa = hotspot.priorityAssessments?.[0];
  const requests = hotspot.issueCluster?.citizenRequests || [];

  const urgencyCounts: Record<string, number> = {};
  const channels = new Set<string>();
  for (const r of requests) {
    urgencyCounts[r.urgency] = (urgencyCounts[r.urgency] || 0) + 1;
    channels.add(r.channel);
  }

  // Generate explainability narrative
  const primaryEvidence = hotspot.evidenceRecords.map((e) => `[${e.evidenceCode}: ${e.metric} (${e.value})]`).join(', ');
  const executiveSummary =
    `Hotspot ${hotspot.hotspotCode} is flagged as ${hotspot.status} in ${hotspot.administrativeArea.name} with a Priority Score of ${hotspot.prioritySignalScore.toFixed(1)}/100. ` +
    `Detection is driven by ${hotspot.requestCount} citizen distress signals (${hotspot.trendGrowthPct > 0 ? '+' + hotspot.trendGrowthPct + '% escalation' : 'steady trajectory'}), ` +
    `an infrastructure gap score of ${hotspot.infrastructureGapScore.toFixed(1)}/100, and ${hotspot.affectedPopulationSignal.toLocaleString()} estimated residents in the service catchment. ` +
    (primaryEvidence ? `Grounded evidence records cited: ${primaryEvidence}.` : '');

  return {
    hotspotId: hotspot.id,
    hotspotCode: hotspot.hotspotCode,
    category: hotspot.category,
    status: hotspot.status,
    prioritySignalScore: hotspot.prioritySignalScore,
    confidenceScore: hotspot.confidenceScore,
    executiveSummary,
    metrics: {
      requestCount: hotspot.requestCount,
      trendGrowthPct: hotspot.trendGrowthPct,
      affectedPopulationSignal: hotspot.affectedPopulationSignal,
      infrastructureGapScore: hotspot.infrastructureGapScore,
      serviceCriticalityScore: hotspot.serviceCriticalityScore,
      vulnerabilityScore: hotspot.vulnerabilityScore,
      investmentGapScore: hotspot.investmentGapScore,
    },
    factorContributions: pa?.factorContributions?.map((fc) => ({
      factorKey: fc.factorKey,
      factorLabel: fc.factorLabel,
      normalizedValue: fc.normalizedValue,
      weight: fc.weight,
      contributionPct: fc.contributionPct,
    })) || [],
    groundedEvidenceRecords: hotspot.evidenceRecords.map((e) => ({
      evidenceCode: e.evidenceCode,
      sourceEntity: e.sourceEntity,
      metric: e.metric,
      value: e.value,
      period: e.period,
      confidence: e.confidence,
    })),
    connectedSignalsSummary: {
      totalSignals: requests.length,
      urgencyBreakdown: urgencyCounts,
      channels: Array.from(channels),
      sampleSignals: requests.slice(0, 5).map((r) => ({
        trackingCode: r.trackingCode,
        originalText: r.originalText,
        language: r.language,
        urgency: r.urgency,
        channel: r.channel,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    connectedAssets: assets.map((a) => ({
      assetCode: a.assetCode,
      name: a.name,
      type: a.type,
      conditionRating: a.conditionRating,
      capacity: a.capacity,
      lastInspectedAt: a.lastInspectedAt ? a.lastInspectedAt.toISOString() : null,
      distressNotes: a.conditions?.[0]?.notes || null,
    })),
    demographicsContext: demo
      ? {
          totalPopulation: demo.totalPopulation,
          vulnerablePopulation: demo.vulnerablePopulation,
          vulnerabilityPercentage: Number(((demo.vulnerablePopulation / demo.totalPopulation) * 100).toFixed(1)),
          densityPerSqKm: demo.densityPerSqKm,
          year: demo.year,
        }
      : null,
    publicInvestmentContext: hotspot.administrativeArea.investments.map((i) => ({
      schemeName: i.schemeName,
      allocatedAmountInr: i.allocatedAmountInr,
      spentAmountInr: i.spentAmountInr,
      unspentPercentage: Number((((i.allocatedAmountInr - i.spentAmountInr) / i.allocatedAmountInr) * 100).toFixed(1)),
      fiscalYear: i.fiscalYear,
      status: i.status,
    })),
  };
}
