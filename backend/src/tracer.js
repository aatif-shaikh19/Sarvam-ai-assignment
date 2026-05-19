// tracer.js — Distributed tracing with correlation IDs and span tracking.
// Each request gets a traceId (= requestId) and lifecycle spans.
// Follows W3C Trace Context semantics conceptually.

class Tracer {
  constructor() {
    /** @type {Map<string, object>} traceId → trace object */
    this.traces = new Map();
    this.MAX_TRACES = 100;
  }

  /**
   * Create a new trace for a request.
   * Uses requestId as the traceId for easy correlation.
   * @param {string} requestId
   * @param {object} metadata — { mfeId, priority, clientId }
   * @returns {string} traceId
   */
  createTrace(requestId, metadata = {}) {
    const trace = {
      traceId: requestId,
      requestId,
      metadata,
      spans: [],
      createdAt: Date.now(),
      completedAt: null,
      status: 'active', // active | completed | crashed
    };

    this.traces.set(requestId, trace);

    // Evict oldest if over limit
    if (this.traces.size > this.MAX_TRACES) {
      const oldest = this.traces.keys().next().value;
      this.traces.delete(oldest);
    }

    return requestId;
  }

  /**
   * Start a named span within a trace.
   * @param {string} traceId
   * @param {string} name — e.g. 'queue_wait', 'dispatch', 'inference'
   * @param {object} attrs — optional span attributes
   */
  startSpan(traceId, name, attrs = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.spans.push({
      name,
      startedAt: Date.now(),
      endedAt: null,
      durationMs: null,
      attrs,
    });
  }

  /**
   * End the most recent open span with the given name.
   * @param {string} traceId
   * @param {string} name
   * @param {object} attrs — additional attributes to merge
   */
  endSpan(traceId, name, attrs = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    // Find the most recent open span with this name
    for (let i = trace.spans.length - 1; i >= 0; i--) {
      const span = trace.spans[i];
      if (span.name === name && span.endedAt === null) {
        span.endedAt = Date.now();
        span.durationMs = span.endedAt - span.startedAt;
        span.attrs = { ...span.attrs, ...attrs };
        return;
      }
    }
  }

  /**
   * Mark a trace as completed or crashed.
   * @param {string} traceId
   * @param {'completed'|'crashed'} status
   */
  finishTrace(traceId, status = 'completed') {
    const trace = this.traces.get(traceId);
    if (!trace) return;
    trace.completedAt = Date.now();
    trace.status = status;
  }

  /**
   * Get a specific trace.
   * @param {string} traceId
   */
  getTrace(traceId) {
    return this.traces.get(traceId) || null;
  }

  /**
   * Get recent traces for the dashboard (newest first).
   * @param {number} limit
   */
  getRecentTraces(limit = 20) {
    return Array.from(this.traces.values())
      .slice(-limit)
      .reverse()
      .map(t => ({
        traceId: t.traceId,
        requestId: t.requestId,
        metadata: t.metadata,
        spans: t.spans.map(s => ({ ...s })),
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        status: t.status,
        totalDurationMs: t.completedAt
          ? t.completedAt - t.createdAt
          : Date.now() - t.createdAt,
      }));
  }
}

export default new Tracer();
