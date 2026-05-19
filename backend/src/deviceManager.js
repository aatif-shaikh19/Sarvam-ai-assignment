// deviceManager.js — Device registry with health tracking, circuit breaker,
// fallback orchestration, and health probe simulation.
// All devices are virtual; no real hardware required.

import sseManager from './sseManager.js';

const PROBE_INTERVAL_MS = 30_000;   // Health probe every 30s
const PROBES_TO_RECOVER = 2;        // 2 successful probes to re-enable

const DEVICE_TEMPLATES = [
  { id: 'npu-0', type: 'NPU', maxSlots: 1, latencyMultiplier: 0.6 },
  { id: 'npu-1', type: 'NPU', maxSlots: 1, latencyMultiplier: 0.6 },
  { id: 'gpu-0', type: 'GPU', maxSlots: 1, latencyMultiplier: 0.8 },
  { id: 'cpu-0', type: 'CPU', maxSlots: 4, latencyMultiplier: 1.0 },
];

class DeviceManager {
  constructor() {
    this.devices = DEVICE_TEMPLATES.map(d => ({
      ...d,
      active: 0,
      status: 'HEALTHY',           // HEALTHY | DEGRADED | FAILED | RECOVERING
      circuitBreaker: 'CLOSED',    // CLOSED | OPEN | HALF_OPEN
      successfulProbes: 0,
      failedAt: null,
      recoveredAt: null,
      lastProbeAt: null,
      nextProbeAt: null,
      _probeTimer: null,
    }));

    /** Event log for the fallback timeline (last 50 entries) */
    this.eventLog = [];
  }

  // ── Allocation with fallback ──────────────────────────────

  /**
   * Allocate the best available HEALTHY device (NPU > GPU > CPU).
   * Emits fallback/latency SSE events when a higher-priority device is skipped due to failure.
   */
  allocate() {
    let skippedFailedDevice = null;

    for (const dev of this.devices) {
      // Skip unhealthy devices
      if (dev.status !== 'HEALTHY') {
        // Track the first skipped device that WOULD have had capacity
        if (!skippedFailedDevice && dev.active < dev.maxSlots) {
          skippedFailedDevice = dev;
        }
        continue;
      }

      // Skip full devices
      if (dev.active >= dev.maxSlots) continue;

      // Allocate
      dev.active++;
      const result = {
        id: dev.id,
        type: dev.type,
        latencyMultiplier: dev.latencyMultiplier,
      };

      // Detect fallback: a higher-priority device was skipped due to failure
      if (skippedFailedDevice && skippedFailedDevice.type !== dev.type) {
        this._emitFallback(skippedFailedDevice, dev);
      }

      // Always emit latency estimate
      sseManager.broadcast('latency_est_ms', {
        deviceId: dev.id,
        type: dev.type,
        multiplier: dev.latencyMultiplier,
        estimatedTokenMs: Math.round(80 * dev.latencyMultiplier),
        ts: Date.now(),
      });

      return result;
    }

    return null; // should not happen if scheduler respects global cap
  }

  /** Release a device by id */
  release(deviceId) {
    const dev = this.devices.find(d => d.id === deviceId);
    if (dev && dev.active > 0) {
      dev.active--;
    }
  }

  // ── Failure simulation ────────────────────────────────────

  /**
   * Trigger a device failure.
   * @param {string} deviceId — e.g. 'npu-0'
   * @returns {{ success: boolean, error?: string }}
   */
  failDevice(deviceId) {
    const dev = this.devices.find(d => d.id === deviceId);
    if (!dev) return { success: false, error: 'Device not found' };
    if (dev.status !== 'HEALTHY') return { success: false, error: `Device already ${dev.status}` };

    // Set to FAILED
    dev.status = 'FAILED';
    dev.circuitBreaker = 'OPEN';
    dev.failedAt = Date.now();
    dev.successfulProbes = 0;
    dev.recoveredAt = null;

    // Log event
    this._logEvent('device_failed', dev.id, {
      type: dev.type,
      circuitBreaker: 'OPEN',
    });

    // Broadcast SSE
    sseManager.broadcast('device_event', {
      event: 'failed',
      deviceId: dev.id,
      type: dev.type,
      status: 'FAILED',
      circuitBreaker: 'OPEN',
      ts: Date.now(),
    });

    // Start health probes
    this._startProbes(dev);

    // Broadcast full state
    this._broadcastDeviceState();

    return { success: true, deviceId: dev.id, type: dev.type };
  }

  // ── Health probe simulation ───────────────────────────────

  _startProbes(dev) {
    // Clear any existing probe timer
    if (dev._probeTimer) clearInterval(dev._probeTimer);

    dev.nextProbeAt = Date.now() + PROBE_INTERVAL_MS;

    dev._probeTimer = setInterval(() => {
      this._runProbe(dev);
    }, PROBE_INTERVAL_MS);
  }

