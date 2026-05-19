// routes/observability.js — GET /api/observability (traces + metrics)

import { Router } from 'express';
import tracer from '../tracer.js';
import metrics from '../metrics.js';

const router = Router();

/** Full observability snapshot: traces + metrics */
router.get('/', (_req, res) => {
  res.json({
    traces: tracer.getRecentTraces(20),
    metrics: metrics.getSnapshot(),
  });
});

/** Get a specific trace by traceId (= requestId) */
router.get('/trace/:traceId', (req, res) => {
  const trace = tracer.getTrace(req.params.traceId);
  if (!trace) {
    return res.status(404).json({ error: 'Trace not found' });
  }
  res.json(trace);
});

/** Get metrics only */
router.get('/metrics', (_req, res) => {
  res.json(metrics.getSnapshot());
});

export default router;
