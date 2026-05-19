// RecoveryTimeline.jsx — Crash/recovery event log panel

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
  crash: {
    icon: '💥',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    label: 'Worker Crashed',
    dot: 'bg-red-500',
  },
  recovered: {
    icon: '✅',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    label: 'Worker Recovered',
    dot: 'bg-emerald-500',
  },
};

export default function RecoveryTimeline({ recoveryLog }) {
  const events = recoveryLog || [];

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <h2 className="text-sm font-semibold text-zinc-800">Recovery Log</h2>
        </div>
        <span className="text-xs text-zinc-400">
          {events.filter(e => e.type === 'crash').length} crashes
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-zinc-400 p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">🛡️</div>
              <p>No crash events</p>
              <p className="text-xs mt-1">Crash a running worker to see recovery logs</p>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-1.5">
            {events.map((event) => {
              const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.crash;

              return (
                <div
                  key={event.id}
                  className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border ${cfg.bg} ${cfg.border} animate-fade-in`}
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center mt-1">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <div className="w-px h-full bg-surface-200 mt-1" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{cfg.icon}</span>
                        <span className={`text-xs font-semibold ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {formatTime(event.ts)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-zinc-500">
                        Slot <span className="font-mono font-medium">{event.slotIndex}</span>
                      </span>
                      {event.requestId && (
                        <span className="text-[11px] text-zinc-400 font-mono">
                          req:{event.requestId.substring(0, 8)}
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
