// scheduler.js — Priority queue with round-robin fairness and slot management
// Extended with slot tracking, crash recovery, tracing, and metrics.

import { v4 as uuidv4 } from 'uuid';
import deviceManager from './deviceManager.js';
import tokenSimulator from './tokenSimulator.js';
import sseManager from './sseManager.js';
import tracer from './tracer.js';
import metrics from './metrics.js';

const MAX_GLOBAL_SLOTS = 4;
const MAX_PER_MFE_SLOTS = 2;

class Scheduler {
  constructor() {
    /** @type {Array<object>} pending requests sorted by priority + arrival */
    this.queue = [];
    /** @type {Map<string, object>} active requests by id */
    this.active = new Map();
    /** @type {Map<string, number>} active slot count per MFE */
    this.mfeSlotCount = new Map();
    /** @type {Array<object>} completed request history (last 50) */
    this.history = [];
    /** round-robin state: last dispatched MFE id */
    this.lastDispatchedMfe = null;

    // ── Slot tracking (crash/recovery) ──────────────────────
    /** Maps slotIndex (0-3) to requestId or null */
    this.slotAssignment = new Array(MAX_GLOBAL_SLOTS).fill(null);
    /** Set of slot indices currently in RECOVERING state */
    this.recoveringSlots = new Set();
    /** Supervisor reference — set by supervisor.js on init */
    this.supervisor = null;

    // Wire up device manager state-change callback for health probe broadcasts
    deviceManager.onStateChange(() => this._broadcastState());

    // Register this scheduler with the metrics collector
    metrics.setScheduler(this);
  }

  /**
   * Enqueue a new request
   * @param {{ mfeId: string, priority: number, prompt: string, clientId: string }} params
   * @returns {{ requestId: string, queuePosition: number }}
   */
  enqueue({ mfeId, priority, prompt, clientId }) {
    const request = {
      id: uuidv4(),
      mfeId,
      priority: priority ?? 1,   // 0 = P0 user, 1 = P1 background
      prompt,
      clientId,
      state: 'queued',
      device: null,
      slotIndex: -1,
      enqueuedAt: Date.now(),
      dispatchedAt: null,
      completedAt: null,
      tokenCount: 0,
      totalTokens: 0,
    };

    // ── Tracing: create trace + start queue_wait span ────────
    tracer.createTrace(request.id, { mfeId, priority, clientId });
    tracer.startSpan(request.id, 'queue_wait');

    // ── Metrics: increment total requests ────────────────────
    metrics.incrementCounter('totalRequests');

    this.queue.push(request);
    this._sortQueue();

    const position = this.queue.indexOf(request) + 1;

    // Broadcast updated queue
    this._broadcastState();

    // Try to dispatch immediately
    this.tryDispatch();

    return { requestId: request.id, queuePosition: position };
  }

  /**
   * Requeue an interrupted request (preserves original request_id).
   * Used by the supervisor after a worker crash. Priority is boosted to P0.
   * @param {object} request — the original request object
   */
  requeue(request) {
    request.state = 'queued';
    request.priority = 0;          // Boost to P0 for immediate re-dispatch
    request.device = null;
    request.slotIndex = -1;
    request.dispatchedAt = null;
    request.completedAt = null;
    // Preserve: id, mfeId, prompt, clientId, enqueuedAt

    // ── Tracing: start new queue_wait span for retry ─────────
    tracer.startSpan(request.id, 'queue_wait', { retry: true });

    // ── Metrics: count retry ─────────────────────────────────
    metrics.incrementCounter('retries');

    this.queue.push(request);
    this._sortQueue();
    // Note: state broadcast and tryDispatch are called by supervisor after recovery
  }

  /**
   * Remove a request from the active set and free its slot/MFE count.
   * Used by the supervisor during a crash. Does NOT release the device (supervisor handles that).
   * @param {string} requestId
   * @returns {object|null} the removed request, or null
   */
  removeFromActive(requestId) {
    const request = this.active.get(requestId);
    if (!request) return null;

    // Free the active slot
    this.active.delete(requestId);

    // Decrement MFE slot count
    const mfeCount = this.mfeSlotCount.get(request.mfeId) || 1;
    this.mfeSlotCount.set(request.mfeId, Math.max(0, mfeCount - 1));

    // Clear slot assignment
    if (request.slotIndex >= 0) {
      this.slotAssignment[request.slotIndex] = null;
    }

    // ── Tracing: end inference span, mark trace as crashed ───
    tracer.endSpan(requestId, 'inference', { crashed: true });
    tracer.finishTrace(requestId, 'crashed');

    // ── Metrics: count crash ─────────────────────────────────
    metrics.incrementCounter('crashes');

    return request;
  }

