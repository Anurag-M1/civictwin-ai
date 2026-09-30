/**
 * CivicTwin AI — Audit Service
 *
 * Centralized service for recording tamper-evident audit events
 * across all AI inferences, deterministic calculations, human reviews,
 * and data ingestion events.
 */

import { createHash } from 'node:crypto';
import { prisma } from '../db.js';
import type { AuditEventType, AuditSourceModule } from '../../shared/constants.js';

export interface CreateAuditParams {
  eventType: AuditEventType | string;
  sourceModule: AuditSourceModule | string;
  modelIdentifier?: string;
  inputContent?: string | object;
  outputContent?: string | object;
  validationStatus?: 'VALID' | 'WARN' | 'INVALID';
  latencyMs?: number;
  performedBy?: string;
  metadata?: Record<string, any>;
}

export function calculateDigest(content: string | object | undefined): string | null {
  if (content === undefined || content === null) return null;
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  return createHash('sha256').update(str).digest('hex').substring(0, 16);
}

export async function logAuditEvent(params: CreateAuditParams) {
  const inputDigest = calculateDigest(params.inputContent);
  const outputDigest = calculateDigest(params.outputContent);

  const event = await prisma.auditEvent.create({
    data: {
      eventType: params.eventType,
      sourceModule: params.sourceModule,
      modelIdentifier: params.modelIdentifier ?? null,
      inputDigest,
      outputDigest,
      validationStatus: params.validationStatus ?? 'VALID',
      latencyMs: params.latencyMs ?? 0,
      performedBy: params.performedBy ?? 'SYSTEM',
      metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });

  return event;
}

export async function queryAuditLogs(filter: {
  eventType?: string;
  sourceModule?: string;
  validationStatus?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};
  if (filter.eventType) where.eventType = filter.eventType;
  if (filter.sourceModule) where.sourceModule = filter.sourceModule;
  if (filter.validationStatus) where.validationStatus = filter.validationStatus;

  const [logs, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filter.limit ?? 50,
      skip: filter.offset ?? 0,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  return { logs, total };
}

export async function getAuditStatistics() {
  const [total, byModule, byValidation] = await Promise.all([
    prisma.auditEvent.count(),
    prisma.auditEvent.groupBy({
      by: ['sourceModule'],
      _count: { _all: true },
    }),
    prisma.auditEvent.groupBy({
      by: ['validationStatus'],
      _count: { _all: true },
    }),
  ]);

  return {
    totalEvents: total,
    byModule: byModule.reduce((acc, curr) => ({ ...acc, [curr.sourceModule]: curr._count._all }), {}),
    byValidation: byValidation.reduce((acc, curr) => ({ ...acc, [curr.validationStatus]: curr._count._all }), {}),
  };
}

export async function verifyAuditRecordIntegrity(
  auditId: string,
  contentToVerify?: { input?: any; output?: any },
) {
  const record = await prisma.auditEvent.findUnique({
    where: { id: auditId },
  });

  if (!record) {
    return { verified: false, error: 'Audit record not found' };
  }

  let inputValid: boolean | null = null;
  let outputValid: boolean | null = null;

  if (contentToVerify?.input !== undefined) {
    const computedInputDigest = calculateDigest(contentToVerify.input);
    inputValid = computedInputDigest === record.inputDigest;
  }

  if (contentToVerify?.output !== undefined) {
    const computedOutputDigest = calculateDigest(contentToVerify.output);
    outputValid = computedOutputDigest === record.outputDigest;
  }

  return {
    verified: (inputValid !== false) && (outputValid !== false),
    record,
    checks: {
      hasInputDigest: Boolean(record.inputDigest),
      hasOutputDigest: Boolean(record.outputDigest),
      inputDigestMatch: inputValid,
      outputDigestMatch: outputValid,
    },
  };
}
