/**
 * CivicTwin AI — AI Provider Abstraction
 *
 * Provides a decoupled interface for Gemini generation, structured output extraction,
 * deterministic fallback execution, and test mocking.
 */

import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { config } from '../../../config/index.js';

export interface GenerateStructuredOptions<T> {
  prompt: string;
  systemInstruction?: string;
  schema: z.ZodType<T, any, any>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  fallbackGenerator?: (prompt: string, error?: Error) => T;
}

export interface AiStructuredResult<T> {
  data: T;
  rawResponse: string;
  tokensUsed: number;
  latencyMs: number;
  modelName: string;
  validationResult: 'VALID' | 'WARN' | 'INVALID';
  isFallback: boolean;
}

export interface GenerateTextOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface AiTextResult {
  text: string;
  tokensUsed: number;
  latencyMs: number;
  modelName: string;
  isFallback: boolean;
}

export interface IAiProvider {
  readonly name: string;
  isConfigured(): boolean;
  generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<AiStructuredResult<T>>;
  generateText(options: GenerateTextOptions): Promise<AiTextResult>;
}

// ─── Google GenAI (Gemini) Implementation ────────────────────────────────────

export class GoogleGenAiProvider implements IAiProvider {
  readonly name = 'GoogleGenAiProvider';
  private client: GoogleGenAI | null = null;
  private readonly defaultModel: string;

  constructor(modelName?: string) {
    this.defaultModel = modelName || config.gemini.model;
  }

  isConfigured(): boolean {
    return config.gemini.hasValidKey;
  }

  private getClient(): GoogleGenAI | null {
    if (!this.isConfigured()) return null;
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
    }
    return this.client;
  }

  async generateStructured<T>(
    options: GenerateStructuredOptions<T>,
  ): Promise<AiStructuredResult<T>> {
    const startMs = Date.now();
    const client = this.getClient();

    if (!client) {
      if (options.fallbackGenerator) {
        const fallbackData = options.fallbackGenerator(options.prompt);
        return {
          data: fallbackData,
          rawResponse: 'DETERMINISTIC_FALLBACK_NO_API_KEY',
          tokensUsed: 0,
          latencyMs: Date.now() - startMs,
          modelName: 'deterministic-fallback',
          validationResult: 'VALID',
          isFallback: true,
        };
      }
      throw new Error('Gemini API key is not configured and no fallback generator was provided.');
    }

    const timeoutMs = options.timeoutMs || 15000;
    const model = this.defaultModel;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const err = new Error(`AI generation timed out after ${timeoutMs}ms`);
          err.name = 'TimeoutError';
          reject(err);
        }, timeoutMs);
      });

      const contents = [
        {
          role: 'user',
          parts: [{ text: options.prompt }],
        },
      ];

      const generatePromise = client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.1,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const latencyMs = Date.now() - startMs;
      const rawText = response.text ?? '';
      const tokensUsed = response.usageMetadata?.totalTokenCount ?? 0;

      // Clean markdown code fences if present
      let jsonStr = rawText.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        if (options.fallbackGenerator) {
          const fallbackData = options.fallbackGenerator(options.prompt);
          return {
            data: fallbackData,
            rawResponse: rawText,
            tokensUsed,
            latencyMs,
            modelName: model,
            validationResult: 'INVALID',
            isFallback: true,
          };
        }
        throw new Error(`Failed to parse AI output as JSON: ${rawText.substring(0, 150)}`);
      }

      const validation = options.schema.safeParse(parsed);
      if (!validation.success) {
        if (options.fallbackGenerator) {
          const fallbackData = options.fallbackGenerator(options.prompt);
          return {
            data: fallbackData,
            rawResponse: rawText,
            tokensUsed,
            latencyMs,
            modelName: model,
            validationResult: 'WARN',
            isFallback: true,
          };
        }
        throw new Error(`AI output failed schema validation: ${JSON.stringify(validation.error.format())}`);
      }

      return {
        data: validation.data,
        rawResponse: rawText,
        tokensUsed,
        latencyMs,
        modelName: model,
        validationResult: 'VALID',
        isFallback: false,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startMs;
      if (options.fallbackGenerator) {
        const fallbackData = options.fallbackGenerator(options.prompt, err);
        return {
          data: fallbackData,
          rawResponse: `ERROR_FALLBACK: ${err.message}`,
          tokensUsed: 0,
          latencyMs,
          modelName: model,
          validationResult: 'WARN',
          isFallback: true,
        };
      }
      throw err;
    }
  }

  async generateText(options: GenerateTextOptions): Promise<AiTextResult> {
    const startMs = Date.now();
    const client = this.getClient();

    if (!client) {
      return {
        text: 'Gemini API not configured.',
        tokensUsed: 0,
        latencyMs: 0,
        modelName: 'deterministic-fallback',
        isFallback: true,
      };
    }

    const timeoutMs = options.timeoutMs || 15000;
    const model = this.defaultModel;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const err = new Error(`AI generation timed out after ${timeoutMs}ms`);
          err.name = 'TimeoutError';
          reject(err);
        }, timeoutMs);
      });

      const generatePromise = client.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ text: options.prompt }],
          },
        ],
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.2,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      return {
        text: response.text ?? '',
        tokensUsed: response.usageMetadata?.totalTokenCount ?? 0,
        latencyMs: Date.now() - startMs,
        modelName: model,
        isFallback: false,
      };
    } catch (err: any) {
      return {
        text: `Error calling Gemini: ${err.message}`,
        tokensUsed: 0,
        latencyMs: Date.now() - startMs,
        modelName: model,
        isFallback: true,
      };
    }
  }
}

