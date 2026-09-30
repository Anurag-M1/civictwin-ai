import { Router } from 'express';
import { prisma } from '../db.js';
import {
  detectHotspotsFromSignals,
  getFilteredHotspots,
  generateHotspotExplanation,
  type HotspotFilterOptions,
} from '../services/analytics.service.js';
import { logAuditEvent } from '../services/audit.service.js';

export const radarRouter = Router();

// POST /api/v1/radar/detect - Run spatial clustering and hotspot detection
radarRouter.post('/radar/detect', async (req, res) => {
  try {
    const { radiusKm } = req.body;
    const result = await detectHotspotsFromSignals(radiusKm ? Number(radiusKm) : 3.0);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/radar/hotspots - List and filter active hotspots with risk metrics and summary analytics
radarRouter.get('/radar/hotspots', async (req, res) => {
  try {
    const {
      category,
      stateCode,
      status,
      minScore,
      maxScore,
      urgency,
      search,
      sortBy,
      sortOrder,
      limit,
      offset,
    } = req.query;

    const filterOptions: HotspotFilterOptions = {};
    if (category) filterOptions.category = String(category);
    if (stateCode) filterOptions.stateCode = String(stateCode);
    if (status) filterOptions.status = String(status);
    if (minScore !== undefined) filterOptions.minScore = Number(minScore);
    if (maxScore !== undefined) filterOptions.maxScore = Number(maxScore);
    if (urgency) filterOptions.urgency = String(urgency);
    if (search) filterOptions.search = String(search);
    if (sortBy) filterOptions.sortBy = String(sortBy) as any;
    if (sortOrder) filterOptions.sortOrder = String(sortOrder) as any;
    if (limit) filterOptions.limit = Number(limit);
    if (offset) filterOptions.offset = Number(offset);

    const result = await getFilteredHotspots(filterOptions);

    res.json({
      success: true,
      count: result.count,
      summary: result.summary,
      emptyState: result.emptyState,
      data: result.hotspots,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/radar/hotspots/:id/explanation - Grounded explainability dossier
radarRouter.get('/radar/hotspots/:id/explanation', async (req, res) => {
  try {
    const explanation = await generateHotspotExplanation(req.params.id);
    res.json({
      success: true,
      data: explanation,
    });
  } catch (error: any) {
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

// PATCH /api/v1/radar/hotspots/:id/status - Update hotspot status
radarRouter.patch('/radar/hotspots/:id/status', async (req, res) => {
  try {
    const { status, rationale } = req.body;
    const validStatuses = ['EMERGING', 'ELEVATED', 'MITIGATING', 'RESOLVED'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Expected one of: ${validStatuses.join(', ')}`,
      });
    }

    const existing = await prisma.hotspot.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Hotspot not found' });
    }

    const updated = await prisma.hotspot.update({
      where: { id: req.params.id },
      data: { status },
      include: { administrativeArea: true },
    });

    await logAuditEvent({
      eventType: 'HOTSPOT_STATUS_CHANGE',
      sourceModule: 'RADAR',
      modelIdentifier: 'state-machine-v1',
      outputContent: { previous: existing.status, updated: status },
      validationStatus: 'VALID',
      performedBy: 'ANALYST',
      metadata: {
        hotspotId: req.params.id,
        hotspotCode: existing.hotspotCode,
        rationale: rationale || 'Status updated via Risk Radar console',
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/radar/hotspots/:id - Specific hotspot details
radarRouter.get('/radar/hotspots/:id', async (req, res) => {
  try {
    const hotspot = await prisma.hotspot.findUnique({
      where: { id: req.params.id },
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
        evidenceRecords: true,
        recommendations: {
          include: { evidenceBriefs: true },
        },
        evidenceBriefs: true,
        priorityAssessments: {
          include: { factorContributions: true, scenarios: true },
        },
      },
    });

    if (!hotspot) {
      return res.status(404).json({ success: false, error: 'Hotspot not found' });
    }

    res.json({ success: true, data: hotspot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/infrastructure/assets - Physical assets
radarRouter.get('/infrastructure/assets', async (req, res) => {
  try {
    const { type, conditionRating, stateCode } = req.query;
    const where: any = {};
    if (type) where.type = String(type);
    if (conditionRating) where.conditionRating = String(conditionRating);
    if (stateCode) {
      where.administrativeArea = { stateCode: String(stateCode) };
    }

    const assets = await prisma.infrastructureAsset.findMany({
      where,
      include: {
        administrativeArea: true,
        location: true,
        conditions: { orderBy: { inspectionDate: 'desc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, count: assets.length, data: assets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
