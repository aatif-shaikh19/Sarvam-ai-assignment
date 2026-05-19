// supervisor.js — Supervisor process simulator
// Manages worker lifecycle: AVAILABLE → RUNNING → RECOVERING → AVAILABLE
// Orchestrates crash simulation and recovery with request retry.

import scheduler from './scheduler.js';
import tokenSimulator from './tokenSimulator.js';
import deviceManager from './deviceManager.js';
import sseManager from './sseManager.js';

const RECOVERY_DELAY_MS = 3000; // Time a slot stays in RECOVERING state

class Supervisor {
  constructor() {
    /** 4 worker entries tracking state */
    this.workers = Array.from({ length: 4 }, (_, i) => ({
      slotIndex: i,
      state: 'AVAILABLE',   // AVAILABLE | RUNNING | RECOVERING | DEAD
      lastCrashAt: null,
      recoverAt: null,
      crashCount: 0,
      _recoveryTimer: null,
    }));

    /** Event log for the recovery timeline (last 50 entries) */
    this.eventLog = [];

    // Register this supervisor with the scheduler so it can sync state
    scheduler.supervisor = this;
  }

  // ── Lifecycle callbacks (called by scheduler) ──────────────

  /** Called by scheduler when a request is dispatched to a slot */
  onDispatch(slotIndex) {
    if (slotIndex >= 0 && slotIndex < this.workers.length) {
      this.workers[slotIndex].state = 'RUNNING';
    }
  }

  /** Called by scheduler when a request completes on a slot */
  onComplete(slotIndex) {
    if (slotIndex >= 0 && slotIndex < this.workers.length) {
      // Only set to AVAILABLE if not currently RECOVERING (crash during completion race)
      if (this.workers[slotIndex].state !== 'RECOVERING') {
        this.workers[slotIndex].state = 'AVAILABLE';
      }
    }
  }

  // ── Crash simulation ──────────────────────────────────────

  /**
   * Crash a worker at a specific slot index.
   * Cancels token generation, releases device, requeues request, starts recovery timer.
   * @param {number} slotIndex — 0-3
   * @returns {{ success: boolean, error?: string, requestId?: string }}
   */
  crashWorker(slotIndex) {
    if (slotIndex < 0 || slotIndex >= this.workers.length) {
      return { success: false, error: 'Invalid slot index' };
    }

    const worker = this.workers[slotIndex];

    if (worker.state !== 'RUNNING') {
      return { success: false, error: `Worker ${slotIndex} is not RUNNING (current: ${worker.state})` };
    }

    // Find the request in this slot
    const requestId = scheduler.slotAssignment[slotIndex];
    if (!requestId) {
      return { success: false, error: 'No request assigned to this slot' };
    }

    // 1. Cancel token generation
    tokenSimulator.cancel(requestId);

    // 2. Remove request from active (frees MFE slot count, clears slotAssignment)
    const request = scheduler.removeFromActive(requestId);
    if (!request) {
      return { success: false, error: 'Request not found in active set' };
    }

    // 3. Release device
    if (request.device) {
      deviceManager.release(request.device.id);
    }

    // 4. Set worker to RECOVERING
    worker.state = 'RECOVERING';
    worker.lastCrashAt = Date.now();
    worker.recoverAt = Date.now() + RECOVERY_DELAY_MS;
    worker.crashCount++;

    // 5. Mark slot as recovering in scheduler (blocks dispatch to this slot)
    scheduler.recoveringSlots.add(slotIndex);

    // 6. Requeue the request with preserved request_id, boosted to P0
    scheduler.requeue(request);

    // 7. Log event
    this._logEvent('crash', slotIndex, requestId);

    // 8. Broadcast dedicated SSE events
    sseManager.broadcast('worker_recovering', {
      slotIndex,
      requestId,
      retryAfterMs: RECOVERY_DELAY_MS,
      ts: Date.now(),
    });

    sseManager.broadcast('retry_after_ms', {
      slotIndex,
      requestId,
      retryAfterMs: RECOVERY_DELAY_MS,
      ts: Date.now(),
    });

    // 9. Broadcast full state update
    scheduler._broadcastState();

    // 10. Schedule recovery
    worker._recoveryTimer = setTimeout(() => {
      this._recoverWorker(slotIndex, requestId);
    }, RECOVERY_DELAY_MS);

    return { success: true, requestId };
  }

  /** Internal: recover a worker after the delay */
  _recoverWorker(slotIndex, originalRequestId) {
    const worker = this.workers[slotIndex];

    // Restore to AVAILABLE
    worker.state = 'AVAILABLE';
    worker.recoverAt = null;
    worker._recoveryTimer = null;

    // Remove from recovering set
    scheduler.recoveringSlots.delete(slotIndex);

    // Log event
    this._logEvent('recovered', slotIndex, originalRequestId);

    // Broadcast dedicated SSE event
    sseManager.broadcast('slot_available', {
      slotIndex,
      ts: Date.now(),
    });

    // Broadcast full state update and try to dispatch pending requests
    scheduler._broadcastState();
    scheduler.tryDispatch();
  }

  // ── Event log ─────────────────────────────────────────────

  _logEvent(type, slotIndex, requestId) {
    this.eventLog.unshift({
      id: `${type}-${slotIndex}-${Date.now()}`,
      type,       // 'crash' | 'recovered'
      slotIndex,
      requestId,
      ts: Date.now(),
    });
    if (this.eventLog.length > 50) this.eventLog.pop();
  }

  // ── Snapshot ──────────────────────────────────────────────

  getSnapshot() {
    return {
      workers: this.workers.map(w => ({
        slotIndex: w.slotIndex,
        state: w.state,
        lastCrashAt: w.lastCrashAt,
        recoverAt: w.recoverAt,
        crashCount: w.crashCount,
      })),
      recoveryLog: this.eventLog.slice(0, 30),
    };
  }
}

export default new Supervisor();
