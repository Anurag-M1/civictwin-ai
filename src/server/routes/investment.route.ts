import { Router } from 'express';
import { prisma } from '../db.js';

export const investmentRouter = Router();

// GET /api/v1/investments - List public capital investments with filters & summary
investmentRouter.get('/investments', async (req, res) => {
  try {
    const { category, stateCode, fiscalYear, status, search, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (category) where.category = String(category);
    if (fiscalYear) where.fiscalYear = String(fiscalYear);
    if (status) where.status = String(status);
    if (stateCode) {
      where.administrativeArea = { stateCode: String(stateCode) };
    }
    if (search) {
      where.OR = [
        { schemeName: { contains: String(search) } },
        { category: { contains: String(search) } },
        { administrativeArea: { name: { contains: String(search) } } },
      ];
    }

    const [investments, totalCount, allInvestments] = await Promise.all([
      prisma.publicInvestment.findMany({
        where,
        include: {
          administrativeArea: true,
        },
        orderBy: { allocatedAmountInr: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.publicInvestment.count({ where }),
      prisma.publicInvestment.findMany({
        where,
        select: {
          allocatedAmountInr: true,
          spentAmountInr: true,
          category: true,
          status: true,
          schemeName: true,
        },
      }),
    ]);

    // Compute summary analytics
    let totalAllocated = 0;
    let totalSpent = 0;
    const categoryDistribution: Record<string, number> = {};
    const statusDistribution: Record<string, number> = {};

    for (const inv of allInvestments) {
      totalAllocated += inv.allocatedAmountInr;
      totalSpent += inv.spentAmountInr;
      categoryDistribution[inv.category] = (categoryDistribution[inv.category] || 0) + inv.allocatedAmountInr;
      statusDistribution[inv.status] = (statusDistribution[inv.status] || 0) + 1;
    }

    const executionRate = totalAllocated > 0 ? Number(((totalSpent / totalAllocated) * 100).toFixed(1)) : 0;

    res.json({
      success: true,
      count: totalCount,
      summary: {
        totalAllocatedInr: totalAllocated,
        totalSpentInr: totalSpent,
        executionRatePct: executionRate,
        unspentInr: totalAllocated - totalSpent,
        statusDistribution,
        categoryDistribution,
      },
      data: investments,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/investments/:id - Single investment detail
investmentRouter.get('/investments/:id', async (req, res) => {
  try {
    const investment = await prisma.publicInvestment.findUnique({
      where: { id: req.params.id },
      include: {
        administrativeArea: {
          include: {
            hotspots: { take: 3 },
            assets: { take: 5 },
            demographics: { take: 1, orderBy: { year: 'desc' } },
          },
        },
      },
    });

    if (!investment) {
      return res.status(404).json({ success: false, error: 'Investment record not found' });
    }

    res.json({ success: true, data: investment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/investments/analytics/gap-analysis - Capex vs citizen demand correlation
investmentRouter.get('/investments/analytics/gap-analysis', async (_req, res) => {
  try {
    const areas = await prisma.administrativeArea.findMany({
      where: { level: { in: ['WARD', 'DISTRICT'] } },
      include: {
        investments: true,
        hotspots: true,
      },
    });

    const gaps = areas.map((area) => {
      const allocated = area.investments.reduce((sum, inv) => sum + inv.allocatedAmountInr, 0);
      const spent = area.investments.reduce((sum, inv) => sum + inv.spentAmountInr, 0);
      const activeHotspotsCount = area.hotspots.length;
      const maxScore = area.hotspots.reduce((max, h) => Math.max(max, h.prioritySignalScore), 0);

      const capexDeficitIndex =
        activeHotspotsCount > 0 && allocated === 0
          ? 95.0
          : allocated > 0 && spent / allocated < 0.4
            ? 75.0
            : 35.0;

      return {
        areaId: area.id,
        areaName: area.name,
        stateCode: area.stateCode,
        allocatedInr: allocated,
        spentInr: spent,
        activeHotspotsCount,
        maxPriorityScore: maxScore,
        capexDeficitIndex,
        isUnderfunded: activeHotspotsCount > 0 && (allocated === 0 || spent / allocated < 0.5),
      };
    });

    res.json({ success: true, data: gaps });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
