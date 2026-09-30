/**
 * CivicTwin AI — Ingestion Service
 *
 * Ingests citizen reports across Web, Voice, and Messaging channels.
 * Pipeline:
 *   1. Accept validated input
 *   2. Run Gemini multilingual extraction (with fallback)
 *   3. Record location & administrative area linkage
 *   4. Persist CitizenRequest and AiAnalysis entities
 *   5. Log tamper-evident audit event
 */

import { prisma } from '../db.js';
import type { CitizenRequestInput } from '../../shared/schemas/citizen.schema.js';
import { extractCitizenSignal, type ExtractionOptions } from './gemini.service.js';
import { logAuditEvent } from './audit.service.js';
import { ValidationError, ConflictError } from '../errors/app-error.js';

export async function ingestCitizenRequest(
  input: CitizenRequestInput,
  options?: ExtractionOptions,
) {
  // 1. Input sanitization and validation defense
  const text = input.originalText ? input.originalText.trim() : '';
  if (!text || text.length < 5) {
    throw new ValidationError('Citizen request description must be at least 5 characters long.');
  }

  // 2. Duplicate submission prevention
  // A. Check idempotency key if supplied
  if (input.idempotencyKey) {
    const existingAudit = await prisma.auditEvent.findFirst({
      where: {
        metadataJson: {
          contains: input.idempotencyKey,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existingAudit) {
      const meta = JSON.parse(existingAudit.metadataJson || '{}');
      throw new ConflictError(
        `Duplicate request: An identical request with idempotency key '${input.idempotencyKey}' was already ingested under tracking code ${meta.trackingCode || 'existing'}.`,
        { trackingCode: meta.trackingCode, idempotencyKey: input.idempotencyKey },
      );
    }
  }

  // B. Check for recent identical submission within last 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentDuplicate = await prisma.citizenRequest.findFirst({
    where: {
      originalText: text,
      createdAt: { gte: tenMinutesAgo },
    },
    include: {
      location: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recentDuplicate) {
    throw new ConflictError(
      `Duplicate submission: An identical citizen request was already submitted recently (Tracking Code: ${recentDuplicate.trackingCode}).`,
      {
        trackingCode: recentDuplicate.trackingCode,
        createdAt: recentDuplicate.createdAt,
        category: recentDuplicate.category,
      },
    );
  }

  const trackingCode = `REQ-2026-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  // 3. Resolve administrative area if not explicitly supplied
  let areaId = input.administrativeAreaId;
  if (areaId) {
    const exists = await prisma.administrativeArea.findUnique({ where: { id: areaId } });
    if (!exists) areaId = undefined;
  }

  if (!areaId && input.location?.address) {
    const addr = input.location.address.toLowerCase();
    let areaMatch = null;
    if (addr.includes('bengaluru') || addr.includes('bangalore') || addr.includes('mahadevapura')) {
      areaMatch = await prisma.administrativeArea.findFirst({ where: { name: { contains: 'Mahadevapura' } } });
    } else if (addr.includes('varanasi') || addr.includes('sigra')) {
      areaMatch = await prisma.administrativeArea.findFirst({ where: { name: { contains: 'Varanasi' } } });
    } else if (addr.includes('pune') || addr.includes('nagar road')) {
      areaMatch = await prisma.administrativeArea.findFirst({ where: { name: { contains: 'Pune' } } });
    }
    if (areaMatch) {
      areaId = areaMatch.id;
    }
  }

  if (!areaId) {
    const defaultArea =
      (await prisma.administrativeArea.findFirst({
        where: { level: 'WARD' },
        select: { id: true },
      })) ||
      (await prisma.administrativeArea.findFirst({
        where: { level: 'DISTRICT' },
        select: { id: true },
      })) ||
      (await prisma.administrativeArea.findFirst({
        select: { id: true },
      }));
    if (defaultArea) {
      areaId = defaultArea.id;
    }
  }

  // 4. Persist location record if supplied
  let locationId: string | undefined;
  if (input.location && areaId) {
    const loc = await prisma.location.create({
      data: {
        administrativeAreaId: areaId,
        address: input.location.address,
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        landmark: input.location.landmark ?? null,
      },
    });
    locationId = loc.id;
  }

  // 5. AI Extraction (Gemini with deterministic NLP fallback)
  const extraction = await extractCitizenSignal(text, input.language, options);
  const { analysis } = extraction;

  // 6. Create Citizen Request
  const citizenReq = await prisma.citizenRequest.create({
    data: {
      trackingCode,
      originalText: text,
      language: analysis.detectedLanguage || input.language,
      channel: input.channel,
      category: analysis.category,
      subcategory: analysis.subcategory,
      summary: analysis.summary,
      requestedAction: analysis.requestedAction,
      affectedService: analysis.affectedService,
      confidence: analysis.confidence,
      requiresHumanReview: analysis.requiresHumanReview,
      urgency: analysis.urgency,
      status: analysis.requiresHumanReview ? 'FLAGGED' : 'NORMALIZED',
      locationId: locationId ?? null,
    },
    include: {
      location: {
        include: { administrativeArea: true },
      },
    },
  });

  // 7. Create AI Analysis record
  const aiAnalysis = await prisma.aiAnalysis.create({
    data: {
      citizenRequestId: citizenReq.id,
      modelName: extraction.modelName,
      rawPrompt: text,
      rawResponse: extraction.rawResponse,
      normalizedOutput: JSON.stringify(analysis),
      tokensUsed: extraction.tokensUsed,
      latencyMs: extraction.latencyMs,
      status: extraction.status,
      validationResult: extraction.validationResult,
    },
  });

  // 8. Centralized Audit Logging
  await logAuditEvent({
    eventType: 'AI_EXTRACTION',
    sourceModule: 'INGESTION',
    modelIdentifier: extraction.modelName,
    inputContent: text,
    outputContent: analysis,
    validationStatus: extraction.validationResult,
    latencyMs: extraction.latencyMs,
    performedBy: input.channel === 'VOICE' ? 'CITIZEN_VOICE' : 'CITIZEN',
    metadata: {
      trackingCode,
      category: analysis.category,
      urgency: analysis.urgency,
      channel: input.channel,
      confidence: analysis.confidence,
      requiresHumanReview: analysis.requiresHumanReview,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });

  return {
    ...citizenReq,
    aiAnalyses: [aiAnalysis],
  };
}
