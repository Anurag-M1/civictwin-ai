import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/index.js';
import {
  detectLanguage,
  isLanguageSupported,
  assertSupportedLanguage,
  getSupportedLanguageDetails,
} from '../src/server/services/language.service.js';
import { transcribeVoiceAudio } from '../src/server/services/voice.service.js';
import { prisma } from '../src/server/db.js';

describe('CivicTwin AI - Multilingual & Voice Intake Suite', () => {
  // =========================================================================
  // 1. Language Detection & Strict DPI Scope
  // =========================================================================
  describe('Language Detection Service', () => {
    it('detects English (en) accurately', () => {
      const text = 'Severe waterlogging and broken stormwater drain on Mahatma Gandhi Road.';
      const result = detectLanguage(text, 'en');
      expect(result.detectedLanguage).toBe('en');
      expect(result.isSupported).toBe(true);
      expect(result.scriptName).toContain('Latin');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('detects Hindi (hi) in Devanagari script accurately', () => {
      const text = 'हमारे क्षेत्र में मुख्य पेयजल पाइपलाइन टूट गई है और गंदा पानी नलों में आ रहा है।';
      const result = detectLanguage(text, 'hi');
      expect(result.detectedLanguage).toBe('hi');
      expect(result.isSupported).toBe(true);
      expect(result.scriptName).toBe('Devanagari');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('detects Bengali (bn) accurately', () => {
      const text = 'রাস্তার পাশে পানীয় জলের প্রধান পাইপলাইন ফেটে গিয়ে জল নষ্ট হচ্ছে।';
      const result = detectLanguage(text);
      expect(result.detectedLanguage).toBe('bn');
      expect(result.isSupported).toBe(true);
      expect(result.scriptName).toBe('Bengali');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects Tamil (ta) accurately', () => {
      const text = 'எங்கள் பகுதியில் மழைநீர் வடிகால் அடைபட்டு கழிவுநீர் தேங்கி நிற்கிறது.';
      const result = detectLanguage(text);
      expect(result.detectedLanguage).toBe('ta');
      expect(result.isSupported).toBe(true);
      expect(result.scriptName).toBe('Tamil');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects Telugu (te) accurately', () => {
      const text = 'ప్రాథమిక ఆరోగ్య కేంద్రం వద్ద రోడ్డు తీవ్రంగా దెబ్బతిన్నది.';
      const result = detectLanguage(text);
      expect(result.detectedLanguage).toBe('te');
      expect(result.isSupported).toBe(true);
      expect(result.scriptName).toBe('Telugu');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('distinguishes Marathi (mr) from Hindi using Marathi-specific phoneme ळ and vocabulary', () => {
      // Contains Marathi phoneme 'ळ' and key Marathi marker 'आहे'
      const marathiText = 'पुणे नगर रस्त्यावरील मुख्य ड्रेनेज लाईन तुंबल्यामुळे घाण पाणी रस्त्यावर येत आहे आणि शाळा जवळ दुर्गंधी पसरली आहे.';
      const result = detectLanguage(marathiText, 'mr');
      expect(result.detectedLanguage).toBe('mr');
      expect(result.isSupported).toBe(true);
      expect(result.scriptName).toBe('Devanagari (Marathi)');
      expect(result.detectedFeatures).toContain("Contains Marathi phoneme 'ळ'");
    });

    it('strictly flags unsupported languages/scripts and does NOT claim capability', () => {
      // Cyrillic (Russian)
      const cyrillicText = 'Прорыв водопроводной трубы на главной улице.';
      const cyrillicResult = detectLanguage(cyrillicText);
      expect(cyrillicResult.isSupported).toBe(false);
      expect(cyrillicResult.detectedLanguage).toBe('unsupported');
      expect(cyrillicResult.scriptName).toBe('Cyrillic');
      expect(cyrillicResult.disclaimer).toContain('CivicTwin AI supports strictly the 6 configured Indian languages');

      // Arabic
      const arabicText = 'تسرب المياه في الشارع الرئيسي';
      const arabicResult = detectLanguage(arabicText);
      expect(arabicResult.isSupported).toBe(false);
      expect(arabicResult.detectedLanguage).toBe('unsupported');
      expect(arabicResult.scriptName).toBe('Arabic');

      // CJK / Chinese
      const cjkText = '主要街道上的供水管道破裂';
      const cjkResult = detectLanguage(cjkText);
      expect(cjkResult.isSupported).toBe(false);
      expect(cjkResult.detectedLanguage).toBe('unsupported');
      expect(cjkResult.scriptName).toBe('CJK / Hanzi');
    });

    it('enforces isLanguageSupported and assertSupportedLanguage boundaries', () => {
      expect(isLanguageSupported('en')).toBe(true);
      expect(isLanguageSupported('hi')).toBe(true);
      expect(isLanguageSupported('bn')).toBe(true);
      expect(isLanguageSupported('ta')).toBe(true);
      expect(isLanguageSupported('te')).toBe(true);
      expect(isLanguageSupported('mr')).toBe(true);

      expect(isLanguageSupported('es')).toBe(false);
      expect(isLanguageSupported('ru')).toBe(false);
      expect(isLanguageSupported('zh')).toBe(false);

      expect(() => assertSupportedLanguage('hi')).not.toThrow();
      expect(() => assertSupportedLanguage('fr')).toThrow(/Language 'fr' is not supported/);
    });

    it('returns official DPI supported language metadata', () => {
      const details = getSupportedLanguageDetails();
      expect(details).toHaveLength(6);
      const codes = details.map((d) => d.code);
      expect(codes).toEqual(expect.arrayContaining(['en', 'hi', 'bn', 'ta', 'te', 'mr']));
    });
  });

  // =========================================================================
  // 2. Voice Transcription Service & Verbatim Preservation
  // =========================================================================
  describe('Voice Transcription Service', () => {
    it('transcribes simulated voice audio in all 6 configured languages and preserves verbatim text', async () => {
      const testCases = [
        {
          lang: 'hi',
          text: 'वाराणसी सिगरा में पानी की पाइपलाइन क्षतिग्रस्त है।',
        },
        {
          lang: 'en',
          text: 'Road collapse and deep potholes blocking Outer Ring Road.',
        },
        {
          lang: 'bn',
          text: 'কলকাতায় নিকাশী নালা আটকে জল জমেছে।',
        },
        {
          lang: 'ta',
          text: 'சென்னையில் மழைநீர் வடிகால் அடைபட்டுள்ளது.',
        },
        {
          lang: 'te',
          text: 'హైదరాబాద్ లో రోడ్డు గుంతలు తీవ్రంగా ఉన్నాయి.',
        },
        {
          lang: 'mr',
          text: 'पुण्यात ड्रेनेज लाईन फुटल्यामुळे रस्त्यावर पाणी आले आहे.',
        },
      ];

      for (const tc of testCases) {
        const result = await transcribeVoiceAudio({
          simulatedTranscript: tc.text,
          languageHint: tc.lang,
        });

        expect(result.channel).toBe('VOICE');
        expect(result.transcript).toBe(tc.text);
        expect(result.originalText).toBe(tc.text); // Verbatim preservation guarantee
        expect(result.detectedLanguage).toBe(tc.lang);
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        expect(result.auditRecordId).toBeDefined();
      }
    });

    it('enforces supported audio MIME types', async () => {
      await expect(
        transcribeVoiceAudio({
          audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
          mimeType: 'video/mp4', // Unsupported MIME type
        }),
      ).rejects.toThrow(/Unsupported audio MIME type 'video\/mp4'/);
    });

    it('rejects unsupported language voice transcripts without false claims', async () => {
      await expect(
        transcribeVoiceAudio({
          simulatedTranscript: 'Это не поддерживаемый язык для индийской системы.',
        }),
      ).rejects.toThrow(/Citizen voice input is in an unsupported language/);
    });

    it('creates tamper-evident audit log with SHA-256 digest on voice transcription', async () => {
      const voiceText = 'ऑडिट ट्रेल टेस्ट: वाराणसी में सड़क की मरम्मत आवश्यक है।';
      const result = await transcribeVoiceAudio({
        simulatedTranscript: voiceText,
        languageHint: 'hi',
      });

      expect(result.auditRecordId).toBeDefined();

      const auditEntry = await prisma.auditEvent.findUnique({
        where: { id: result.auditRecordId },
      });

      expect(auditEntry).not.toBeNull();
      expect(auditEntry?.eventType).toBe('VOICE_TRANSCRIPTION');
      expect(auditEntry?.outputDigest).toBeDefined();
    });
  });

  // =========================================================================
  // 3. Multilingual & Voice API Endpoints
  // =========================================================================
  describe('Multilingual & Voice API Endpoints', () => {
    it('GET /api/v1/citizen/languages returns all 6 DPI supported languages and policy notice', async () => {
      const res = await request(app).get('/api/v1/citizen/languages');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(6);
      expect(res.body.data).toHaveLength(6);
      expect(res.body.policyNotice).toContain('CivicTwin AI supports strictly the 6 configured Indian languages');
    });

    it('POST /api/v1/citizen/detect-language returns accurate script and language metadata', async () => {
      const res = await request(app)
        .post('/api/v1/citizen/detect-language')
        .send({
          text: 'எங்கள் பகுதியில் மழைநீர் வடிகால் அடைபட்டு கழிவுநீர் தேங்கி நிற்கிறது.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.detectedLanguage).toBe('ta');
      expect(res.body.data.isSupported).toBe(true);
      expect(res.body.data.scriptName).toBe('Tamil');
    });

    it('POST /api/v1/citizen/detect-language flags unsupported languages', async () => {
      const res = await request(app)
        .post('/api/v1/citizen/detect-language')
        .send({
          text: 'هذا طلب غير مدعوم باللغة العربية',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.detectedLanguage).toBe('unsupported');
      expect(res.body.data.isSupported).toBe(false);
      expect(res.body.data.disclaimer).toBeDefined();
    });

    it('POST /api/v1/citizen/voice-transcribe transcribes audio and sets channel to VOICE', async () => {
      const voiceInput = 'बंगाल टेस्ट: পানীয় জলের প্রধান পাইপলাইন ফেটে জল অপচয় হচ্ছে।';
      const res = await request(app)
        .post('/api/v1/citizen/voice-transcribe')
        .send({
          simulatedTranscript: voiceInput,
          languageHint: 'bn',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transcript).toBe(voiceInput);
      expect(res.body.data.originalText).toBe(voiceInput);
      expect(res.body.data.detectedLanguage).toBe('bn');
      expect(res.body.data.channel).toBe('VOICE');
      expect(res.body.data.auditRecordId).toBeDefined();
    });

    it('POST /api/v1/citizen/voice-transcribe rejects unsupported audio MIME types with 400', async () => {
      const res = await request(app)
        .post('/api/v1/citizen/voice-transcribe')
        .send({
          audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
          mimeType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unsupported audio MIME type');
    });

    it('POST /api/v1/citizen/voice-transcribe rejects unsupported languages with 400', async () => {
      const res = await request(app)
        .post('/api/v1/citizen/voice-transcribe')
        .send({
          simulatedTranscript: 'Неможливий запит російською або іншою непідтримуваною мовою.',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('unsupported language');
    });

    it('POST /api/v1/citizen/requests persists voice request with verbatim originalText and channel VOICE', async () => {
      const verbatimMarathi = `पुणे नगर रस्ता तक्रार ${Date.now()}: मुख्य ड्रेनेज लाईन तुंबल्यामुळे घाण पाणी येत आहे.`;

      const res = await request(app)
        .post('/api/v1/citizen/requests')
        .send({
          originalText: verbatimMarathi,
          language: 'mr',
          channel: 'VOICE',
          location: {
            address: 'Ahmednagar Road, Vadgaon Sheri, Pune, Maharashtra',
            latitude: 18.5524,
            longitude: 73.9182,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.channel).toBe('VOICE');
      expect(res.body.data.originalText).toBe(verbatimMarathi); // Verbatim content preserved
      expect(res.body.data.language).toBe('mr');

      // Verify directly in database
      const dbRecord = await prisma.citizenRequest.findUnique({
        where: { id: res.body.data.id },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.channel).toBe('VOICE');
      expect(dbRecord?.originalText).toBe(verbatimMarathi);
      expect(dbRecord?.language).toBe('mr');
    });

    it('POST /api/v1/citizen/requests rejects requests with unsupported languages', async () => {
      const res = await request(app)
        .post('/api/v1/citizen/requests')
        .send({
          originalText: 'Ceci est une demande en français qui n est pas prise en charge.',
          language: 'fr', // Unsupported
          channel: 'WEB',
          location: {
            address: 'Connaught Place, New Delhi',
            latitude: 28.6315,
            longitude: 77.2167,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details?.language).toBeDefined();
    });
  });
});
