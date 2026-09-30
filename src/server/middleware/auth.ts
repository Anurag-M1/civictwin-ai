/**
 * CivicTwin AI — Authentication & Role-Based Access Boundary
 *
 * Enforces role-based governance boundaries for municipal decision-makers,
 * analysts, field officers, and administrators.
 */

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error.js';
import type { AuthenticatedUser, UserRole } from '../../shared/types/index.js';

// Extend Express Request interface with optional user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser | null;
    }
  }
}

/**
 * Extracts and verifies credentials from request headers:
 *   1. Authorization: Bearer <apiKey>
 *   2. x-api-key: <apiKey>
 *   3. x-user-email: <email> (Dev/Testing/Demo mode)
 *   4. x-user-role: <role> (Dev/Testing simulated role)
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    let apiKey: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7).trim();
    } else if (req.headers['x-api-key']) {
      apiKey = String(req.headers['x-api-key']).trim();
    }

    if (apiKey) {
      const user = await prisma.user.findUnique({
        where: { apiKey },
      });

      if (user && user.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
          department: user.department,
          isActive: user.isActive,
        };
        return next();
      }
    }

    // Dev / Test convenience header support (strictly disabled in production to prevent spoofing)
    const emailHeader = req.headers['x-user-email'];
    if (emailHeader && process.env.NODE_ENV !== 'production') {
      const user = await prisma.user.findUnique({
        where: { email: String(emailHeader) },
      });
      if (user && user.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
          department: user.department,
          isActive: user.isActive,
        };
        return next();
      }
    }

    // Simulated role for testing without database user lookup
    const roleHeader = req.headers['x-user-role'];
    if (roleHeader && process.env.NODE_ENV === 'test') {
      req.user = {
        id: 'SIMULATED-USER-ID',
        email: 'test@civictwin.gov.in',
        name: 'Simulated Test User',
        role: String(roleHeader).toUpperCase() as UserRole,
        isActive: true,
      };
      return next();
    }

    req.user = null;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: Strictly requires authentication
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication credentials required to access this resource'));
  }
  next();
}

/**
 * Middleware: Requires specific role(s)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication credentials required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied for role '${req.user.role}'. Required roles: ${roles.join(', ')}`,
          { currentRole: req.user.role, requiredRoles: roles },
        ),
      );
    }

    next();
  };
}
