import { Router } from 'express';
import { runSeed } from '../services/seed.service.js';
import { logAuditEvent } from '../services/audit.service.js';

export const demoRouter = Router();

demoRouter.post('/demo/reset', async (req, res, next) => {
  try {
    console.log('🔄 Triggered official demo data reset...');
    await runSeed();

    await logAuditEvent({
      eventType: 'DEMO_RESET',
      sourceModule: 'SYSTEM',
      performedBy: req.user?.email || 'ADMINISTRATOR',
      validationStatus: 'VALID',
      metadata: { triggeredAt: new Date().toISOString() },
    });

    res.json({
      success: true,
      message: 'CivicTwin AI demonstration dataset has been deterministically reset.',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    next(error);
  }
});
