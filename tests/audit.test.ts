import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';
import {
  logAuditEvent,
  calculateDigest,
  queryAuditLogs,
  getAuditStatistics,
  verifyAuditRecordIntegrity,
} from '../src/server/services/audit.service.js';

describe('CivicTwin AI — Audit Trail & Tamper-Evident Digest Infrastructure', () => {
  it('computes deterministic SHA-256 digests for arbitrary content', () => {
    const content = { message: 'High priority road collapse near PHC' };
    const digest1 = calculateDigest(content);
    const digest2 = calculateDigest(content);

    expect(digest1).toBeDefined();
    expect(digest1).toHaveLength(16);
    expect(digest1).toBe(digest2); // Deterministic

    expect(calculateDigest(undefined)).toBeNull();
  });

  it('records tamper-evident audit event with SHA-256 digests', async () => {
    const input = { text: 'Water pipe leak in Sector 4' };
    const output = { category: 'Water', urgency: 'HIGH' };

    const event = await logAuditEvent({
      eventType: 'AI_EXTRACTION',
      sourceModule: 'INGESTION',
      inputContent: input,
      outputContent: output,
      validationStatus: 'VALID',
      performedBy: 'TEST_SUITE',
      metadata: { trackingCode: 'REQ-TEST-001' },
    });

    expect(event).toBeDefined();
    expect(event.id).toBeDefined();
    expect(event.inputDigest).toBe(calculateDigest(input));
    expect(event.outputDigest).toBe(calculateDigest(output));
    expect(event.performedBy).toBe('TEST_SUITE');

    // Verify cryptographic integrity
    const verification = await verifyAuditRecordIntegrity(event.id, {
      input,
      output,
    });
    expect(verification.verified).toBe(true);
    expect(verification.checks.inputDigestMatch).toBe(true);
    expect(verification.checks.outputDigestMatch).toBe(true);
  });

  it('detects tampering when content does not match stored digest', async () => {
    const input = { data: 'original' };
    const event = await logAuditEvent({
      eventType: 'HOTSPOT_DETECTED',
      sourceModule: 'RADAR',
      inputContent: input,
      performedBy: 'TEST_SUITE',
    });

    const verification = await verifyAuditRecordIntegrity(event.id, {
      input: { data: 'tampered_or_modified_content' },
    });

    expect(verification.verified).toBe(false);
    expect(verification.checks.inputDigestMatch).toBe(false);
  });

  it('queries audit logs via GET /api/v1/audit/logs with pagination and filters', async () => {
    const res = await request(app)
      .get('/api/v1/audit/logs')
      .query({ limit: 10, offset: 0 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(10);
    expect(typeof res.body.total).toBe('number');
  });

  it('retrieves audit summary statistics via GET /api/v1/audit/stats', async () => {
    const res = await request(app).get('/api/v1/audit/stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalEvents');
    expect(res.body.data).toHaveProperty('byModule');
    expect(res.body.data).toHaveProperty('byValidation');
    expect(res.body.data.totalEvents).toBeGreaterThan(0);
  });

  it('verifies audit record integrity via GET /api/v1/audit/verify/:id', async () => {
    const event = await logAuditEvent({
      eventType: 'CONFIG_UPDATE',
      sourceModule: 'SYSTEM',
      performedBy: 'ADMIN',
    });

    const res = await request(app).get(`/api/v1/audit/verify/${event.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verified).toBe(true);
    expect(res.body.data.record.id).toBe(event.id);
  });
});
