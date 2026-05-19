// routes/events.js — GET /api/events/:clientId (SSE)

import { Router } from 'express';
import sseManager from '../sseManager.js';
import scheduler from '../scheduler.js';

const router = Router();

router.get('/:clientId', (req, res) => {
  const { clientId } = req.params;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial state
  const snapshot = scheduler.getSnapshot();
  res.write(`event: state-update\ndata: ${JSON.stringify(snapshot)}\n\n`);

  // Register client
  sseManager.register(clientId, res);

  // Handle disconnect
  req.on('close', () => {
    sseManager.unregister(clientId);
  });
});

export default router;
