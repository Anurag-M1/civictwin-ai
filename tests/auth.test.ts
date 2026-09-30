import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';

describe('CivicTwin AI — Authentication & Role-Based Access Boundary', () => {
  it('authenticates successfully with valid admin API key', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@civictwin.gov.in',
        apiKey: 'ct_live_admin_key_2026',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('ADMINISTRATOR');
    expect(res.body.data.email).toBe('admin@civictwin.gov.in');
    expect(res.body.data.apiKey).toBe('ct_live_admin_key_2026');
  });

  it('authenticates successfully with valid analyst credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'analyst.infrastructure@civictwin.gov.in',
        apiKey: 'ct_live_analyst_key_2026',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('ANALYST');
  });

  it('rejects login with unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent.officer@domain.gov.in',
        apiKey: 'some_random_key_123',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects login with wrong API key', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@civictwin.gov.in',
        apiKey: 'wrong_key_that_does_not_match',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns current user session on GET /api/v1/auth/me with Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer ct_live_analyst_key_2026');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('analyst.infrastructure@civictwin.gov.in');
    expect(res.body.data.role).toBe('ANALYST');
  });

  it('rejects GET /api/v1/auth/me without credentials with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('forbids non-admin users from accessing GET /api/v1/auth/users with 403', async () => {
    const res = await request(app)
      .get('/api/v1/auth/users')
      .set('Authorization', 'Bearer ct_live_analyst_key_2026'); // Role: ANALYST

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('allows administrator to access GET /api/v1/auth/users', async () => {
    const res = await request(app)
      .get('/api/v1/auth/users')
      .set('Authorization', 'Bearer ct_live_admin_key_2026'); // Role: ADMINISTRATOR

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(2);
  });

  it('supports simulated test role header in test environment', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('x-user-role', 'COMMISSIONER');

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('COMMISSIONER');
  });
});
