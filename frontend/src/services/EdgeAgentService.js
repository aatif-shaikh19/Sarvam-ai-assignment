// EdgeAgentService.js — Singleton service: HTTP + SSE bridge
// Shell-owned. MFEs never call localhost directly.
// Extended with worker states, recovery log, crash control, and device health.

import { v4 as uuidv4 } from 'uuid';

class EdgeAgentService {
  constructor() {
    this.clientId = uuidv4();
    this.eventSource = null;
    this.listeners = new Map();
    this.connected = false;

    // Reactive state
    this.state = {
      queue: [],
      active: [],
      history: [],
      slots: { total: 4, used: 0, recovering: 0, available: 4, perMfe: {}, maxPerMfe: 2, assignment: [null, null, null, null] },
      devices: [],
      tokens: {},         // requestId -> { tokens: [], progress: 0, totalTokens: 0, complete: false, fullText: '' }
      workerStates: [],   // 4 entries: { slotIndex, state, lastCrashAt, recoverAt, crashCount }
      recoveryLog: [],    // crash/recovery event log
      deviceEvents: [],   // device fallback/failure/recovery event log
      observability: { traces: [], metrics: { counters: {}, timeSeries: {}, latency: {} } },
    };
  }

  /** Connect to the SSE endpoint */
  connect() {
    if (this.eventSource) return;

    this.eventSource = new EventSource(`/api/events/${this.clientId}`);

    // ── Full state update ────────────────────────────────────
    this.eventSource.addEventListener('state-update', (e) => {
      const data = JSON.parse(e.data);
      this.state.queue = data.queue || [];
      this.state.active = data.active || [];
      this.state.history = data.history || [];
      this.state.slots = data.slots || this.state.slots;
      this.state.devices = data.devices || [];
      this.state.workerStates = data.workerStates || [];
      this.state.recoveryLog = data.recoveryLog || [];
      this.state.deviceEvents = data.deviceEvents || [];
      this.state.observability = data.observability || this.state.observability;
      this._emit('state-update', this.state);
    });

    // ── Token events ─────────────────────────────────────────
    this.eventSource.addEventListener('token', (e) => {
      const data = JSON.parse(e.data);
      const { requestId, type, token, index, totalTokens, progress, fullText } = data;

      if (!this.state.tokens[requestId]) {
        this.state.tokens[requestId] = {
          mfeId: data.mfeId,
          tokens: [],
          progress: 0,
          totalTokens: 0,
          complete: false,
          fullText: '',
        };
      }

      const entry = this.state.tokens[requestId];

      if (type === 'token') {
        entry.tokens.push(token);
        entry.progress = progress;
        entry.totalTokens = totalTokens;
      } else if (type === 'complete') {
        entry.complete = true;
        entry.fullText = fullText;
        entry.progress = 100;
        entry.totalTokens = totalTokens;
      }

      this._emit('token', { requestId, ...entry });
      this._emit('state-update', this.state);
    });

    // ── Worker recovery events ───────────────────────────────
    this.eventSource.addEventListener('worker_recovering', (e) => {
      const data = JSON.parse(e.data);
      this._emit('worker_recovering', data);
    });

    this.eventSource.addEventListener('retry_after_ms', (e) => {
      const data = JSON.parse(e.data);
      this._emit('retry_after_ms', data);
    });

    this.eventSource.addEventListener('slot_available', (e) => {
      const data = JSON.parse(e.data);
      this._emit('slot_available', data);
    });

    // ── Device health events ─────────────────────────────────
    this.eventSource.addEventListener('device_event', (e) => {
      const data = JSON.parse(e.data);
      this._emit('device_event', data);
    });

    this.eventSource.addEventListener('fallback', (e) => {
      const data = JSON.parse(e.data);
      this._emit('fallback', data);
    });

    this.eventSource.addEventListener('latency_est_ms', (e) => {
      const data = JSON.parse(e.data);
      this._emit('latency_est_ms', data);
    });

    // ── Connection lifecycle ─────────────────────────────────
    this.eventSource.addEventListener('heartbeat', () => {
      this.connected = true;
    });

    this.eventSource.onopen = () => {
      this.connected = true;
      this._emit('connected', true);
    };

    this.eventSource.onerror = () => {
      this.connected = false;
      this._emit('connected', false);
    };
  }

  /** Disconnect SSE */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.connected = false;
    }
  }

  /**
   * Submit a request via the shell-owned service
   * MFEs call this instead of hitting localhost directly
   */
  async submitRequest({ mfeId, priority, prompt }) {
    const res = await fetch('/api/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfeId,
        priority,
        prompt,
        clientId: this.clientId,
      }),
    });
    return res.json();
  }

  /**
   * Crash a worker slot (triggers supervisor crash simulation)
   * @param {number} slotIndex — 0-3
   */
  async crashWorker(slotIndex) {
    const res = await fetch('/api/worker/crash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotIndex }),
    });
    return res.json();
  }

  /**
   * Trigger a device failure (e.g. NPU failure)
   * @param {string} deviceId — e.g. 'npu-0'
   */
  async failDevice(deviceId) {
    const res = await fetch('/api/device/fail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    return res.json();
  }

  /** Subscribe to events */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  /** Emit event to listeners */
  _emit(event, data) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) {
        try { cb(data); } catch (_) { /* ignore */ }
      }
    }
  }

  /** Get current state snapshot */
  getState() {
    return { ...this.state };
  }
}

// Singleton instance
const edgeAgentService = new EdgeAgentService();
export default edgeAgentService;
