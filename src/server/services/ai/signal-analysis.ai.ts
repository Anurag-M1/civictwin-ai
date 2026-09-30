/**
 * CivicTwin AI — Isolated Request Analysis & Classification Service
 *
 * Responsibilities:
 *   - Multilingual citizen signal understanding (Hindi, Bengali, Tamil, Telugu, Marathi, English)
 *   - Civic category classification (Roads, Water, Sanitation, Healthcare, Electricity, etc.)
 *   - Subcategory refinement and English intent summarization
 *   - Location/Entity extraction (NER)
 *   - Urgency & human review flagging
 *   - Schema-enforced structured JSON output
 */

import {
  AiNormalizedSignalSchema,
  type AiNormalizedSignal,
} from '../../../shared/schemas/citizen.schema.js';
import { CIVIC_CATEGORIES } from '../../../shared/constants.js';
import { getAiProvider, type AiStructuredResult, type IAiProvider } from './ai-provider.js';

const SIGNAL_ANALYSIS_SYSTEM_PROMPT = `You are CivicTwin AI's Multilingual Signal Intake & Entity Extraction Engine deployed by Indian government agencies.

Your task: Given a citizen infrastructure report in Hindi, Bengali, Tamil, Telugu, Marathi, or English, extract structured intelligence.

CRITICAL RULES:
- Detect the language of the original text. Do not translate the input text itself.
- Classify into ONE of these categories: ${CIVIC_CATEGORIES.join(', ')}
- Provide a specific subcategory (e.g. "Potholes / Arterial Damage", "Contaminated Piped Supply", "Drainage Blockage")
- Summarize the issue in English in one clear sentence (max 120 chars)
- Identify the requested action in English
- Extract any location mentions, landmarks, or street names mentioned
- Assess urgency: LOW, MEDIUM, HIGH, CRITICAL
- Identify the affected public service
- Estimate confidence (0.0 to 1.0)
- Flag requiresHumanReview = true if confidence < 0.70 or if the request is ambiguous or lacks civic detail`;

export function deterministicSignalFallback(
  originalText: string,
  declaredLanguage: string = 'en',
): AiNormalizedSignal {
  const text = originalText.toLowerCase();

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
  const criticalKeywords = ['emergency', 'ambulance', 'collapse', 'फट', 'टूट', 'critical', 'danger', 'तुरंत', 'ভেঙে', 'contaminated', 'गंद', 'दुर्गंध', 'गन्दा', 'গন্ধ', 'spark', 'sparks', 'fire', 'hazard'];
  const highKeywords = ['severe', 'broken', 'blocked', 'damaged', 'खराब', 'तीव्र', 'বন্ধ', 'overflow', 'दुर्गंधी'];
  let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
  if (criticalKeywords.some((kw) => text.includes(kw))) {
    urgency = 'CRITICAL';
  } else if (highKeywords.some((kw) => text.includes(kw))) {
    urgency = 'HIGH';
  }

  // Language detection
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

  // Extract location mentions from basic capitalizations or common Indian landmark keywords
  const locationMentions: string[] = [];
  const words = originalText.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[^a-zA-Z]/g, '');
    if (w.length > 3 && /^[A-Z][a-z]+$/.test(w) && !['Near', 'Please', 'Help', 'From', 'With', 'Very'].includes(w)) {
      locationMentions.push(w);
    }
  }

  const confidence = isAmbiguous ? 0.40 : (bestScore >= 3 ? 0.88 : 0.65);
  const requiresHumanReview = isAmbiguous || confidence < 0.70;

  return {
    category: (isAmbiguous ? 'Other' : detectedCategory) as any,
    subcategory: isAmbiguous ? 'Unspecified Citizen Signal' : `${detectedCategory} Infrastructure Issue`,
    summary: originalText.length > 100 ? originalText.substring(0, 97) + '...' : originalText,
    requestedAction: isAmbiguous
      ? 'Assign municipal field officer for signal verification'
      : `Address reported ${detectedCategory.toLowerCase()} issue`,
    detectedLanguage,
    locationMentions: locationMentions.slice(0, 3),
    urgency: isAmbiguous ? 'LOW' : urgency,
    affectedService: isAmbiguous ? 'General Administration' : detectedCategory,
    confidence,
    requiresHumanReview,
    reasoningBrief: isAmbiguous
      ? 'Ambiguous citizen input with insufficient civic keyword signals. Routed to human review queue.'
      : `Classified via deterministic civic keyword matching with confidence ${confidence.toFixed(2)}.`,
  };
}

export async function analyzeCitizenSignal(
  originalText: string,
  declaredLanguage: string = 'en',
  options?: {
    provider?: IAiProvider;
    timeoutMs?: number;
  },
): Promise<AiStructuredResult<AiNormalizedSignal>> {
  const provider = options?.provider || getAiProvider();

  const prompt = `Citizen Infrastructure Report (Declared Language: ${declaredLanguage}):
"${originalText}"

Extract structured classification and entity details strictly following the schema.`;

  return provider.generateStructured<AiNormalizedSignal>({
    prompt,
    systemInstruction: SIGNAL_ANALYSIS_SYSTEM_PROMPT,
    schema: AiNormalizedSignalSchema,
    temperature: 0.1,
    maxTokens: 1024,
    timeoutMs: options?.timeoutMs || 15000,
    fallbackGenerator: () => deterministicSignalFallback(originalText, declaredLanguage),
  });
}
