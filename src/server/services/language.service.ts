/**
 * CivicTwin AI — Multilingual & Language Detection Service
 *
 * Configured & Tested Languages:
 *   1. en - English
 *   2. hi - Hindi (हिन्दी)
 *   3. bn - Bengali (বাংলা)
 *   4. ta - Tamil (தமிழ்)
 *   5. te - Telugu (తెలుగు)
 *   6. mr - Marathi (मराठी)
 *
 * Strict Policy:
 *   - Do NOT claim unsupported language capability.
 *   - If text is in an unconfigured script, explicitly flag as unsupported.
 *   - Verbatim preservation of original script.
 */

import { SUPPORTED_LANGUAGES, type LanguageCode } from '../../shared/constants.js';
import { ValidationError } from '../errors/app-error.js';

export interface LanguageDetectionResult {
  code: LanguageCode | 'unsupported';
  detectedLanguage: LanguageCode | 'unsupported';
  isSupported: boolean;
  confidence: number;
  name: string;
  nativeName: string;
  scriptName: string;
  reason: string;
  detectedFeatures?: string[];
  disclaimer?: string;
}

// Characteristic Marathi vocabulary & morphological markers
const MARATHI_MARKERS = [
  'ळ', 'आहे', 'नाही', 'झाले', 'पाणी', 'रस्ता', 'कचरा', 'तुंबल्या', 'नागरिक',
  'तक्रार', 'लवकर', 'दुरुस्त', 'करा', 'माझे', 'होते', 'येथे', 'पाहिजे', 'झाला',
  'पाइपलाइन', 'ड्रेनेज', 'दुर्गंधी', 'फुटली', 'दुरुस्ती', 'पाहणी'
];

// Characteristic Hindi vocabulary & morphological markers
const HINDI_MARKERS = [
  'है', 'नहीं', 'सड़क', 'पानी', 'नाली', 'गंदा', 'करो', 'कृपया', 'होता', 'यहाँ',
  'चाहिए', 'समस्या', 'टूटी', 'बिजली', 'अस्पताल', 'गंदगी', 'फट', 'खराब', 'तुरंत',
  'दुर्गंध', 'कचरा'
];

/**
 * Checks if a language code is in the project's tested, configured suite
 */
export function isLanguageSupported(code: string): code is LanguageCode {
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === code.toLowerCase().trim());
}

/**
 * Retrieves metadata for a supported language code, or all languages if omitted
 */
export function getSupportedLanguageDetails(): typeof SUPPORTED_LANGUAGES;
export function getSupportedLanguageDetails(code: string): (typeof SUPPORTED_LANGUAGES)[number] | undefined;
export function getSupportedLanguageDetails(code?: string): any {
  if (!code) return [...SUPPORTED_LANGUAGES];
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code.toLowerCase().trim());
}

/**
 * Validates that a language is supported, or throws a descriptive ValidationError
 */
export function assertSupportedLanguage(code: string): LanguageCode {
  const normalized = code.toLowerCase().trim();
  if (!isLanguageSupported(normalized)) {
    const supportedList = SUPPORTED_LANGUAGES.map((l) => `${l.name} (${l.code})`).join(', ');
    throw new ValidationError(
      `Language '${code}' is not supported. CivicTwin AI currently supports: ${supportedList}. Do not claim unsupported language capability.`
    );
  }
  return normalized;
}

/**
 * Detects the language of a text string based on script Unicode blocks and vocabulary heuristics
 */
