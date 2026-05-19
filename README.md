# Sarvam Edge Runtime Prototype

> **IMPORTANT NOTE**
> This prototype focuses on orchestration, scheduling, recovery semantics, and runtime lifecycle simulation rather than full model inference execution.

## Overview
A professional prototype simulating an on-device **Edge Agent Runtime**. This system models a resource-constrained edge environment where multiple Micro-Frontends (MFEs) compete for limited execution slots. It implements a robust hardware fallback layer, circuit breakers, worker crash recovery, and distributed tracing. The dashboard provides real-time visibility into the entire lifecycle of requests, from queuing to hardware allocation and token streaming.

## Features
- **Priority Queueing**: P0 (user requests) and P1 (background tasks) with round-robin fairness across MFEs.
- **Worker Crash Simulation**: Simulates sudden worker deaths, manages a 3000ms recovery lifecycle, and automatically requeues interrupted requests with a priority boost.
- **Hardware Fallback Orchestration**: Simulates NPU, GPU, and CPU devices. Implements a circuit breaker that routes around failed devices and uses 30-second health probes to automatically restore hardware.
- **Observability Dashboard**: Real-time distributed tracing with correlation IDs, time-series metrics (queue depth, active slots, throughput), and latency percentiles.
- **Micro-Frontend Architecture**: Browser shell owns a singleton `EdgeAgentService` that bridges HTTP and SSE. MFEs never interact with the backend directly.

## Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Browser — React Shell (Vite + Tailwind)                               │
│  ┌──────────────┐   ┌────────────────────────────────────────────────┐ │
│  │  App Shell    │──▶│  EdgeAgentService (Singleton)                  │ │
│  └──────────────┘   │  • HTTP POST → /api/request                    │ │
│  ┌──────────┐       │  • HTTP POST → /api/worker/crash               │ │
│  │ Doc Q&A  │──────▶│  • HTTP POST → /api/device/fail                │ │
│  │  (MFE)   │       │  • EventSource ← /api/events/:clientId         │ │
│  ├──────────┤       │  • Parses Traces & Metrics                     │ │
│  │ Meeting  │       └────────────────────────────────────────────────┘ │
│  │  (MFE)   │──────▶  Dashboard Views                                  │
│  └──────────┘        (Scheduler View · Observability View)             │
└────────────────────────────────────────────────────────────────────────┘
                               │ HTTP / SSE
┌────────────────────────────────────────────────────────────────────────┐
│  Backend — Node.js + Express (port 3001)                               │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────────────────┐  │
│  │ POST       │  │  Scheduler   │  │  Token Simulator               │  │
│  │ /api/req   │─▶│  4 slots     │─▶│  80ms ticks, per-MFE vocab     │  │
│  └────────────┘  │  P0 > P1     │  └────────────────────────────────┘  │
│  ┌────────────┐  │  max 2/MFE   │  ┌────────────────────────────────┐  │
│  │ GET SSE    │  │              │  │  Device Manager                │  │
│  │ /api/events│◀─│              │  │  NPU → GPU → CPU               │  │
│  └────────────┘  └──────┬───────┘  │  circuit breaker & probes      │  │
│  ┌────────────┐         │          └────────────────────────────────┘  │
│  │ POST       │  ┌──────▼───────┐  ┌────────────────────────────────┐  │
│  │ /api/worker│─▶│  Supervisor  │  │  Observability                 │  │
│  │ /crash     │  │  crash sim   │  │  Tracer (spans, correlationId) │  │
│  ├────────────┤  │  recovery    │  │  Metrics (2s time-series)      │  │
│  │ POST       │  └──────────────┘  └────────────────────────────────┘  │
│  │ /api/device│─▶ Device failure simulation                            │
│  │ /fail      │                                                        │
│  └────────────┘                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Scheduler Design
The core scheduler maintains strict constraints designed for edge devices:
- **Global limit**: Maximum 4 concurrent active slots.
- **MFE limit**: Maximum 2 concurrent slots per specific MFE to prevent starvation.
- **Priority**: P0 (Interactive/User) requests always preempt P1 (Background/Batch) requests in the queue.
- **Fairness**: Within the same priority tier, requests are dispatched using a round-robin algorithm based on the originating MFE.

