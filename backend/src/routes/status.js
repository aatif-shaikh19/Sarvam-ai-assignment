// routes/status.js — GET /api/status

import { Router } from 'express';
import scheduler from '../scheduler.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(scheduler.getSnapshot());
});

export default router;
