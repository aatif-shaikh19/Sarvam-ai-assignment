// routes/worker.js — POST /api/worker/crash, GET /api/worker/status

import { Router } from 'express';
import supervisor from '../supervisor.js';

const router = Router();

/** Crash a specific worker slot */
router.post('/crash', (req, res) => {
  const { slotIndex } = req.body;

  if (slotIndex === undefined || slotIndex === null) {
    return res.status(400).json({ error: 'Missing required field: slotIndex' });
  }

  const idx = parseInt(slotIndex, 10);
  if (isNaN(idx) || idx < 0 || idx > 3) {
    return res.status(400).json({ error: 'slotIndex must be 0-3' });
  }

  const result = supervisor.crashWorker(idx);

  if (!result.success) {
    return res.status(409).json(result);
  }

  res.json(result);
});

/** Get supervisor status */
router.get('/status', (_req, res) => {
  res.json(supervisor.getSnapshot());
});

export default router;
