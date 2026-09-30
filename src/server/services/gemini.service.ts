/**
 * CivicTwin AI — Gemini Service
 *
 * Handles all interactions with the Google Gemini API.
 * Responsibilities:
 *   - Multilingual citizen request extraction (structured JSON output)
 *   - Evidence brief synthesis (Stage 4)
 *   - Zod validation of every AI response
 *   - Deterministic NLP fallback when Gemini is unavailable
 *
 * Gemini performs: language understanding, classification, semantic extraction.
 * Gemini does NOT perform: priority scoring, aggregation, analytics.
 */

import { GoogleGenAI } from '@google/genai';
import { config } from '../../config/index.js';
import { AiNormalizedSignalSchema, type AiNormalizedSignal } from '../../shared/schemas/citizen.schema.js';
import { CIVIC_CATEGORIES } from '../../shared/constants.js';

// ─── SDK Initialization ───────────────────────────────────────────────────────

let genAI: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  if (!config.gemini.hasValidKey) return null;
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }
  return genAI;
}

// ─── Extraction Prompt ────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are CivicTwin AI, a multilingual civic infrastructure analysis engine deployed by Indian government agencies.

Your task: Given a citizen complaint or service request (which may be in Hindi, Bengali, Tamil, Telugu, Marathi, or English), extract structured intelligence.

CRITICAL RULES:
- Detect the language of the original text. Do not translate — preserve the original.
- Classify into ONE of these categories: ${CIVIC_CATEGORIES.join(', ')}
- Provide a specific subcategory (e.g., "Potholes / Arterial Damage", "Contaminated Piped Supply")
- Summarize the issue in English in one clear sentence (max 120 chars)
- Identify the requested action in English
- Extract any location mentions from the text
- Assess urgency: LOW, MEDIUM, HIGH, CRITICAL
- Identify the affected public service
- Estimate confidence (0.0 to 1.0)
- Flag requiresHumanReview = true if confidence < 0.7 or if the request is ambiguous

You must respond with ONLY a valid JSON object matching this exact schema:
{
  "category": "string (one of the civic categories)",
  "subcategory": "string",
  "summary": "string (English, max 120 chars)",
  "requestedAction": "string (English)",
  "detectedLanguage": "string (ISO 639-1 code: en, hi, bn, ta, te, mr)",
  "locationMentions": ["string array of place names mentioned"],
  "urgency": "LOW | MEDIUM | HIGH | CRITICAL",
  "affectedService": "string",
  "confidence": 0.95,
  "requiresHumanReview": false,
  "reasoningBrief": "string (one sentence explaining your classification reasoning)"
}