  /** Sort queue: P0 before P1, within same priority apply round-robin fairness */
  _sortQueue() {
    this.queue.sort((a, b) => {
      // Primary: priority (lower = higher priority)
      if (a.priority !== b.priority) return a.priority - b.priority;
      // Secondary: arrival time
      return a.enqueuedAt - b.enqueuedAt;
    });
  }

  /** Find the first available slot index (not occupied, not recovering) */
  _findAvailableSlot() {
    for (let i = 0; i < MAX_GLOBAL_SLOTS; i++) {
      if (this.slotAssignment[i] === null && !this.recoveringSlots.has(i)) {
        return i;
      }
    }
    return -1;
  }

  /** Try to dispatch queued requests into available slots */
  tryDispatch() {
    let dispatched = true;

    while (dispatched) {
      dispatched = false;

      // Effective available = total - recovering - active
      const effectiveMax = MAX_GLOBAL_SLOTS - this.recoveringSlots.size;
      if (this.active.size >= effectiveMax) break;
      if (this.queue.length === 0) break;

      // Check if there's a physical slot available
      const availableSlot = this._findAvailableSlot();
      if (availableSlot === -1) break;

      // Apply round-robin fairness: find next eligible request
      const candidate = this._pickNextCandidate();
      if (!candidate) break;

      // Check per-MFE slot limit
      const mfeCount = this.mfeSlotCount.get(candidate.mfeId) || 0;
      if (mfeCount >= MAX_PER_MFE_SLOTS) {
        // Try to find a candidate from a different MFE
        const altCandidate = this._pickNextCandidate(candidate.mfeId);
        if (altCandidate) {
          this._dispatch(altCandidate);
          dispatched = true;
        }
        break;
      }

      this._dispatch(candidate);
      dispatched = true;
    }
  }

  /**
   * Pick the next candidate from the queue, optionally skipping a specific MFE.
   * Implements round-robin by preferring an MFE different from lastDispatchedMfe.
   */
  _pickNextCandidate(skipMfeId = null) {
    // First pass: try to find a request from a different MFE than lastDispatched (round-robin)
    for (let i = 0; i < this.queue.length; i++) {
      const req = this.queue[i];
      if (skipMfeId && req.mfeId === skipMfeId) continue;
      const mfeCount = this.mfeSlotCount.get(req.mfeId) || 0;
      if (mfeCount >= MAX_PER_MFE_SLOTS) continue;
      if (req.mfeId !== this.lastDispatchedMfe) {
        return req;
      }
    }

    // Second pass: take any eligible request (same MFE is fine)
    for (let i = 0; i < this.queue.length; i++) {
      const req = this.queue[i];
      if (skipMfeId && req.mfeId === skipMfeId) continue;
      const mfeCount = this.mfeSlotCount.get(req.mfeId) || 0;
      if (mfeCount >= MAX_PER_MFE_SLOTS) continue;
      return req;
    }

    return null;
  }

  /** Dispatch a request: remove from queue, allocate device, assign slot, start simulation */
  _dispatch(request) {
    // Remove from queue
    this.queue = this.queue.filter(r => r.id !== request.id);

    // Find available slot
    const slotIndex = this._findAvailableSlot();
    if (slotIndex === -1) {
      // Should not happen, but safety: put back in queue
      this.queue.push(request);
      this._sortQueue();
      return;
    }

    // ── Tracing: end queue_wait, start dispatch + inference ──
    tracer.endSpan(request.id, 'queue_wait');
    tracer.startSpan(request.id, 'dispatch', { slotIndex });

    // Allocate device
    const device = deviceManager.allocate();
    request.device = device;
    request.state = 'active';
    request.slotIndex = slotIndex;
    request.dispatchedAt = Date.now();

    // ── Tracing: end dispatch (instant), start inference ─────
    tracer.endSpan(request.id, 'dispatch', {
      deviceId: device?.id,
      deviceType: device?.type,
    });
    tracer.startSpan(request.id, 'inference', {
      device: device?.type,
      slotIndex,
    });

    // ── Metrics: record queue wait latency ───────────────────
    const queueWaitMs = request.dispatchedAt - request.enqueuedAt;
    metrics.recordLatency('queueWait', queueWaitMs);

    // Track slots
    this.active.set(request.id, request);
    this.slotAssignment[slotIndex] = request.id;
    this.mfeSlotCount.set(request.mfeId, (this.mfeSlotCount.get(request.mfeId) || 0) + 1);
    this.lastDispatchedMfe = request.mfeId;

    // Notify supervisor
    if (this.supervisor) {
      this.supervisor.onDispatch(slotIndex);
    }

    // Broadcast dispatch event
    this._broadcastState();

    // Start token simulation
    tokenSimulator.start(request, (requestId) => this._onComplete(requestId));
  }

