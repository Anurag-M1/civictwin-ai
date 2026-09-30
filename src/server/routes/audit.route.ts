import { Router } from 'express';
import { prisma } from '../db.js';
import { HumanReviewInputSchema } from '../../shared/schemas/review.schema.js';
import {
  logAuditEvent,
  queryAuditLogs,
  getAuditStatistics,
  verifyAuditRecordIntegrity,
} from '../services/audit.service.js';

export const auditRouter = Router();

// GET /api/v1/audit/logs - Retrieve immutable audit events with pagination and filters
auditRouter.get('/audit/logs', async (req, res, next) => {
  try {
    const { eventType, sourceModule, validationStatus, limit = '50', offset = '0' } = req.query;

    const { logs, total } = await queryAuditLogs({
      eventType: eventType ? String(eventType) : undefined,
      sourceModule: sourceModule ? String(sourceModule) : undefined,
      validationStatus: validationStatus ? String(validationStatus) : undefined,
      limit: parseInt(String(limit), 10),
      offset: parseInt(String(offset), 10),
    });

    res.json({ success: true, count: logs.length, total, data: logs });
  } catch (error: any) {
    next(error);
  }
});

// GET /api/v1/audit/stats - Summary statistics of audit trail
auditRouter.get('/audit/stats', async (_req, res, next) => {
  try {
    const stats = await getAuditStatistics();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    next(error);
  }
});

// GET /api/v1/audit/verify/:id - Cryptographic integrity check of an audit record
auditRouter.get('/audit/verify/:id', async (req, res, next) => {
  try {
    const result = await verifyAuditRecordIntegrity(req.params.id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
});

// GET /api/v1/reviews - List human decisions
auditRouter.get('/reviews', async (_req, res, next) => {
  try {
    const reviews = await prisma.humanReview.findMany({
      include: { reviewer: true },
      orderBy: { reviewedAt: 'desc' },
    });
    res.json({ success: true, count: reviews.length, data: reviews });
  } catch (error: any) {
    next(error);
  }
});

import { ValidationError } from '../errors/app-error.js';

// POST /api/v1/reviews - Submit human governance decision (Protected)
auditRouter.post('/reviews', async (req, res, next) => {
  try {
    const validation = HumanReviewInputSchema.safeParse(req.body);
    if (!validation.success) {
      return next(new ValidationError('Validation failed', validation.error.format()));
    }

    const { targetType, targetId, action, rationale, previousValue, newValue } = validation.data;

    // Resolve reviewer: from req.user if authenticated, or from reviewerId in body, or first analyst/admin
    let reviewerId = req.user?.id;
    if (!reviewerId && req.body.reviewerId) {
      reviewerId = String(req.body.reviewerId);
    }
    if (!reviewerId) {
      const defaultUser = await prisma.user.findFirst({
        where: { role: { in: ['ANALYST', 'COMMISSIONER', 'ADMINISTRATOR'] } },
      }) || await prisma.user.findFirst();
      reviewerId = defaultUser?.id || 'USR-ANALYST-001';
    }

    const review = await prisma.humanReview.create({
      data: {
        targetType,
        targetId,
        reviewerId,
        action,
        rationale,
        previousValue: previousValue ?? null,
        newValue: newValue ?? null,
      },
      include: { reviewer: true },
    });

    // Record tamper-evident audit event
    await logAuditEvent({
      eventType: 'HUMAN_REVIEW',
      sourceModule: 'HUMAN_REVIEW',
      performedBy: review.reviewer?.name || 'ANALYST',
      inputContent: { targetType, targetId, previousValue },
      outputContent: { action, rationale, newValue },
      validationStatus: 'VALID',
      metadata: { reviewId: review.id, targetType, targetId, action },
    });

    res.status(201).json({ success: true, message: 'Review recorded', data: review });
  } catch (error: any) {
    next(error);
  }
});
