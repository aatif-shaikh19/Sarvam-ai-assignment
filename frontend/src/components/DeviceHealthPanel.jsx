// DeviceHealthPanel.jsx — Device health dashboard with circuit breaker status,
// latency display, health probe tracking, and failure simulation controls.

import { useState, useEffect } from 'react';

const STATUS_STYLES = {
  HEALTHY: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    label: 'Healthy',
  },
  DEGRADED: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    label: 'Degraded',
  },
  FAILED: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-500',
    text: 'text-red-700',
    label: 'Failed',
  },
  RECOVERING: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500 animate-pulse',
    text: 'text-amber-700',
    label: 'Recovering',
  },
};

const CB_STYLES = {
  CLOSED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Closed' },
  OPEN: { bg: 'bg-red-100', text: 'text-red-700', label: 'Open' },
  HALF_OPEN: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Half-Open' },
};

const DEVICE_ICONS = {
  NPU: '🧠',
  GPU: '⚡',
  CPU: '💻',
};

function ProbeCountdown({ nextProbeAt }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!nextProbeAt) return;
    const tick = () => {
      setRemaining(Math.max(0, nextProbeAt - Date.now()));
    };
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [nextProbeAt]);

  if (!nextProbeAt) return null;
  return (
    <span className="text-[10px] font-mono text-zinc-400">
      probe in {(remaining / 1000).toFixed(0)}s
    </span>
  );
}

export default function DeviceHealthPanel({ devices, onFailDevice }) {
  const deviceList = devices || [];
  const healthyCount = deviceList.filter(d => d.status === 'HEALTHY').length;

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500" />
          <h2 className="text-sm font-semibold text-zinc-800">Device Health</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">
            {healthyCount}/{deviceList.length} healthy
          </span>
        </div>
      </div>

      <div className="panel-body">
        <div className="grid grid-cols-2 gap-2">
          {deviceList.map((dev) => {
            const statusStyle = STATUS_STYLES[dev.status] || STATUS_STYLES.HEALTHY;
            const cbStyle = CB_STYLES[dev.circuitBreaker] || CB_STYLES.CLOSED;
            const isHealthy = dev.status === 'HEALTHY';
            const isFailed = dev.status === 'FAILED';
            const isRecovering = dev.status === 'RECOVERING';

            return (
              <div
                key={dev.id}
                className={`rounded-lg border p-2.5 transition-all duration-300 ${statusStyle.border} ${statusStyle.bg} ${
                  isFailed ? 'device-failed-glow' : ''
                }`}
              >
                {/* Header: icon + name + status */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{DEVICE_ICONS[dev.type] || '📦'}</span>
                    <span className="text-xs font-semibold text-zinc-700">{dev.id}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                    <span className={`text-[10px] font-medium ${statusStyle.text}`}>
                      {statusStyle.label}
                    </span>
                  </div>
                </div>

                {/* Circuit breaker + latency */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`badge text-[10px] ${cbStyle.bg} ${cbStyle.text}`}>
                    CB: {cbStyle.label}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {dev.estimatedTokenMs}ms/tok
                  </span>
                </div>

                {/* Slots + probe info */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">
                    Slots: {dev.active}/{dev.maxSlots}
                  </span>
                  {(isFailed || isRecovering) && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-amber-600">
                        Probes: {dev.successfulProbes}/{dev.probesToRecover}
                      </span>
                    </div>
                  )}
                </div>

                {/* Probe countdown */}
                {(isFailed || isRecovering) && dev.nextProbeAt && (
                  <div className="mt-1.5 pt-1.5 border-t border-white/50">
                    <ProbeCountdown nextProbeAt={dev.nextProbeAt} />
                  </div>
                )}

                {/* Fail button (only for healthy devices, not CPU — always need CPU as fallback) */}
                {isHealthy && dev.type !== 'CPU' && (
                  <div className="mt-1.5 pt-1.5 border-t border-white/50">
                    <button
                      onClick={() => onFailDevice?.(dev.id)}
                      className="w-full px-2 py-1 rounded text-[10px] font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                    >
                      ⚠ Simulate Failure
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