  _runProbe(dev) {
    if (dev.status === 'HEALTHY') {
      // Already recovered — stop probes
      this._stopProbes(dev);
      return;
    }

    // Simulate probe success (probes always succeed in the simulator)
    dev.successfulProbes++;
    dev.lastProbeAt = Date.now();

    if (dev.successfulProbes === 1) {
      // First successful probe: HALF_OPEN, RECOVERING
      dev.circuitBreaker = 'HALF_OPEN';
      dev.status = 'RECOVERING';
      dev.nextProbeAt = Date.now() + PROBE_INTERVAL_MS;

      this._logEvent('probe_success', dev.id, {
        type: dev.type,
        probeCount: dev.successfulProbes,
        circuitBreaker: 'HALF_OPEN',
        status: 'RECOVERING',
      });

      sseManager.broadcast('device_event', {
        event: 'probe_success',
        deviceId: dev.id,
        type: dev.type,
        probeCount: dev.successfulProbes,
        probesToRecover: PROBES_TO_RECOVER,
        status: 'RECOVERING',
        circuitBreaker: 'HALF_OPEN',
        ts: Date.now(),
      });
    }

    if (dev.successfulProbes >= PROBES_TO_RECOVER) {
      // Fully recovered
      dev.status = 'HEALTHY';
      dev.circuitBreaker = 'CLOSED';
      dev.recoveredAt = Date.now();
      dev.nextProbeAt = null;

      this._stopProbes(dev);

      this._logEvent('device_recovered', dev.id, {
        type: dev.type,
        circuitBreaker: 'CLOSED',
        totalRecoveryMs: dev.recoveredAt - dev.failedAt,
      });

      sseManager.broadcast('device_event', {
        event: 'recovered',
        deviceId: dev.id,
        type: dev.type,
        status: 'HEALTHY',
        circuitBreaker: 'CLOSED',
        totalRecoveryMs: dev.recoveredAt - dev.failedAt,
        ts: Date.now(),
      });
    } else {
      // More probes needed
      this._logEvent('probe_success', dev.id, {
        type: dev.type,
        probeCount: dev.successfulProbes,
        remaining: PROBES_TO_RECOVER - dev.successfulProbes,
      });
    }

    this._broadcastDeviceState();
  }

  _stopProbes(dev) {
    if (dev._probeTimer) {
      clearInterval(dev._probeTimer);
      dev._probeTimer = null;
    }
    dev.nextProbeAt = null;
  }

  // ── Fallback event emission ───────────────────────────────

  _emitFallback(skippedDev, allocatedDev) {
    this._logEvent('fallback', allocatedDev.id, {
      from: { id: skippedDev.id, type: skippedDev.type },
      to: { id: allocatedDev.id, type: allocatedDev.type },
      reason: `${skippedDev.type} ${skippedDev.status}`,
    });

    sseManager.broadcast('fallback', {
      from: { id: skippedDev.id, type: skippedDev.type },
      to: { id: allocatedDev.id, type: allocatedDev.type },
      reason: `${skippedDev.type} ${skippedDev.status}`,
      latencyMultiplier: allocatedDev.latencyMultiplier,
      ts: Date.now(),
    });
  }

  // ── Broadcast & logging ───────────────────────────────────

  _broadcastDeviceState() {
    // Trigger a full state-update via scheduler (import would be circular, so we use a callback)
    if (this._onStateChange) {
      this._onStateChange();
    }
  }

  /** Register a callback for state changes (set by scheduler) */
  onStateChange(cb) {
    this._onStateChange = cb;
  }

  _logEvent(type, deviceId, details) {
    this.eventLog.unshift({
      id: `${type}-${deviceId}-${Date.now()}`,
      type,
      deviceId,
      details,
      ts: Date.now(),
    });
    if (this.eventLog.length > 50) this.eventLog.pop();
  }

  // ── Snapshots ─────────────────────────────────────────────

  getSnapshot() {
    return this.devices.map(d => ({
      id: d.id,
      type: d.type,
      active: d.active,
      maxSlots: d.maxSlots,
      available: d.status === 'HEALTHY' ? d.maxSlots - d.active : 0,
      status: d.status,
      circuitBreaker: d.circuitBreaker,
      latencyMultiplier: d.latencyMultiplier,
      estimatedTokenMs: Math.round(80 * d.latencyMultiplier),
      successfulProbes: d.successfulProbes,
      probesToRecover: PROBES_TO_RECOVER,
      failedAt: d.failedAt,
      recoveredAt: d.recoveredAt,
      lastProbeAt: d.lastProbeAt,
      nextProbeAt: d.nextProbeAt,
    }));
  }

  getEventLog() {
    return this.eventLog.slice(0, 30);
  }
}

export default new DeviceManager();
