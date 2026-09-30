/**
 * CivicTwin AI — Authentication & Identity Route
 *
 * Handles official login, identity verification, and role inspection.
 */

import { Router } from 'express';
import { prisma } from '../db.js';
import { LoginInputSchema } from '../../shared/schemas/auth.schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UnauthorizedError } from '../errors/app-error.js';
import { logAuditEvent } from '../services/audit.service.js';

export const authRouter = Router();

// POST /api/v1/auth/login - Official login via email and API key
authRouter.post('/auth/login', async (req, res, next) => {
  try {
    const validation = LoginInputSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validation.error.format(),
      });
    }

    const { email, apiKey } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      await logAuditEvent({
        eventType: 'AUTH_FAILED',
        sourceModule: 'AUTH',
        performedBy: email,
        validationStatus: 'INVALID',
        metadata: { reason: 'User not found or inactive', email },
      });
      throw new UnauthorizedError('Invalid credentials or inactive account');
    }

    // Verify API key if provided
    if (apiKey && user.apiKey && apiKey !== user.apiKey) {
      await logAuditEvent({
        eventType: 'AUTH_FAILED',
        sourceModule: 'AUTH',
        performedBy: email,
        validationStatus: 'INVALID',
        metadata: { reason: 'API key mismatch', email },
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    await logAuditEvent({
      eventType: 'AUTH_LOGIN',
      sourceModule: 'AUTH',
      performedBy: user.email,
      validationStatus: 'VALID',
      metadata: { userId: user.id, role: user.role },
    });

    res.json({
      success: true,
      message: 'Authenticated successfully',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        apiKey: user.apiKey,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me - Current user session
authRouter.get('/auth/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
});

// GET /api/v1/auth/users - List users (Admin only)
authRouter.get('/auth/users', requireRole('ADMINISTRATOR'), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    next(err);
  }
});
