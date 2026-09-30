export * from '../constants.js';
export * from '../schemas/citizen.schema.js';
export * from '../schemas/priority.schema.js';
export * from '../schemas/brief.schema.js';
export * from '../schemas/auth.schema.js';
export * from '../schemas/review.schema.js';
export * from '../schemas/evidence-graph.schema.js';

import type { UserRole } from '../constants.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string | null;
  isActive: boolean;
}

export interface ApiMeta {
  requestId?: string;
  timestamp: string;
  version?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  count?: number;
  message?: string;
  error?: string;
  code?: string;
  details?: any;
  meta?: ApiMeta;
}

export interface SystemHealthResponse {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  version: string;
  uptime: number;
  database: 'CONNECTED' | 'DISCONNECTED';
  gemini: {
    status: 'ONLINE' | 'OFFLINE_FALLBACK';
    model: string;
  };
  metrics: {
    totalRequests: number;
    activeHotspots: number;
    totalAssets: number;
    auditRecordsCount: number;
  };
  timestamp: string;
}