  /** Handle completion of a request */
  _onComplete(requestId) {
    const request = this.active.get(requestId);
    if (!request) return;

    const slotIndex = request.slotIndex;

    // Release device
    if (request.device) {
      deviceManager.release(request.device.id);
    }

    // Update state
    request.state = 'completed';
    request.completedAt = Date.now();

    // ── Tracing: end inference span, finish trace ────────────
    tracer.endSpan(requestId, 'inference', {
      tokenCount: request.tokenCount,
      totalTokens: request.totalTokens,
    });
    tracer.finishTrace(requestId, 'completed');

    // ── Metrics: record latencies + increment completed ──────
    const inferenceMs = request.completedAt - request.dispatchedAt;
    const totalMs = request.completedAt - request.enqueuedAt;
    metrics.recordLatency('inference', inferenceMs);
    metrics.recordLatency('total', totalMs);
    metrics.incrementCounter('completedRequests');

    // Free slot
    this.active.delete(requestId);
    if (slotIndex >= 0) {
      this.slotAssignment[slotIndex] = null;
    }
    const mfeCount = this.mfeSlotCount.get(request.mfeId) || 1;
    this.mfeSlotCount.set(request.mfeId, Math.max(0, mfeCount - 1));

    // Notify supervisor
    if (this.supervisor) {
      this.supervisor.onComplete(slotIndex);
    }

    // Add to history
    this.history.unshift(request);
    if (this.history.length > 50) this.history.pop();

    // Broadcast and try to dispatch next
    this._broadcastState();
    this.tryDispatch();
  }

  /** Broadcast full state to all connected clients */
  _broadcastState() {
    const snapshot = this.getSnapshot();
    sseManager.broadcast('state-update', snapshot);
  }

  /** Get full scheduler state snapshot */
  getSnapshot() {
    const activeList = Array.from(this.active.values()).map(r => ({
      id: r.id,
      mfeId: r.mfeId,
      priority: r.priority,
      state: r.state,
      device: r.device,
      slotIndex: r.slotIndex,
      prompt: r.prompt?.substring(0, 80),
      enqueuedAt: r.enqueuedAt,
      dispatchedAt: r.dispatchedAt,
      clientId: r.clientId,
    }));

    const queueList = this.queue.map((r, i) => ({
      id: r.id,
      mfeId: r.mfeId,
      priority: r.priority,
      state: r.state,
      position: i + 1,
      prompt: r.prompt?.substring(0, 80),
      enqueuedAt: r.enqueuedAt,
      clientId: r.clientId,
    }));

    // Get supervisor data if available
    const supervisorData = this.supervisor
      ? this.supervisor.getSnapshot()
      : { workers: [], recoveryLog: [] };

    return {
      queue: queueList,
      active: activeList,
      history: this.history.slice(0, 20).map(r => ({
        id: r.id,
        mfeId: r.mfeId,
        priority: r.priority,
        state: r.state,
        device: r.device,
        slotIndex: r.slotIndex,
        enqueuedAt: r.enqueuedAt,
        dispatchedAt: r.dispatchedAt,
        completedAt: r.completedAt,
      })),
      slots: {
        total: MAX_GLOBAL_SLOTS,
        used: this.active.size,
        recovering: this.recoveringSlots.size,
        available: MAX_GLOBAL_SLOTS - this.active.size - this.recoveringSlots.size,
        perMfe: Object.fromEntries(this.mfeSlotCount),
        maxPerMfe: MAX_PER_MFE_SLOTS,
        assignment: [...this.slotAssignment],
      },
      devices: deviceManager.getSnapshot(),
      deviceEvents: deviceManager.getEventLog(),
      workerStates: supervisorData.workers,
      recoveryLog: supervisorData.recoveryLog,
      observability: {
        traces: tracer.getRecentTraces(15),
        metrics: metrics.getSnapshot(),
      },
      ts: Date.now(),
    };
  }
}

export default new Scheduler();
