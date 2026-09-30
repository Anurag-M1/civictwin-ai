/**
 * CivicTwin AI — Centralized Error Handling Middleware
 *
 * Catches all operational and unexpected errors, ensures tamper-evident
 * structured API error responses, and prevents sensitive stack leakage in production.
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { config } from '../../config/index.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const timestamp = new Date().toISOString();
  const requestId = (req.headers['x-request-id'] as string) || `req-${Math.random().toString(36).substring(2, 9)}`;

  // 1. Handled Domain AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      details: err.details ?? null,
      meta: {
        requestId,
        timestamp,
      },
    });
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.format(),
      meta: {
        requestId,
        timestamp,
      },
    });
  }

  // 3. Prisma Known Request Errors
  if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    let statusCode = 400;
    let message = 'Database operation failed';
    let code = 'DATABASE_ERROR';

    if (err.code === 'P2002') {
      statusCode = 409;
      message = 'A record with this unique identifier already exists';
      code = 'UNIQUE_CONSTRAINT_VIOLATION';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Requested record was not found in the database';
      code = 'RECORD_NOT_FOUND';
    }

    return res.status(statusCode).json({
      success: false,
      error: message,
      code,
      details: config.env === 'development' ? err.meta : undefined,
      meta: {
        requestId,
        timestamp,
      },
    });
  }

  // 4. Fallback: Unexpected Internal Error
  console.error('💥 Unhandled Internal Server Error:', err);

  const message = config.env === 'development' ? err.message : 'An internal server error occurred';

  return res.status(500).json({
    success: false,
    error: message,
    code: 'INTERNAL_SERVER_ERROR',
    meta: {
      requestId,
      timestamp,
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    code: 'ENDPOINT_NOT_FOUND',
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}
