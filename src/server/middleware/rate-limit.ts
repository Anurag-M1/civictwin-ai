/**
 * CivicTwin AI — Rate Limiting Middleware
 *
 * Lightweight, zero-dependency token-bucket rate limiter
 * to protect public DPI endpoints from abuse and DoS.
 */

import type { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export function rateLimiter(options: { maxRequests?: number; windowMs?: number } = {}) {
  const max = options.maxRequests ?? 200;
  const windowMs = options.windowMs ?? 60 * 1000; // 1 minute window

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting during automated test runs
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const clientKey = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const record = store.get(clientKey);

    if (!record || now > record.resetTime) {
      store.set(clientKey, { count: 1, resetTime: now + windowMs });
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      return next();
    }

    if (record.count >= max) {
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit threshold reached. Please wait before retrying.',
      });
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - record.count);
    next();
  };
}