Do NOT add any text outside the JSON object. Do NOT use markdown fences. Do NOT invent facts.`;

// ─── Gemini Extraction ────────────────────────────────────────────────────────

export interface GeminiExtractionResult {
  analysis: AiNormalizedSignal;
  rawResponse: string;
  tokensUsed: number;
  latencyMs: number;
  status: 'COMPLETED' | 'FALLBACK' | 'FAILED';
  validationResult: 'VALID' | 'WARN' | 'INVALID';
  modelName: string;
}

export interface ExtractionOptions {
  timeoutMs?: number;
  mockResponse?: string;
  forceTimeout?: boolean;
}

/**
 * Server-side validation of AI Normalized Signal schema
 */
export function validateAiSignalOutput(data: unknown) {
  return AiNormalizedSignalSchema.safeParse(data);
}

/**
 * Parses raw text from Gemini, handles markdown fences, and enforces Zod validation
 */
export function parseAndValidateGeminiResponse(
  rawText: string,
  originalText: string,
  declaredLanguage: string,
  meta?: { modelName?: string; tokensUsed?: number; latencyMs?: number },
): GeminiExtractionResult {
  const modelName = meta?.modelName ?? 'gemini-2.5-flash';
  const tokensUsed = meta?.tokensUsed ?? 0;
  const latencyMs = meta?.latencyMs ?? 0;

  // Clean markdown code blocks if present
  let jsonStr = rawText.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error('❌ Gemini returned non-JSON response:', rawText.substring(0, 200));
    const fallback = deterministicFallback(originalText, declaredLanguage);
    return {
      ...fallback,
      rawResponse: rawText,
      latencyMs,
      tokensUsed,
      status: 'FAILED',
      validationResult: 'INVALID',
      modelName,
    };
  }

  const validation = AiNormalizedSignalSchema.safeParse(parsed);
  if (!validation.success) {
    console.error('❌ Gemini output failed Zod validation:', validation.error.format());
    const fallback = deterministicFallback(originalText, declaredLanguage);
    return {
      ...fallback,
      rawResponse: rawText,
      latencyMs,
      tokensUsed,
      status: 'FALLBACK',
      validationResult: 'WARN',
      modelName,
    };
  }

  return {
    analysis: validation.data,
    rawResponse: rawText,
    tokensUsed,
    latencyMs,
    status: 'COMPLETED',
    validationResult: 'VALID',
    modelName,
  };
}

export async function extractCitizenSignal(
  originalText: string,
  declaredLanguage: string,
  options?: ExtractionOptions,
): Promise<GeminiExtractionResult> {
  const startMs = Date.now();

  // Test / simulation hook for forced timeout
  if (options?.forceTimeout) {
    const latencyMs = options.timeoutMs ?? 50;
    const fallback = deterministicFallback(originalText, declaredLanguage);
    return {
      ...fallback,
      rawResponse: 'TIMEOUT_EXCEEDED: Extraction exceeded time limit',
      latencyMs,
      status: 'FALLBACK',
      validationResult: 'WARN',
      modelName: 'deterministic-nlp-v1',
    };
  }

  // Test / simulation hook for mock response
  if (options?.mockResponse !== undefined) {
    const latencyMs = Date.now() - startMs;
    return parseAndValidateGeminiResponse(
      options.mockResponse,
      originalText,
      declaredLanguage,
      {
        modelName: 'gemini-2.5-flash-mock',
        tokensUsed: 120,
        latencyMs,
      },
    );
  }

  const client = getClient();
  if (!client) {
    console.log('⚠️ Gemini API key not configured. Using deterministic fallback NLP.');
    return deterministicFallback(originalText, declaredLanguage);
  }

  const modelName = config.gemini.model;
  const timeoutMs = options?.timeoutMs ?? 15000;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const err = new Error(`Gemini request timed out after ${timeoutMs}ms`);
        err.name = 'TimeoutError';
        reject(err);
      }, timeoutMs);
    });

    const generatePromise = client.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${EXTRACTION_SYSTEM_PROMPT}\n\nCitizen Request (declared language: ${declaredLanguage}):\n"${originalText}"`,
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const latencyMs = Date.now() - startMs;
    const rawText = response.text ?? '';
    const tokensUsed = response.usageMetadata?.totalTokenCount ?? 0;

    return parseAndValidateGeminiResponse(rawText, originalText, declaredLanguage, {
      modelName,
      tokensUsed,
      latencyMs,
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startMs;
    const isTimeout = error.name === 'TimeoutError' || error.message?.includes('timed out');
    console.error(isTimeout ? '⏱️ Gemini extraction timed out:' : '❌ Gemini API error:', error.message);

    const fallback = deterministicFallback(originalText, declaredLanguage);
    return {
      ...fallback,
      rawResponse: isTimeout ? `TIMEOUT_EXCEEDED: ${error.message}` : `API_ERROR: ${error.message}`,
      latencyMs,
      status: 'FALLBACK',
      validationResult: 'WARN',
      modelName,
    };
  }
}

// ─── Deterministic Fallback NLP ───────────────────────────────────────────────

/**
 * Rule-based NLP parser. Used when:
 *   1. Gemini API key is not configured
 *   2. Gemini returns invalid/unparseable output
 *   3. Gemini API is unreachable or times out
 */
