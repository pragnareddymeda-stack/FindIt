import { Router } from 'express';
import { dbStatus } from '../config/db.js';

const router = Router();

router.get('/', (_req, res) => {
  const database = dbStatus();
  res.status(database === 'connected' ? 200 : 503).json({
    success: database === 'connected',
    data: {
      status: database === 'connected' ? 'ok' : 'degraded',
      database,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