## Worker Recovery
The `Supervisor` module acts as an external orchestrator watching the scheduler's slots.
- **State Machine**: `AVAILABLE` → `RUNNING` → `RECOVERING` → `AVAILABLE`
- When a worker crashes, the slot is locked for a 3000ms recovery window.
- The interrupted request is salvaged: its original `request_id` is preserved, its priority is boosted to P0, and it is requeued at the front of the line to be picked up by the next available healthy worker.

## Device Fallback
The `DeviceManager` acts as a hardware registry with a built-in circuit breaker pattern.
- **Fallback Chain**: Allocation attempts `NPU` first, falls back to `GPU` (with a 0.8x latency penalty), and finally to `CPU` (1.0x latency).
- **Failure Simulation**: Devices can be forced into a `FAILED` state (Circuit Breaker: OPEN).
- **Health Probes**: A background loop probes failed devices every 30 seconds.
- **Recovery**: 1 successful probe moves the breaker to `HALF_OPEN` (`RECOVERING`). 2 successful probes move it back to `CLOSED` (`HEALTHY`), restoring the device to the primary allocation pool.

## Observability
An integrated telemetry layer tracks request lifecycles and system health without external dependencies:
- **Distributed Tracing**: Every request acts as a `traceId`. Spans (`queue_wait`, `dispatch`, `inference`) track the exact timing of state transitions.
- **Metrics**: A 2-second sampling loop records time-series data for Queue Depth, Active Slots, and Throughput.
- **Latency Tracking**: Calculates rolling averages and p95/p99 percentiles for queue waiting and inference execution times.
- **Dashboard**: A dedicated React view visualizes this data with custom mini-graphs and a chronological trace log.

## Running Locally

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### 1. Install Dependencies
```bash
# Terminal 1: Backend
cd backend
npm install

# Terminal 2: Frontend
cd frontend
npm install
```

### 2. Start Services
```bash
# Terminal 1: Backend (Runs on http://localhost:3001)
cd backend
npm run dev

# Terminal 2: Frontend (Runs on http://localhost:5173)
cd frontend
npm run dev
```
Navigate to **http://localhost:5173** to view the dashboard.

## Screenshots
*(Provide screenshots of the Scheduler View, Observability View, and Fallback timelines here)*

## Tradeoffs
1. **In-Memory State**: All queues, traces, and metrics are stored in memory. In a real production system, traces would be exported (e.g., OTLP) to a collector, and metrics would be scraped (e.g., Prometheus).
2. **Single Process Backend**: The Node.js backend handles both HTTP routing and the tight 80ms token simulation loop. In a real edge device, inference runs in a separate native process (C++/Rust) or dedicated NPU driver, communicating via IPC.
3. **Synthetic Polling vs WebSockets**: The dashboard uses Server-Sent Events (SSE) for unidirectional flow. While excellent for streaming, bidirectional WebSockets might reduce latency for immediate UI actions like crash triggers.
4. **Custom CSS vs Chart Libraries**: To minimize dependencies and potential security vulnerabilities, the Observability graphs are built with raw HTML/CSS flexbox. This sacrifices advanced zooming/tooltips for absolute lightweight performance.

## Future Work
- **IPC Implementation**: Replace the in-memory function calls between the Scheduler and Token Simulator with actual IPC (e.g., Unix Domain Sockets) to better simulate a multi-process edge OS.
- **Preemption & Eviction**: Implement logic to pause (evict) a running P1 task if a P0 task arrives and all slots are full, saving the context to memory and restoring it later.
- **Security Hardening (npm Supply Chain)**:
  - Transition from `npm install` to `npm ci --ignore-scripts` in build pipelines to prevent malicious `postinstall` hooks (a primary attack vector in 2025/2026).
  - Configure `.npmrc` with `min-release-age=3` to avoid zero-day malware packages.
  - Remove all Git-based dependencies (`allow-git=none`) to enforce registry-level scanning.
=======

