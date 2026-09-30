import { Router } from 'express';
import { prisma } from '../db.js';

export const dataSourceRouter = Router();

dataSourceRouter.get('/data-sources', async (_req, res) => {
  try {
    const dataSources = await prisma.dataSource.findMany({
      include: {
        ingestionRuns: {
          orderBy: { startedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, count: dataSources.length, data: dataSources });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
