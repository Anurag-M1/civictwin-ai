import { Router } from 'express';
import { prisma } from '../db.js';

export const areasRouter = Router();

// GET /api/v1/areas - Hierarchical administrative areas with filter
areasRouter.get('/areas', async (req, res) => {
  try {
    const { level, stateCode } = req.query;
    const where: any = {};
    if (level) where.level = String(level);
    if (stateCode) where.stateCode = String(stateCode);

    const areas = await prisma.administrativeArea.findMany({
      where,
      include: {
        demographics: {
          orderBy: { year: 'desc' },
          take: 1,
        },
        investments: true,
        _count: {
          select: {
            hotspots: true,
            assets: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, count: areas.length, data: areas });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
