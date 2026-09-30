import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';
import { prisma } from '../src/server/db.js';
import { calculateHotspotPriority } from '../src/server/services/priority.service.js';
import { detectHotspotsFromSignals } from '../src/server/services/analytics.service.js';

describe('CivicTwin AI - Priority Engine & Spatial Analytics', () => {
  it('computes explainable deterministic priority factors for a seeded hotspot', async () => {
    const hotspot = await prisma.hotspot.findFirst();
    expect(hotspot).toBeDefined();

    if (!hotspot) return;

    const result = await calculateHotspotPriority(hotspot.id);
    expect(result).toBeDefined();
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
    expect(result.factors).toHaveLength(6);

    // Verify all 6 factors are accounted for
    const factorKeys = result.factors.map((f) => f.factorKey);
    expect(factorKeys).toContain('infrastructure_gap');
    expect(factorKeys).toContain('request_volume');
    expect(factorKeys).toContain('affected_population');
    expect(factorKeys).toContain('urgency');
    expect(factorKeys).toContain('service_criticality');
    expect(factorKeys).toContain('investment_gap');

    // Total factor contribution should sum to the composite score (within rounding margin)
    const factorSum = result.factors.reduce((sum, f) => sum + f.contributionPct, 0);
    expect(Math.abs(factorSum - result.compositeScore)).toBeLessThanOrEqual(0.05);
  });

  it('runs POST /api/v1/priority/calculate/:hotspotId via API', async () => {
    const hotspot = await prisma.hotspot.findFirst();
    expect(hotspot).toBeDefined();
    if (!hotspot) return;

    const res = await request(app)
      .post(`/api/v1/priority/calculate/${hotspot.id}`)
      .send({
        weights: {
          infrastructure_gap: 0.35,
          urgency: 0.20,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.compositeScore).toBeDefined();
    expect(res.body.data.factors).toHaveLength(6);
  });

  it('runs POST /api/v1/radar/detect to group spatial signals', async () => {
    const res = await request(app)
      .post('/api/v1/radar/detect')
      .send({ radiusKm: 5.0 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.detectedCount).toBe('number');
  });
});
