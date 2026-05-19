// FallbackTimeline.jsx — Device fallback/failure/recovery event log

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const EVENT_CONFIG = {
  device_failed: {
    icon: '🔴',
    label: 'Device Failed',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
  },
  fallback: {
    icon: '🔄',
    label: 'Fallback',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
  },
  probe_success: {
    icon: '🟡',
    label: 'Probe Success',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
  },
  device_recovered: {
    icon: '🟢',
    label: 'Device Recovered',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
  },
};

export default function FallbackTimeline({ deviceEvents }) {
  const events = deviceEvents || [];

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <h2 className="text-sm font-semibold text-zinc-800">Fallback Log</h2>
        </div>
        <span className="text-xs text-zinc-400">
          {events.filter(e => e.type === 'fallback').length} fallbacks
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-zinc-400 p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">🔌</div>
              <p>No device events</p>
              <p className="text-xs mt-1">Trigger a device failure to see fallback logs</p>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-1.5">
            {events.map((event) => {
              const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.device_failed;
              const details = event.details || {};

              return (
                <div
                  key={event.id}
                  className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border ${cfg.bg} ${cfg.border} animate-fade-in`}
                >
                  {/* Icon */}
                  <span className="text-xs mt-0.5">{cfg.icon}</span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {formatTime(event.ts)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-zinc-600 font-mono">
                        {event.deviceId}
                      </span>

                      {/* Fallback: from → to */}
                      {event.type === 'fallback' && details.from && details.to && (
                        <span className="text-[11px] text-zinc-500">
                          {details.from.type} → {details.to.type}
                        </span>
                      )}

                      {/* Probe: count */}
                      {event.type === 'probe_success' && details.probeCount !== undefined && (
                        <span className="text-[11px] text-zinc-500">
                          Probe {details.probeCount}/{details.remaining !== undefined
                            ? details.probeCount + details.remaining
                            : '?'}
                        </span>
                      )}

                      {/* Circuit breaker state */}
                      {details.circuitBreaker && (
                        <span className="badge text-[9px] bg-white/60 text-zinc-500">
                          CB: {details.circuitBreaker}
                        </span>
                      )}

                      {/* Recovery time */}
                      {details.totalRecoveryMs && (
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {(details.totalRecoveryMs / 1000).toFixed(1)}s recovery
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