export function deterministicFallback(
  originalText: string,
  declaredLanguage: string,
): GeminiExtractionResult {
  const text = originalText.toLowerCase();

  // Category detection via keyword matching with specificity weighting
  const categoryPatterns: Record<string, { highWeight: string[]; normalWeight: string[] }> = {
    Water: {
      highWeight: [
        'pipe', 'pipeline', 'water', 'water supply', 'tap',
        'पाइप', 'जल', 'पानी', 'पेयजल',
        'জল', 'জলের', 'পাইপ', 'জল সরবরাহ',
        'நீர்', 'குடிநீர்', 'குழாய்',
        'నీరు', 'తాగునీరు', 'పైపు',
        'पाणी', 'पाईप'
      ],
      normalWeight: ['supply', 'leakage', 'contamination', 'flow'],
    },
    Sanitation: {
      highWeight: ['drain', 'sewer', 'नाली', 'गंदगी', 'ড্রেন', 'ড্রেনেজ', 'கழிவு', 'drainage', 'sewage', 'ड्रेनेज', 'तुंबल्या', 'డ్రైనేజీ', 'சாக்கடை'],
      normalWeight: ['sanitation', 'कचरा', 'overflow', 'manhole'],
    },
    Healthcare: {
      highWeight: ['hospital', 'ambulance', 'अस्पताल', 'स्वास्थ्य', 'হাসপাতাল', 'மருத்துவமனை', 'phc', 'dispensary'],
      normalWeight: ['health', 'मरीज', 'patient', 'clinic'],
    },
    Electricity: {
      highWeight: ['transformer', 'बिजली', 'বিদ্যুৎ', 'மின்சாரம', 'power cut', 'sparking'],
      normalWeight: ['electric', 'power', 'wire'],
    },
    Roads: {
      highWeight: ['pothole', 'सड़क', 'पुल', 'bridge', 'flyover', 'resurfacing', 'खड्डा'],
      normalWeight: ['road', 'highway', 'pavement', 'রাস্তা', 'சாலை', 'రోడ్డు', 'रस्ता'],
    },
    'Waste Management': {
      highWeight: ['garbage', 'कूड़ा', 'বর্জ্য', 'dump', 'dustbin'],
      normalWeight: ['waste', 'trash', 'debris'],
    },
    'Public Transport': {
      highWeight: ['bus stop', 'metro station', 'बस स्टॉप'],
      normalWeight: ['bus', 'transport', 'metro', 'বাস', 'பேருந்து'],
    },
    'Disaster Resilience': {
      highWeight: ['flood', 'earthquake', 'disaster', 'बाढ़', 'বন্যা'],
      normalWeight: ['storm', 'cyclone', 'inundation'],
    },
  };

  let detectedCategory = 'Other';
  let bestScore = 0;

  for (const [category, { highWeight, normalWeight }] of Object.entries(categoryPatterns)) {
    let score = 0;
    for (const kw of highWeight) {
      if (text.includes(kw.toLowerCase())) score += 3;
    }
    for (const kw of normalWeight) {
      if (text.includes(kw.toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      detectedCategory = category;
    }
  }

  // Ambiguous input heuristics
  const ambiguousPhrases = [
    'something', 'problem here', 'look into', 'fix it', 'not good', 'bad', 'help please',
    'please help', 'समस्या', 'मदद', 'खराब', 'कुछ करो', 'ध्यान दें'
  ];
  const hasAmbiguousKeywords = ambiguousPhrases.some((phrase) => text.includes(phrase));
  const isAmbiguous = bestScore === 0 || (bestScore === 1 && hasAmbiguousKeywords);

  // Urgency detection
  const criticalKeywords = ['emergency', 'ambulance', 'collapse', 'फट', 'टूट', 'critical', 'danger', 'तुरंत', 'ভেঙে', 'contaminated', 'गंद', 'दुर्गंध', 'गन्दा', 'গন্ধ'];
  const highKeywords = ['severe', 'broken', 'blocked', 'damaged', 'खराब', 'तीव्र', 'বন্ধ', 'overflow', 'दुर्गंधी'];
  let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
  if (criticalKeywords.some((kw) => text.includes(kw))) {
    urgency = 'CRITICAL';
  } else if (highKeywords.some((kw) => text.includes(kw))) {
    urgency = 'HIGH';
  }

  // Language detection (basic heuristic based on Unicode ranges)
  let detectedLanguage = declaredLanguage;
  if (!detectedLanguage || detectedLanguage === 'en') {
    if (declaredLanguage === 'mr' || /[\u0900-\u097F]/.test(originalText)) {
      detectedLanguage = declaredLanguage === 'mr' ? 'mr' : 'hi';
    } else if (/[\u0980-\u09FF]/.test(originalText)) {
      detectedLanguage = 'bn';
    } else if (/[\u0B80-\u0BFF]/.test(originalText)) {
      detectedLanguage = 'ta';
    } else if (/[\u0C00-\u0C7F]/.test(originalText)) {
      detectedLanguage = 'te';
    } else {
      detectedLanguage = 'en';
    }
  }

  const confidence = isAmbiguous ? 0.40 : (bestScore >= 3 ? 0.88 : 0.65);
  const requiresHumanReview = isAmbiguous || confidence < 0.70;

  const analysis: AiNormalizedSignal = {
    category: (isAmbiguous ? 'Other' : detectedCategory) as any,
    subcategory: isAmbiguous ? 'Unspecified Citizen Signal' : `${detectedCategory} Infrastructure Issue`,
    summary: originalText.length > 100 ? originalText.substring(0, 97) + '...' : originalText,
    requestedAction: isAmbiguous ? 'Assign municipal field officer for signal verification' : `Address reported ${detectedCategory.toLowerCase()} issue`,
    detectedLanguage,
    locationMentions: [],
    urgency: isAmbiguous ? 'LOW' : urgency,
    affectedService: isAmbiguous ? 'General Administration' : detectedCategory,
    confidence,
    requiresHumanReview,
    reasoningBrief: isAmbiguous
      ? 'Ambiguous citizen input with insufficient civic keyword signals. Routed to human review queue.'
      : `Classified via deterministic civic keyword matching with confidence ${confidence.toFixed(2)}.`,
  };

  return {
    analysis,
    rawResponse: 'DETERMINISTIC_FALLBACK',
    tokensUsed: 0,
    latencyMs: 0,
    status: 'FALLBACK',
    validationResult: 'VALID',
    modelName: 'deterministic-nlp-v1',
  };
}

