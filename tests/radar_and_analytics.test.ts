import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';
import { prisma } from '../src/server/db.js';
import {
  haversineDistanceKm,
  calculateTrendVelocity,
  detectHotspotsFromSignals,
  getFilteredHotspots,
  generateHotspotExplanation,
} from '../src/server/services/analytics.service.js';

describe('CivicTwin AI — Infrastructure Risk Radar & Spatial Analytics', () => {
  describe('Geodesic Distance & Spatial Aggregation', () => {
    it('accurately computes Haversine distance between geographic coordinates', () => {
      // Distance between two points in Bengaluru (~3.4 km)
      const dist1 = haversineDistanceKm(12.9875, 77.6912, 12.9600, 77.7100);
      expect(dist1).toBeGreaterThan(3.0);
      expect(dist1).toBeLessThan(4.0);

      // Distance to identical point is 0
      const distZero = haversineDistanceKm(12.9875, 77.6912, 12.9875, 77.6912);
      expect(distZero).toBe(0);

      // Distance between Bengaluru and Varanasi (~1450 km)
      const distLong = haversineDistanceKm(12.9716, 77.5946, 25.3176, 82.9739);
      expect(distLong).toBeGreaterThan(1400);
      expect(distLong).toBeLessThan(1500);
    });

    it('calculates trend growth velocity across temporal signal windows', () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

      // Case 1: Spike in recent signals (3 recent vs 1 prior = +200% growth)
      const spikeRequests = [
        { createdAt: threeDaysAgo },
        { createdAt: threeDaysAgo },
        { createdAt: threeDaysAgo },
        { createdAt: twentyDaysAgo },
      ];
      const velocitySpike = calculateTrendVelocity(spikeRequests);
      expect(velocitySpike).toBe(200.0);

      // Case 2: Steady signal flow (1 recent vs 1 prior = 0% growth)
      const steadyRequests = [{ createdAt: threeDaysAgo }, { createdAt: twentyDaysAgo }];
      const velocitySteady = calculateTrendVelocity(steadyRequests);
      expect(velocitySteady).toBe(0.0);

      // Case 3: Empty requests returns 0.0
      expect(calculateTrendVelocity([])).toBe(0.0);
    });
  });

  describe('Hotspot Detection & Spatial Clustering Engine', () => {
    it('executes deterministic clustering and updates hotspots with evidence grounding', async () => {
      const result = await detectHotspotsFromSignals(3.0);

      expect(result).toBeDefined();
      expect(result.emptyState).toBe(false);
      expect(result.detectedCount).toBeGreaterThanOrEqual(1);
      expect(result.clustersCount).toBeGreaterThanOrEqual(1);

      // Verify each generated hotspot has valid centroid and risk metrics
      for (const h of result.hotspots) {
        expect(h.hotspotCode).toMatch(/^HOT-/);
        expect(h.centerLat).toBeGreaterThan(8.0); // India latitude bounds
        expect(h.centerLng).toBeGreaterThan(68.0); // India longitude bounds
        expect(h.prioritySignalScore).toBeGreaterThanOrEqual(0);
        expect(h.prioritySignalScore).toBeLessThanOrEqual(100);
        expect(h.confidenceScore).toBeGreaterThan(0);
      }
    });

    it('handles empty state gracefully when no active geocoded signals exist', async () => {
      // Query with a scenario where no requests exist by mocking/temporarily filtering
      const origFindMany = prisma.citizenRequest.findMany;
      prisma.citizenRequest.findMany = async () => [];

      try {
        const result = await detectHotspotsFromSignals(3.0);
        expect(result.detectedCount).toBe(0);
        expect(result.emptyState).toBe(true);
        expect(result.message).toContain('No active geocoded');
      } finally {
        prisma.citizenRequest.findMany = origFindMany;
      }
    });
  });

  describe('Hotspot Multi-Criteria Filtering & Aggregation', () => {
    it('filters hotspots by sector category', async () => {
      const result = await getFilteredHotspots({ category: 'Roads' });

      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.hotspots.every((h) => h.category === 'Roads')).toBe(true);
      expect(result.summary.categoryDistribution).toHaveProperty('Roads');
    });

    it('filters hotspots by state code', async () => {
      const resultKA = await getFilteredHotspots({ stateCode: 'KA' });

      expect(resultKA.count).toBeGreaterThanOrEqual(1);
      expect(resultKA.hotspots.every((h) => h.administrativeArea.stateCode === 'KA')).toBe(true);
    });

    it('filters hotspots by minimum priority score threshold', async () => {
      const result = await getFilteredHotspots({ minScore: 75 });

      expect(result.hotspots.every((h) => h.prioritySignalScore >= 75)).toBe(true);
      expect(result.summary.highRiskCount).toBe(result.count);
    });

    it('filters hotspots by status lifecycle', async () => {
      const result = await getFilteredHotspots({ status: 'EMERGING' });

      expect(result.hotspots.every((h) => h.status === 'EMERGING')).toBe(true);
    });

    it('returns clean empty state when filters match zero hotspots', async () => {
      const result = await getFilteredHotspots({ stateCode: 'NON_EXISTENT_STATE' });

      expect(result.count).toBe(0);
      expect(result.emptyState).toBe(true);
      expect(result.hotspots).toEqual([]);
      expect(result.summary.totalHotspots).toBe(0);
    });
  });

  describe('Evidence-Backed Hotspot Explainability', () => {
    it('generates a comprehensive explainability dossier for a hotspot', async () => {
      const hotspot = await prisma.hotspot.findFirst({
        where: { hotspotCode: 'HOT-KA-BLR-001' },
      });
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      const explanation = await generateHotspotExplanation(hotspot.id);

      expect(explanation.hotspotCode).toBe('HOT-KA-BLR-001');
      expect(explanation.executiveSummary).toContain('Mahadevapura');
      expect(explanation.prioritySignalScore).toBeGreaterThan(0);

      // Verify mathematical factor contributions
      expect(explanation.factorContributions.length).toBe(6);
      const factorKeys = explanation.factorContributions.map((fc) => fc.factorKey);
      expect(factorKeys).toContain('infrastructure_gap');
      expect(factorKeys).toContain('request_volume');
      expect(factorKeys).toContain('affected_population');
      expect(factorKeys).toContain('urgency');

      // Verify grounded evidence records are cited
      expect(explanation.groundedEvidenceRecords.length).toBeGreaterThanOrEqual(1);
      expect(explanation.groundedEvidenceRecords[0].evidenceCode).toMatch(/^EV-/);

      // Verify demographics context
      expect(explanation.demographicsContext).toBeDefined();
      expect(explanation.demographicsContext?.totalPopulation).toBeGreaterThan(0);

      // Verify connected signals summary
      expect(explanation.connectedSignalsSummary.totalSignals).toBeGreaterThan(0);
      expect(explanation.connectedSignalsSummary.sampleSignals.length).toBeGreaterThanOrEqual(1);
    });

    it('throws 404 when generating explanation for a non-existent hotspot', async () => {
      await expect(generateHotspotExplanation('non-existent-hotspot-id')).rejects.toThrow('not found');
    });
  });

  describe('Infrastructure Risk Radar REST API Integration', () => {
    it('GET /api/v1/radar/hotspots returns filtered list with summary analytics', async () => {
      const res = await request(app).get('/api/v1/radar/hotspots?category=Water');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary).toHaveProperty('totalHotspots');
      expect(res.body.summary).toHaveProperty('statusDistribution');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.every((h: any) => h.category === 'Water')).toBe(true);
    });

    it('GET /api/v1/radar/hotspots/:id/explanation returns explainability payload', async () => {
      const hotspot = await prisma.hotspot.findFirst({
        where: { hotspotCode: 'HOT-KA-BLR-001' },
      });
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      const res = await request(app).get(`/api/v1/radar/hotspots/${hotspot.id}/explanation`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hotspotCode).toBe('HOT-KA-BLR-001');
      expect(res.body.data.factorContributions).toBeDefined();
      expect(res.body.data.groundedEvidenceRecords).toBeDefined();
    });

    it('PATCH /api/v1/radar/hotspots/:id/status updates status with audit logging', async () => {
      const hotspot = await prisma.hotspot.findFirst();
      expect(hotspot).toBeDefined();
      if (!hotspot) return;

      const res = await request(app)
        .patch(`/api/v1/radar/hotspots/${hotspot.id}/status`)
        .send({ status: 'MITIGATING', rationale: 'Field team dispatched for verification' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('MITIGATING');

      // Verify invalid status rejection
      const resInvalid = await request(app)
        .patch(`/api/v1/radar/hotspots/${hotspot.id}/status`)
        .send({ status: 'INVALID_STATUS' });

      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.success).toBe(false);
    });

    it('GET /api/v1/infrastructure/assets retrieves physical assets with condition filters', async () => {
      const res = await request(app).get('/api/v1/infrastructure/assets?conditionRating=POOR');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.every((a: any) => a.conditionRating === 'POOR')).toBe(true);
    });
  });
});
