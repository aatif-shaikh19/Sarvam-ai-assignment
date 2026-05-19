// routes/device.js — POST /api/device/fail, GET /api/device/status

import { Router } from 'express';
import deviceManager from '../deviceManager.js';

const router = Router();

/** Trigger a device failure */
router.post('/fail', (req, res) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: 'Missing required field: deviceId' });
  }

  const result = deviceManager.failDevice(deviceId);

  if (!result.success) {
    return res.status(409).json(result);
  }

  res.json(result);
});

/** Get device health status */
router.get('/status', (_req, res) => {
  res.json({
    devices: deviceManager.getSnapshot(),
    events: deviceManager.getEventLog(),
  });
});

export default router;
