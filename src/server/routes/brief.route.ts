import { Router } from 'express';
import { prisma } from '../db.js';
import { generateEvidenceBrief } from '../services/brief.service.js';

export const briefRouter = Router();

// GET /api/v1/recommendations - List recommendations with cited briefs
briefRouter.get('/recommendations', async (req, res) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) where.status = String(status);

    const recommendations = await prisma.recommendation.findMany({
      where,
      include: {
        hotspot: {
          include: { administrativeArea: true, evidenceRecords: true },
        },
        evidenceBriefs: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: recommendations.length, data: recommendations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/briefs/:hotspotId - Get evidence brief for hotspot
briefRouter.get('/briefs/:hotspotId', async (req, res) => {
  try {
    const brief = await prisma.evidenceBrief.findFirst({
      where: { hotspotId: req.params.hotspotId },
      include: {
        hotspot: {
          include: { evidenceRecords: true, administrativeArea: true },
        },
        recommendation: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!brief) {
      return res.status(404).json({ success: false, error: 'No evidence brief generated for this hotspot yet' });
    }

    let structuredEvidence: any[] = [];
    try {
      structuredEvidence = JSON.parse(brief.whyEmerging);
    } catch {
      structuredEvidence = [];
    }

    let citedIds: string[] = [];
    try {
      citedIds = JSON.parse(brief.citedEvidenceIds);
    } catch {
      citedIds = brief.citedEvidenceIds.split(',').map((s) => s.trim()).filter(Boolean);
    }

    res.json({
      success: true,
      data: {
        ...brief,
        problem: brief.problemSummary,
        evidence: Array.isArray(structuredEvidence) ? structuredEvidence : [],
        potentialIntervention: brief.potentialIntervention,
        implementationConsiderations: brief.implementationConsiderations,
        risks: brief.risks,
        dependencies: brief.dependencies,
        limitations: brief.dataLimitations,
        confidence: brief.confidenceScore,
        humanReviewRequirement: {
          required: brief.requiresHumanReview,
          reason: brief.requiresHumanReview
            ? 'Statutory municipal capital expenditure requires administrative verification and commissioner sign-off.'
            : 'Advisory operational notice.',
        },
        citedEvidenceIds: citedIds,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/briefs/:hotspotId/evidence-pack - Gather and inspect raw application-derived structured evidence pack
briefRouter.get('/briefs/:hotspotId/evidence-pack', async (req, res) => {
  try {
    const { hotspotId } = req.params;
    const { gatherHotspotEvidence } = await import('../services/brief.service.js');
    const pack = await gatherHotspotEvidence(hotspotId);
    res.json({ success: true, data: pack });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/v1/briefs/generate/:hotspotId - Synthesize grounded evidence brief using Gemini
briefRouter.post('/briefs/generate/:hotspotId', async (req, res) => {
  try {
    const { hotspotId } = req.params;
    const brief = await generateEvidenceBrief(hotspotId);
    res.status(201).json({ success: true, message: 'Evidence brief synthesized', data: brief });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/v1/recommendations/:id/status - Update recommendation approval status
briefRouter.patch('/recommendations/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes, reviewerRole = 'COMMISSIONER' } = req.body;

    const updated = await prisma.recommendation.update({
      where: { id },
      data: { status },
      include: {
        hotspot: true,
        evidenceBriefs: true,
      },
    });

    const reviewer = await prisma.user.findFirst();
    if (reviewer) {
      await prisma.humanReview.create({
        data: {
          targetType: 'RECOMMENDATION',
          targetId: id,
          reviewerId: reviewer.id,
          action: status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'MODIFIED',
          rationale: reviewNotes || `Recommendation status transitioned to ${status} by ${reviewerRole}`,
        },
      });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


