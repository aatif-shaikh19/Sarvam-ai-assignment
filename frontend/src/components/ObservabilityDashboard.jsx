// ObservabilityDashboard.jsx — Traces, Metrics, Queue Graphs, and Correlation IDs

import { useState } from 'react';

function formatDuration(ms) {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function TraceView({ trace }) {
  const isCrashed = trace.status === 'crashed';
  const total = trace.totalDurationMs || 0;

  return (
    <div className={`p-3 border rounded-lg mb-2 ${isCrashed ? 'bg-red-50 border-red-200' : 'bg-white border-surface-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isCrashed ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="text-xs font-mono font-medium text-zinc-700">
            {trace.traceId.split('-')[0]}...
          </span>
          <span className="badge bg-surface-100 text-zinc-600 border-surface-200">
            {trace.metadata?.mfeId || 'unknown'}
          </span>
          <span className={`badge ${trace.metadata?.priority === 0 ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
            P{trace.metadata?.priority}
          </span>
        </div>
        <div className="text-xs font-mono text-zinc-500">
          Total: {formatDuration(total)}
        </div>
      </div>

      {/* Spans */}
      <div className="space-y-1.5 mt-3 pl-4 border-l-2 border-surface-100">
        {trace.spans.map((span, i) => (
          <div key={i} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className={`font-mono ${span.name === 'inference' ? 'text-violet-600' : span.name === 'queue_wait' ? 'text-amber-600' : 'text-zinc-600'}`}>
                {span.name}
              </span>
              {span.attrs && Object.keys(span.attrs).length > 0 && (
                <span className="text-zinc-400 font-mono truncate max-w-[200px]">
                  {JSON.stringify(span.attrs)}
                </span>
              )}
            </div>
            <span className="font-mono text-zinc-500">
              {formatDuration(span.durationMs)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniGraph({ data, colorClass, maxVal, label }) {
  if (!data || data.length === 0) return <div className="h-16 flex items-end justify-center text-xs text-zinc-400 pb-2">No data</div>;
  
  const max = Math.max(...data.map(d => d.value), maxVal || 1);
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
        <span>{label}</span>
        <span>max: {max}</span>
      </div>
      <div className="flex-1 flex items-end gap-[1px] h-16">
        {data.map((d, i) => {
          const heightPct = Math.max(5, (d.value / max) * 100);
          return (
            <div
              key={i}
              className={`flex-1 rounded-t-sm ${colorClass}`}
              style={{ height: `${heightPct}%` }}
              title={`${d.value} at ${new Date(d.ts).toLocaleTimeString()}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function ObservabilityDashboard({ observability }) {
  const traces = observability?.traces || [];
  const metrics = observability?.metrics || { counters: {}, timeSeries: {}, latency: {} };
  
  return (
    <div className="grid grid-cols-12 gap-4 h-full">
      
      {/* Left Col: Metrics & Graphs */}
      <div className="col-span-5 flex flex-col gap-4 overflow-auto">
        
        {/* Counters */}
        <div className="grid grid-cols-2 gap-3">
          <div className="panel p-4 flex flex-col">
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Total Requests</span>
            <span className="text-3xl font-light text-zinc-800 mt-1">{metrics.counters.totalRequests || 0}</span>
          </div>
          <div className="panel p-4 flex flex-col">
            <span className="text-xs text-emerald-600 uppercase tracking-wider font-semibold">Completed</span>
            <span className="text-3xl font-light text-emerald-700 mt-1">{metrics.counters.completedRequests || 0}</span>
          </div>
          <div className="panel p-4 flex flex-col">
            <span className="text-xs text-amber-600 uppercase tracking-wider font-semibold">Retries</span>
            <span className="text-3xl font-light text-amber-700 mt-1">{metrics.counters.retries || 0}</span>
          </div>
          <div className="panel p-4 flex flex-col">
            <span className="text-xs text-red-600 uppercase tracking-wider font-semibold">Crashes</span>
            <span className="text-3xl font-light text-red-700 mt-1">{metrics.counters.crashes || 0}</span>
          </div>
        </div>

        {/* Latency Stats */}
        <div className="panel p-4">
          <h3 className="text-sm font-semibold text-zinc-800 mb-3">Latency (ms)</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>Queue Wait</span>
                <span className="font-mono text-[10px]">avg: {metrics.latency.avgQueueWait || 0} | p95: {metrics.latency.p95QueueWait || 0}</span>
              </div>
              <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${Math.min(100, (metrics.latency.avgQueueWait || 0) / 10)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>Inference</span>
                <span className="font-mono text-[10px]">avg: {metrics.latency.avgInference || 0} | p95: {metrics.latency.p95Inference || 0}</span>
              </div>
              <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500" style={{ width: `${Math.min(100, (metrics.latency.avgInference || 0) / 10)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Time-Series Graphs */}
        <div className="panel p-4 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-zinc-800">Time-Series</h3>
          <div className="h-24">
            <MiniGraph 
              data={metrics.timeSeries.queueDepth} 
              colorClass="bg-blue-400" 
              label="Queue Depth" 
            />
          </div>
          <div className="h-24">
            <MiniGraph 
              data={metrics.timeSeries.activeSlots} 
              colorClass="bg-emerald-400" 
              maxVal={4}
              label="Active Slots" 
            />
          </div>
          <div className="h-24">
            <MiniGraph 
              data={metrics.timeSeries.throughput} 
              colorClass="bg-violet-400" 
              label="Throughput (req/2s)" 
            />
          </div>
        </div>

      </div>

      {/* Right Col: Traces */}
      <div className="col-span-7 flex flex-col min-h-0 panel">
        <div className="panel-header border-b border-surface-200">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <h2 className="text-sm font-semibold text-zinc-800">Distributed Traces</h2>
          </div>
          <span className="text-xs text-zinc-400 font-mono">Correlation IDs = request_id</span>
        </div>
        <div className="p-4 flex-1 overflow-auto">
          {traces.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-400">
              No traces recorded yet.
            </div>
          ) : (
            traces.map(trace => <TraceView key={trace.traceId} trace={trace} />)
          )}
        </div>
      </div>
      
    </div>
  );
}
