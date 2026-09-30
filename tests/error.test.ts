import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';

describe('CivicTwin AI — Standard Error Handling Infrastructure', () => {
  it('returns a structured 404 envelope for nonexistent API endpoints', async () => {
    const res = await request(app).get('/api/v1/invalid/endpoint/that/does/not/exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ENDPOINT_NOT_FOUND');
    expect(res.body.error).toContain('Endpoint not found');
    expect(res.body.meta).toHaveProperty('timestamp');
  });

  it('returns structured 400 validation error envelope when payload is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/citizen/requests')
      .send({
        // Missing originalText and invalid language
        language: 'unsupported_language_code',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toBeDefined();
    expect(res.body.meta).toHaveProperty('requestId');
    expect(res.body.meta).toHaveProperty('timestamp');
  });

  it('returns structured 400 when human review payload violates schema', async () => {
    const res = await request(app)
      .post('/api/v1/reviews')
      .send({
        targetType: 'INVALID_TYPE',
        action: 'APPROVED',
        rationale: 'Too short', // Valid rationale requires >= 5 chars
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
