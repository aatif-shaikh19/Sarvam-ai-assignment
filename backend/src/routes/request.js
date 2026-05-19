// routes/request.js — POST /api/request

import { Router } from 'express';
import scheduler from '../scheduler.js';

const router = Router();

router.post('/', (req, res) => {
  const { mfeId, priority, prompt, clientId } = req.body;

  if (!mfeId || !prompt || !clientId) {
    return res.status(400).json({ error: 'Missing required fields: mfeId, prompt, clientId' });
  }

  if (!['doc-qa', 'meeting'].includes(mfeId)) {
    return res.status(400).json({ error: 'Invalid mfeId. Must be "doc-qa" or "meeting"' });
  }

  const result = scheduler.enqueue({
    mfeId,
    priority: priority === 0 ? 0 : 1,
    prompt,
    clientId,
  });

  res.json({
    success: true,
    requestId: result.requestId,
    queuePosition: result.queuePosition,
  });
});

export default router;
