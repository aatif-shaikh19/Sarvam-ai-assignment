// metrics.js — In-memory time-series metrics collector.
// Samples queue depth, slot usage, and throughput every 2 seconds.
// Records latency distributions for queue wait and inference.

class MetricsCollector {
  constructor() {
    /** Time-series data (sampled every 2s, last 60 samples = 2 minutes) */
    this.timeSeries = {
      queueDepth: [],     // { ts, value }
      activeSlots: [],
      throughput: [],     // completed requests per 2s window
    };

    /** Running counters */
    this.counters = {
      totalRequests: 0,
      completedRequests: 0,
      crashes: 0,
      retries: 0,
      fallbacks: 0,
      tokensGenerated: 0,
    };

    /** Latency measurements (last 100 each) */
    this.latencies = {
      queueWait: [],
      inference: [],
      total: [],
    };

    /** Throughput tracking */
    this._completedInWindow = 0;

    /** Scheduler reference — set externally */
    this._scheduler = null;

    /** Boot time */
    this.startedAt = Date.now();

    // Start sampling loop
    this._sampleInterval = setInterval(() => this._sample(), 2000);
  }

  /** Register the scheduler so we can sample its state */
  setScheduler(scheduler) {
    this._scheduler = scheduler;
  }

  /** Sample current state into time-series */
  _sample() {
    const now = Date.now();

    if (this._scheduler) {
      this.timeSeries.queueDepth.push({
        ts: now,
        value: this._scheduler.queue.length,
      });
      this.timeSeries.activeSlots.push({
        ts: now,
        value: this._scheduler.active.size,
      });
    }

    this.timeSeries.throughput.push({
      ts: now,
      value: this._completedInWindow,
    });
    this._completedInWindow = 0;

    // Keep last 60 samples (2 minutes)
    const MAX = 60;
    for (const key of Object.keys(this.timeSeries)) {
      if (this.timeSeries[key].length > MAX) {
        this.timeSeries[key] = this.timeSeries[key].slice(-MAX);
      }
    }
  }

  /** Record a latency measurement */
  recordLatency(type, ms) {
    if (!this.latencies[type]) return;
    this.latencies[type].push(Math.round(ms));
    if (this.latencies[type].length > 100) {
      this.latencies[type] = this.latencies[type].slice(-100);
    }
  }

  /** Increment a named counter */
  incrementCounter(name) {
    if (this.counters[name] !== undefined) {
      this.counters[name]++;
    }
    if (name === 'completedRequests') {
      this._completedInWindow++;
    }
  }

  /** Add to a named counter (e.g. tokensGenerated) */
  addToCounter(name, amount) {
    if (this.counters[name] !== undefined) {
      this.counters[name] += amount;
    }
  }

  /** Get full metrics snapshot */
  getSnapshot() {
    return {
      counters: { ...this.counters },
      timeSeries: {
        queueDepth: this.timeSeries.queueDepth.slice(-30),
        activeSlots: this.timeSeries.activeSlots.slice(-30),
        throughput: this.timeSeries.throughput.slice(-30),
      },
      latency: {
        avgQueueWait: _avg(this.latencies.queueWait),
        avgInference: _avg(this.latencies.inference),
        avgTotal: _avg(this.latencies.total),
        p95QueueWait: _percentile(this.latencies.queueWait, 95),
        p95Inference: _percentile(this.latencies.inference, 95),
        p99Total: _percentile(this.latencies.total, 99),
        recentQueueWait: this.latencies.queueWait.slice(-20),
        recentInference: this.latencies.inference.slice(-20),
      },
      uptimeMs: Date.now() - this.startedAt,
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────

function _avg(arr) {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function _percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export default new MetricsCollector();
