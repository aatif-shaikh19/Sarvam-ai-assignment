// index.js — Express server entry point

import express from 'express';
import cors from 'cors';
import requestRouter from './routes/request.js';
import eventsRouter from './routes/events.js';
import statusRouter from './routes/status.js';
import workerRouter from './routes/worker.js';
import deviceRouter from './routes/device.js';
import observabilityRouter from './routes/observability.js';

// Import supervisor to initialize it (registers itself with scheduler)
import './supervisor.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
app.use('/api/request', requestRouter);
app.use('/api/events', eventsRouter);
app.use('/api/status', statusRouter);
app.use('/api/worker', workerRouter);
app.use('/api/device', deviceRouter);
app.use('/api/observability', observabilityRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`\n  🚀 Edge Agent Runtime Backend`);
  console.log(`  ─────────────────────────────`);
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`  SSE endpoint:      /api/events/:clientId`);
  console.log(`  Request endpoint:  /api/request`);
  console.log(`  Status endpoint:   /api/status`);
  console.log(`  Worker endpoint:   /api/worker/crash`);
  console.log(`  Device endpoint:   /api/device/fail`);
  console.log(`  Observability:     /api/observability\n`);
});
