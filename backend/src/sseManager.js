// sseManager.js — SSE connection registry and broadcast

class SSEManager {
  constructor() {
    /** @type {Map<string, import('express').Response>} */
    this.clients = new Map();
    // Heartbeat every 15s to keep connections alive
    setInterval(() => {
      this.broadcast('heartbeat', { ts: Date.now() });
    }, 15_000);
  }

  /** Register a new SSE client */
  register(clientId, res) {
    // Close previous connection if exists
    if (this.clients.has(clientId)) {
      try { this.clients.get(clientId).end(); } catch (_) { /* ignore */ }
    }
    this.clients.set(clientId, res);
  }

  /** Remove a client on disconnect */
  unregister(clientId) {
    this.clients.delete(clientId);
  }

  /** Send event to a specific client */
  send(clientId, event, data) {
    const res = this.clients.get(clientId);
    if (!res) return;
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (_) {
      this.clients.delete(clientId);
    }
  }

  /** Broadcast event to ALL connected clients */
  broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, res] of this.clients) {
      try {
        res.write(payload);
      } catch (_) {
        this.clients.delete(id);
      }
    }
  }

  get connectedCount() {
    return this.clients.size;
  }
}

export default new SSEManager();
