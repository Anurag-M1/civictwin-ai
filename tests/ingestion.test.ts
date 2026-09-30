import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';
import {
  extractCitizenSignal,
  validateAiSignalOutput,
  parseAndValidateGeminiResponse,
} from '../src/server/services/gemini.service.js';

describe('CivicTwin AI - Citizen Intake & Extraction Suite', () => {
  // 1. English Input Test
  it('processes English citizen signal with high confidence and valid category', async () => {
    const englishInput =
      'Severe pothole cluster and road collapse near Mahadevapura primary health centre blocking emergency ambulance access.';
    const result = await extractCitizenSignal(englishInput, 'en');

    expect(result).toBeDefined();
    expect(result.analysis.detectedLanguage).toBe('en');
    expect(['Roads', 'Healthcare']).toContain(result.analysis.category);
    expect(['HIGH', 'CRITICAL']).toContain(result.analysis.urgency);
    expect(result.analysis.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.analysis.requiresHumanReview).toBe(false);
    expect(result.validationResult).toBe('VALID');

    // Test API ingestion for English signal
    const uniqueEnglish = `English Test Report ${Date.now()}: Potholes on outer ring road near hospital.`;
    const res = await request(app)
      .post('/api/v1/citizen/requests')
      .send({
        originalText: uniqueEnglish,
        language: 'en',
        channel: 'WEB',
        location: {
          address: 'Outer Ring Road, Bengaluru',
          latitude: 12.9875,
          longitude: 77.6912,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.language).toBe('en');
    expect(res.body.data.status).toBe('NORMALIZED');
  });

  // 2. Hindi Input Test
  it('processes Hindi citizen signal, detects language accurately and classifies category', async () => {
    const hindiInput =
      'हमारे वार्ड में सिगरा के पास पानी की मुख्य पाइपलाइन टूट गई है और गंदा पानी घरों में आ रहा है। तुरंत मरम्मत की जाए।';
    const result = await extractCitizenSignal(hindiInput, 'hi');

    expect(result).toBeDefined();
    expect(result.analysis.detectedLanguage).toBe('hi');
    expect(result.analysis.category).toBe('Water');
    expect(['HIGH', 'CRITICAL']).toContain(result.analysis.urgency);
    expect(result.analysis.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.validationResult).toBe('VALID');

    // Test API ingestion for Hindi signal
    const uniqueHindi = `हिंदी टेस्ट रिपोर्ट ${Date.now()}: सिगरा में पानी की पाइपलाइन क्षतिग्रस्त है।`;
    const res = await request(app)
      .post('/api/v1/citizen/requests')
      .send({
        originalText: uniqueHindi,
        language: 'hi',
        channel: 'VOICE',
        location: {
          address: 'Sigra, Varanasi, Uttar Pradesh',
          latitude: 25.3176,
          longitude: 82.9739,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.language).toBe('hi');
    expect(res.body.data.category).toBe('Water');
  });

  // 3. Ambiguous Input Test
  it('flags ambiguous input with low confidence and requiresHumanReview = true', async () => {
    const ambiguousText = 'Something is very wrong here. Please fix it immediately, bad condition.';
    const result = await extractCitizenSignal(ambiguousText, 'en');

    expect(result.analysis.requiresHumanReview).toBe(true);
    expect(result.analysis.confidence).toBeLessThan(0.7);
    expect(result.analysis.category).toBe('Other');

    // Test API persistence of ambiguous input
    const uniqueAmbiguous = `Ambiguous report ${Date.now()}: Something is very bad around here please help.`;
    const res = await request(app)
      .post('/api/v1/citizen/requests')
      .send({
        originalText: uniqueAmbiguous,
        language: 'en',
        channel: 'WEB',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.requiresHumanReview).toBe(true);
    expect(res.body.data.status).toBe('FLAGGED');
  });

  // 4. Empty / Too Short Input Test
  it('rejects empty input, whitespace only, and sub-5-character descriptions with HTTP 400', async () => {
    // Empty string
    const emptyRes = await request(app)
      .post('/api/v1/citizen/requests')
      .send({
        originalText: '',
        language: 'en',
      });
    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.success).toBe(false);
    expect(emptyRes.body.code).toBe('VALIDATION_ERROR');

    // Whitespace only
    const whitespaceRes = await request(app)
      .post('/api/v1/citizen/requests')
      .send({
        originalText: '     ',
        language: 'en',
      });
    expect(whitespaceRes.status).toBe(400);
    expect(whitespaceRes.body.success).toBe(false);

    // Too short (< 5 chars)
    const shortRes = await request(app)
      .post('/api/v1/citizen/requests')
      .send({
        originalText: 'bad',
        language: 'en',
      });
    expect(shortRes.status).toBe(400);
    expect(shortRes.body.success).toBe(false);
  });

  // 5. Invalid AI Response Test
  it('validates AI responses server-side and gracefully handles malformed or schema-violating outputs', async () => {
    // 5A: Validate schema validator directly
    const invalidSchemaData = {
      category: 'NonExistentCategory',
      urgency: 'ULTRA_CRITICAL',
    };
    const schemaValidation = validateAiSignalOutput(invalidSchemaData);
    expect(schemaValidation.success).toBe(false);

    // 5B: Test non-JSON response from Gemini
    const malformedResult = parseAndValidateGeminiResponse(
      'Not a valid JSON: Internal Server Note',
      'Broken road',
      'en',
    );
    expect(malformedResult.status).toBe('FAILED');
    expect(malformedResult.validationResult).toBe('INVALID');
    expect(malformedResult.analysis).toBeDefined();

    // 5C: Test invalid JSON structure that fails Zod validation
    const invalidJsonResult = await extractCitizenSignal(
      'Pipeline ruptured near stadium',
      'en',
      {
        mockResponse: JSON.stringify({
          category: 'IntergalacticTransit', // Not in CIVIC_CATEGORIES
          subcategory: 'Warp Drive',
          summary: 'Spaceship issue',
          requestedAction: 'Fix warp gate',
          detectedLanguage: 'en',
          urgency: 'COSMIC',
          affectedService: 'Fleet',
          confidence: 0.99,
        }),
      },
    );

    expect(invalidJsonResult.status).toBe('FALLBACK');
    expect(invalidJsonResult.validationResult).toBe('WARN');
    expect(invalidJsonResult.analysis.category).toBe('Water'); // Correctly parsed via deterministic fallback
  });

  // 6. Timeout Handling Test
  it('handles extraction timeouts gracefully and falls back to deterministic NLP', async () => {
    const text = 'Water supply interrupted for 3 days due to broken pipe';
    const result = await extractCitizenSignal(text, 'en', {
      forceTimeout: true,
      timeoutMs: 10,
    });

    expect(result.status).toBe('FALLBACK');
    expect(result.validationResult).toBe('WARN');
    expect(result.rawResponse).toContain('TIMEOUT_EXCEEDED');
    expect(result.analysis.category).toBe('Water');
  });

  // 7. Duplicate Submission Test
  it('prevents duplicate submissions within 10 minutes with HTTP 409 Conflict', async () => {
    const uniqueText = `Duplicate Prevention Signal ${Date.now()}: Contaminated drinking water in Sigra ward.`;
    const payload = {
      originalText: uniqueText,
      language: 'en',
      channel: 'WEB',
      location: {
        address: 'Sigra Ward, Varanasi',
        latitude: 25.3176,
        longitude: 82.9739,
      },
    };

    // First submission succeeds
    const firstRes = await request(app)
      .post('/api/v1/citizen/requests')
      .send(payload);

    expect(firstRes.status).toBe(201);
    expect(firstRes.body.success).toBe(true);
    const trackingCode = firstRes.body.data.trackingCode;
    expect(trackingCode).toBeDefined();

    // Immediate second submission with identical text triggers 409 Conflict
    const secondRes = await request(app)
      .post('/api/v1/citizen/requests')
      .send(payload);

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.success).toBe(false);
    expect(secondRes.body.code).toBe('CONFLICT');
    expect(secondRes.body.error).toContain('Duplicate submission');
    expect(secondRes.body.details.trackingCode).toBe(trackingCode);
  });

  // 7B. Duplicate Idempotency Key Test
  it('rejects duplicate submissions with same idempotency key', async () => {
    const idempotencyKey = `idem-key-${Date.now()}`;
    const payload1 = {
      originalText: `Idempotency signal A ${Date.now()}: Broken street drainage line.`,
      language: 'en',
      channel: 'WEB',
    };

    const firstRes = await request(app)
      .post('/api/v1/citizen/requests')
      .set('x-idempotency-key', idempotencyKey)
      .send(payload1);

    expect(firstRes.status).toBe(201);

    const payload2 = {
      originalText: `Idempotency signal B ${Date.now()}: Another report using same key.`,
      language: 'en',
      channel: 'WEB',
    };

    const secondRes = await request(app)
      .post('/api/v1/citizen/requests')
      .set('x-idempotency-key', idempotencyKey)
      .send(payload2);

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.code).toBe('CONFLICT');
    expect(secondRes.body.error).toContain(idempotencyKey);
  });

  // 8. Other Indian Languages Test
  it('correctly handles Bengali and Marathi complaints', async () => {
    const bengaliInput = 'রাস্তার পাশে জলের পাইপ ফেটে জল নষ্ট হচ্ছে এবং জল সরবরাহ বন্ধ হয়ে গেছে।';
    const bnResult = await extractCitizenSignal(bengaliInput, 'bn');
    expect(bnResult.analysis.category).toBe('Water');
    expect(bnResult.analysis.detectedLanguage).toBe('bn');

    const marathiInput = 'पुणे नगर रस्ता येथे ड्रेनेज लाईन तुंबल्यामुळे पाणी रस्त्यावर येत आहे.';
    const mrResult = await extractCitizenSignal(marathiInput, 'mr');
    expect(mrResult.analysis.category).toBe('Sanitation');
    expect(mrResult.analysis.detectedLanguage).toBe('mr');
  });

  // 9. Presets Endpoint Test
  it('provides deterministic civic presets via GET /api/v1/citizen/presets', async () => {
    const res = await request(app).get('/api/v1/citizen/presets');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(6);
    expect(res.body.data.some((p: any) => p.language === 'hi')).toBe(true);
    expect(res.body.data.some((p: any) => p.language === 'en')).toBe(true);
  });
});