// ─── Mock / Test Provider ───────────────────────────────────────────────────

export class MockAiProvider implements IAiProvider {
  readonly name = 'MockAiProvider';
  private structuredResponses = new Map<string, any>();
  private textResponses = new Map<string, string>();
  private simulatedErrors = new Map<string, Error>();
  private simulateTimeout = false;
  private calls: Array<{ type: string; prompt: string; options: any }> = [];

  isConfigured(): boolean {
    return true;
  }

  setMockStructuredResponse<T>(key: string, response: T): void {
    this.structuredResponses.set(key, response);
  }

  setMockTextResponse(key: string, response: string): void {
    this.textResponses.set(key, response);
  }

  setSimulatedError(key: string, error: Error): void {
    this.simulatedErrors.set(key, error);
  }

  setSimulateTimeout(value: boolean): void {
    this.simulateTimeout = value;
  }

  getCalls() {
    return [...this.calls];
  }

  clearCalls(): void {
    this.calls = [];
    this.structuredResponses.clear();
    this.textResponses.clear();
    this.simulatedErrors.clear();
    this.simulateTimeout = false;
  }

  async generateStructured<T>(
    options: GenerateStructuredOptions<T>,
  ): Promise<AiStructuredResult<T>> {
    const startMs = Date.now();
    this.calls.push({ type: 'structured', prompt: options.prompt, options });

    if (this.simulateTimeout) {
      if (options.fallbackGenerator) {
        return {
          data: options.fallbackGenerator(options.prompt, new Error('Simulated Timeout')),
          rawResponse: 'MOCK_TIMEOUT_EXCEEDED',
          tokensUsed: 0,
          latencyMs: 50,
          modelName: 'mock-gemini-2.5',
          validationResult: 'WARN',
          isFallback: true,
        };
      }
      throw new Error('Simulated timeout in MockAiProvider');
    }

    // Check for simulated error matching prompt
    for (const [key, err] of this.simulatedErrors.entries()) {
      if (options.prompt.includes(key)) {
        if (options.fallbackGenerator) {
          return {
            data: options.fallbackGenerator(options.prompt, err),
            rawResponse: `MOCK_ERROR_FALLBACK: ${err.message}`,
            tokensUsed: 0,
            latencyMs: 10,
            modelName: 'mock-gemini-2.5',
            validationResult: 'WARN',
            isFallback: true,
          };
        }
        throw err;
      }
    }

    // Check for registered mock response
    for (const [key, data] of this.structuredResponses.entries()) {
      if (options.prompt.includes(key)) {
        const validation = options.schema.safeParse(data);
        if (!validation.success) {
          if (options.fallbackGenerator) {
            return {
              data: options.fallbackGenerator(options.prompt),
              rawResponse: JSON.stringify(data),
              tokensUsed: 100,
              latencyMs: Date.now() - startMs,
              modelName: 'mock-gemini-2.5',
              validationResult: 'WARN',
              isFallback: true,
            };
          }
          throw new Error('Mock response failed schema validation');
        }

        return {
          data: validation.data,
          rawResponse: JSON.stringify(data),
          tokensUsed: 120,
          latencyMs: Date.now() - startMs,
          modelName: 'mock-gemini-2.5',
          validationResult: 'VALID',
          isFallback: false,
        };
      }
    }

    // Default to fallback generator if available
    if (options.fallbackGenerator) {
      const fallbackData = options.fallbackGenerator(options.prompt);
      return {
        data: fallbackData,
        rawResponse: 'MOCK_FALLBACK_DEFAULT',
        tokensUsed: 0,
        latencyMs: Date.now() - startMs,
        modelName: 'mock-gemini-2.5',
        validationResult: 'VALID',
        isFallback: true,
      };
    }

    throw new Error(`No mock response or fallback generator configured for prompt: ${options.prompt.substring(0, 100)}`);
  }

  async generateText(options: GenerateTextOptions): Promise<AiTextResult> {
    this.calls.push({ type: 'text', prompt: options.prompt, options });

    for (const [key, text] of this.textResponses.entries()) {
      if (options.prompt.includes(key)) {
        return {
          text,
          tokensUsed: 50,
          latencyMs: 10,
          modelName: 'mock-gemini-2.5',
          isFallback: false,
        };
      }
    }

    return {
      text: 'Mock response text',
      tokensUsed: 10,
      latencyMs: 5,
      modelName: 'mock-gemini-2.5',
      isFallback: true,
    };
  }
}

// ─── Provider Registry ───────────────────────────────────────────────────────

let activeProvider: IAiProvider = new GoogleGenAiProvider();

export function getAiProvider(): IAiProvider {
  return activeProvider;
}

export function setAiProvider(provider: IAiProvider): void {
  activeProvider = provider;
}

export function resetAiProvider(): void {
  activeProvider = new GoogleGenAiProvider();
}
