import { Router } from 'express';
import { prisma } from '../db.js';
import { config } from '../../config/index.js';
import { SystemHealthResponse } from '../../shared/types/index.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  let dbStatus: 'CONNECTED' | 'DISCONNECTED';
  let totalRequests = 0;
  let activeHotspots = 0;
  let totalAssets = 0;
  let auditRecordsCount = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'CONNECTED';
    [totalRequests, activeHotspots, totalAssets, auditRecordsCount] = await Promise.all([
      prisma.citizenRequest.count(),
      prisma.hotspot.count({ where: { status: { in: ['EMERGING', 'ELEVATED'] } } }),
      prisma.infrastructureAsset.count(),
      prisma.auditEvent.count(),
    ]);
  } catch (error) {
    console.error('Health check DB connection error:', error);
    dbStatus = 'DISCONNECTED';
  }

  const response: SystemHealthResponse = {
    status: dbStatus === 'CONNECTED' ? 'HEALTHY' : 'DEGRADED',
    version: '1.0.0-prototype',
    uptime: process.uptime(),
    database: dbStatus,
    gemini: {
      status: config.gemini.hasValidKey ? 'ONLINE' : 'OFFLINE_FALLBACK',
      model: config.gemini.model,
    },
    metrics: {
      totalRequests,
      activeHotspots,
      totalAssets,
      auditRecordsCount,
    },
    timestamp: new Date().toISOString(),
  };

  const statusCode = response.status === 'HEALTHY' ? 200 : 503;
  res.status(statusCode).json({
    ...response,
    memory: {
      rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      heapTotalMb: Math.round(process.memoryUsage().heapTotal / (1024 * 1024)),
    },
  });
});

// GET /api/v1/liveness - Lightweight liveness probe for container orchestrators
healthRouter.get('/liveness', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// GET /api/v1/readiness - Readiness probe checking database readiness
healthRouter.get('/readiness', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'READY',
      database: 'CONNECTED',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'NOT_READY',
      database: 'DISCONNECTED',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

