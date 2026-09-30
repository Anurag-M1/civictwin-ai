import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';
import { prisma } from '../src/server/db.js';

describe('CivicTwin AI — Complete Professional Decision Dashboard & Modules', () => {
  describe('Infrastructure Physical Asset Registry', () => {
    it('retrieves infrastructure assets with condition telemetry and location', async () => {
      const res = await request(app).get('/api/v1/infrastructure/assets');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(1);

      const asset = res.body.data[0];
      expect(asset.assetCode).toBeDefined();
      expect(asset.name).toBeDefined();
      expect(asset.type).toBeDefined();
      expect(asset.conditionRating).toBeDefined();
      expect(asset.administrativeArea).toBeDefined();
    });

    it('filters assets by asset type (e.g. Road, WaterNetwork)', async () => {
      const res = await request(app).get('/api/v1/infrastructure/assets?type=Road');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.every((a: any) => a.type === 'Road')).toBe(true);
    });

    it('filters assets by distress condition rating (e.g. CRITICAL, POOR)', async () => {
      const res = await request(app).get('/api/v1/infrastructure/assets?conditionRating=CRITICAL');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.every((a: any) => a.conditionRating === 'CRITICAL')).toBe(true);
    });

    it('returns empty list gracefully when no assets match filters', async () => {
      const res = await request(app).get('/api/v1/infrastructure/assets?type=NonExistentType');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('Public Capital Investments & Municipal Capex Tracker', () => {
    it('retrieves public investments with aggregate summary metrics', async () => {
      const res = await request(app).get('/api/v1/investments');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.totalAllocatedInr).toBeGreaterThan(0);
      expect(res.body.summary.totalSpentInr).toBeGreaterThan(0);
      expect(typeof res.body.summary.executionRatePct).toBe('number');

      const inv = res.body.data[0];
      expect(inv.schemeName).toBeDefined();
      expect(inv.category).toBeDefined();
      expect(inv.allocatedAmountInr).toBeGreaterThan(0);
      expect(inv.status).toBeDefined();
    });

    it('filters investments by category sector', async () => {
      const res = await request(app).get('/api/v1/investments?category=Water');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.every((i: any) => i.category === 'Water')).toBe(true);
    });

    it('filters investments by state code', async () => {
      const res = await request(app).get('/api/v1/investments?stateCode=KA');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.every((i: any) => i.administrativeArea.stateCode === 'KA')).toBe(true);
    });

    it('retrieves single investment detail with linked administrative area', async () => {
      const first = await prisma.publicInvestment.findFirst();
      expect(first).toBeDefined();
      if (!first) return;

      const res = await request(app).get(`/api/v1/investments/${first.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(first.id);
      expect(res.body.data.administrativeArea).toBeDefined();
    });

    it('computes capex deficit vs citizen demand correlation analysis', async () => {
      const res = await request(app).get('/api/v1/investments/analytics/gap-analysis');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      for (const item of res.body.data) {
        expect(item.areaName).toBeDefined();
        expect(typeof item.allocatedInr).toBe('number');
        expect(typeof item.spentInr).toBe('number');
        expect(typeof item.capexDeficitIndex).toBe('number');
        expect(typeof item.isUnderfunded).toBe('boolean');
      }
    });
  });

  describe('DPI Recommendations & Human Governance Workflow', () => {
    it('retrieves project recommendations with evidence briefs attached', async () => {
      const res = await request(app).get('/api/v1/recommendations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(1);

      const rec = res.body.data[0];
      expect(rec.recommendationCode).toMatch(/^REC-/);
      expect(rec.title).toBeDefined();
      expect(rec.estimatedCostInr).toBeGreaterThan(0);
      expect(rec.targetBeneficiaries).toBeGreaterThan(0);
    });

    it('updates recommendation status and creates tamper-evident human review record', async () => {
      const rec = await prisma.recommendation.findFirst();
      expect(rec).toBeDefined();
      if (!rec) return;

      const res = await request(app)
        .patch(`/api/v1/recommendations/${rec.id}/status`)
        .send({
          status: 'APPROVED',
          reviewNotes: 'Verified against municipal capex ceiling and acoustic leak telemetry.',
          reviewerRole: 'COMMISSIONER',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');

      // Verify human review was recorded
      const review = await prisma.humanReview.findFirst({
        where: { targetId: rec.id },
        orderBy: { reviewedAt: 'desc' },
      });

      expect(review).toBeDefined();
      expect(review?.action).toBe('APPROVED');
      expect(review?.rationale).toContain('Verified against municipal capex ceiling');
    });
  });

  describe('Decision Dashboard Overview Data Feed', () => {
    it('provides all data entities required for executive overview', async () => {
      const [hotspotsRes, requestsRes, assetsRes, recsRes] = await Promise.all([
        request(app).get('/api/v1/radar/hotspots'),
        request(app).get('/api/v1/citizen/requests'),
        request(app).get('/api/v1/infrastructure/assets'),
        request(app).get('/api/v1/recommendations'),
      ]);

      expect(hotspotsRes.status).toBe(200);
      expect(requestsRes.status).toBe(200);
      expect(assetsRes.status).toBe(200);
      expect(recsRes.status).toBe(200);

      expect(hotspotsRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(requestsRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(assetsRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(recsRes.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
