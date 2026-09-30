import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';

describe('CivicTwin AI - REST API Foundation Endpoints', () => {
  it('returns valid health and telemetry on /api/v1/health', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('database');
    expect(res.body).toHaveProperty('gemini');
    expect(res.body).toHaveProperty('metrics');
  });

  it('serves multi-factor priority weights on /api/v1/priority/factors', async () => {
    const res = await request(app).get('/api/v1/priority/factors');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.weights).toHaveProperty('infrastructure_gap', 0.28);
    expect(res.body.weights).toHaveProperty('request_volume', 0.22);
  });

  it('retrieves hierarchical administrative areas on /api/v1/areas', async () => {
    const res = await request(app).get('/api/v1/areas');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