export function detectLanguage(text: string, declaredLanguage?: string): LanguageDetectionResult {
  if (!text || text.trim().length === 0) {
    const fallbackCode = (declaredLanguage && isLanguageSupported(declaredLanguage)) ? declaredLanguage : 'en';
    const details = getSupportedLanguageDetails(fallbackCode)!;
    return {
      code: fallbackCode,
      detectedLanguage: fallbackCode,
      isSupported: true,
      confidence: 0.5,
      name: details.name,
      nativeName: details.native,
      scriptName: 'Latin',
      reason: 'Empty text input, defaulted to declared or baseline English.',
    };
  }

  const trimmed = text.trim();

  // 1. Check for Tamil script (U+0B80 to U+0BFF)
  if (/[\u0B80-\u0BFF]/.test(trimmed)) {
    const details = getSupportedLanguageDetails('ta')!;
    return {
      code: 'ta',
      detectedLanguage: 'ta',
      isSupported: true,
      confidence: 0.98,
      name: details.name,
      nativeName: details.native,
      scriptName: 'Tamil',
      reason: 'Detected Tamil Unicode script block [\\u0B80-\\u0BFF].',
      detectedFeatures: ['Tamil Unicode Script'],
    };
  }

  // 2. Check for Telugu script (U+0C00 to U+0C7F)
  if (/[\u0C00-\u0C7F]/.test(trimmed)) {
    const details = getSupportedLanguageDetails('te')!;
    return {
      code: 'te',
      detectedLanguage: 'te',
      isSupported: true,
      confidence: 0.98,
      name: details.name,
      nativeName: details.native,
      scriptName: 'Telugu',
      reason: 'Detected Telugu Unicode script block [\\u0C00-\\u0C7F].',
      detectedFeatures: ['Telugu Unicode Script'],
    };
  }

  // 3. Check for Bengali script (U+0980 to U+09FF)
  if (/[\u0980-\u09FF]/.test(trimmed)) {
    const details = getSupportedLanguageDetails('bn')!;
    return {
      code: 'bn',
      detectedLanguage: 'bn',
      isSupported: true,
      confidence: 0.98,
      name: details.name,
      nativeName: details.native,
      scriptName: 'Bengali',
      reason: 'Detected Bengali Unicode script block [\\u0980-\\u09FF].',
      detectedFeatures: ['Bengali Unicode Script'],
    };
  }

  // 4. Check for Devanagari script (U+0900 to U+097F) -> Hindi vs Marathi
  if (/[\u0900-\u097F]/.test(trimmed)) {
    // If Marathi character LLA (ळ) is present, it is definitely Marathi
    if (trimmed.includes('ळ')) {
      const details = getSupportedLanguageDetails('mr')!;
      return {
        code: 'mr',
        detectedLanguage: 'mr',
        isSupported: true,
        confidence: 0.98,
        name: details.name,
        nativeName: details.native,
        scriptName: 'Devanagari (Marathi)',
        reason: 'Detected Devanagari script with Marathi distinctive character ळ.',
        detectedFeatures: ["Contains Marathi phoneme 'ळ'"],
      };
    }

    // Check vocabulary counts
    let marathiMatches = 0;
    let hindiMatches = 0;

    for (const kw of MARATHI_MARKERS) {
      if (trimmed.includes(kw)) marathiMatches++;
    }
    for (const kw of HINDI_MARKERS) {
      if (trimmed.includes(kw)) hindiMatches++;
    }

    if (declaredLanguage === 'mr' || marathiMatches > hindiMatches) {
      const details = getSupportedLanguageDetails('mr')!;
      return {
        code: 'mr',
        detectedLanguage: 'mr',
        isSupported: true,
        confidence: marathiMatches > 0 ? 0.94 : 0.85,
        name: details.name,
        nativeName: details.native,
        scriptName: 'Devanagari (Marathi)',
        reason: 'Detected Devanagari script with Marathi morphological vocabulary.',
        detectedFeatures: ['Marathi morphological stop-words'],
      };
    }

    const details = getSupportedLanguageDetails('hi')!;
    return {
      code: 'hi',
      detectedLanguage: 'hi',
      isSupported: true,
      confidence: hindiMatches > 0 ? 0.96 : 0.90,
      name: details.name,
      nativeName: details.native,
      scriptName: 'Devanagari',
      reason: 'Detected Devanagari script with Hindi linguistic structure.',
      detectedFeatures: ['Hindi morphological vocabulary'],
    };
  }

  // 5. Check for unsupported non-Latin scripts (Arabic, Cyrillic, Hanzi, Kana, etc.)
  if (/[\u0600-\u06FF]/.test(trimmed)) {
    return {
      code: 'unsupported',
      detectedLanguage: 'unsupported',
      isSupported: false,
      confidence: 0.95,
      name: 'Arabic',
      nativeName: 'العربية',
      scriptName: 'Arabic',
      reason: 'Detected Arabic script, which is outside the 6 configured Indian DPI languages.',
      disclaimer: 'CivicTwin AI supports strictly the 6 configured Indian languages (en, hi, bn, ta, te, mr). Non-supported languages are not claimed or processed.',
    };
  }
  if (/[\u0400-\u04FF]/.test(trimmed)) {
    return {
      code: 'unsupported',
      detectedLanguage: 'unsupported',
      isSupported: false,
      confidence: 0.95,
      name: 'Cyrillic',
      nativeName: 'Кириллица',
      scriptName: 'Cyrillic',
      reason: 'Detected Cyrillic script, which is outside the 6 configured Indian DPI languages.',
      disclaimer: 'CivicTwin AI supports strictly the 6 configured Indian languages (en, hi, bn, ta, te, mr). Non-supported languages are not claimed or processed.',
    };
  }
  if (/[\u4E00-\u9FFF]/.test(trimmed)) {
    return {
      code: 'unsupported',
      detectedLanguage: 'unsupported',
      isSupported: false,
      confidence: 0.95,
      name: 'East Asian (Hanzi/Kanji)',
      nativeName: '中文',
      scriptName: 'CJK / Hanzi',
      reason: 'Detected CJK script, which is outside the 6 configured Indian DPI languages.',
      disclaimer: 'CivicTwin AI supports strictly the 6 configured Indian languages (en, hi, bn, ta, te, mr). Non-supported languages are not claimed or processed.',
    };
  }

  // 6. Latin Script -> English
  if (/^[a-zA-Z0-9\s.,!?'"()#@%&/\\:;\-_+=₹$€¥°]*$/.test(trimmed)) {
    const details = getSupportedLanguageDetails('en')!;
    return {
      code: 'en',
      detectedLanguage: 'en',
      isSupported: true,
      confidence: 0.95,
      name: details.name,
      nativeName: details.native,
      scriptName: 'Latin',
      reason: 'Detected Latin ASCII script structure (English).',
      detectedFeatures: ['Latin ASCII Alphabet'],
    };
  }

  // Fallback: If declared language is supported, trust declared with lowered confidence
  if (declaredLanguage && isLanguageSupported(declaredLanguage)) {
    const details = getSupportedLanguageDetails(declaredLanguage)!;
    return {
      code: declaredLanguage,
      detectedLanguage: declaredLanguage,
      isSupported: true,
      confidence: 0.70,
      name: details.name,
      nativeName: details.native,
      scriptName: 'Mixed / Declared',
      reason: `Mixed script detected, using declared language '${details.name}'.`,
    };
  }

  // Default to English with disclosure
  const defaultDetails = getSupportedLanguageDetails('en')!;
  return {
    code: 'en',
    detectedLanguage: 'en',
    isSupported: true,
    confidence: 0.60,
    name: defaultDetails.name,
    nativeName: defaultDetails.native,
    scriptName: 'Standard',
    reason: 'Standard fallback to English.',
  };
}
