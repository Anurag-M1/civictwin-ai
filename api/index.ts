import type { VercelRequest, VercelResponse } from '@vercel/node';
import { app } from '../src/server/index.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
