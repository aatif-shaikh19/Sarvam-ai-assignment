// TimelinePanel.jsx — Active request timeline visualization

import DeviceBadge from './DeviceBadge.jsx';

function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function TimelinePanel({ active, history }) {
  const items = [
    ...active.map((r) => ({ ...r, _type: 'active' })),
    ...(history || []).slice(0, 10).map((r) => ({ ...r, _type: 'history' })),
  ];

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <h2 className="text-sm font-semibold text-zinc-800">Timeline</h2>
        </div>
        <span className="text-xs text-zinc-400">
          {history?.length || 0} completed
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-zinc-400">
            <div className="text-center">
              <div className="text-2xl mb-2">📊</div>
              <p>No request history</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const isActive = item._type === 'active';
              const isDocQa = item.mfeId === 'doc-qa';
              const queueDuration = item.dispatchedAt
                ? item.dispatchedAt - item.enqueuedAt
                : Date.now() - item.enqueuedAt;
              const processDuration = item.completedAt
                ? item.completedAt - item.dispatchedAt
                : item.dispatchedAt
                ? Date.now() - item.dispatchedAt
                : 0;
              const totalDuration = item.completedAt
                ? item.completedAt - item.enqueuedAt
                : Date.now() - item.enqueuedAt;

              // Calculate proportions for the bar
              const totalWidth = Math.max(totalDuration, 1);
              const queuePct = Math.min((queueDuration / totalWidth) * 100, 100);
              const processPct = Math.min(
                (processDuration / totalWidth) * 100,
                100 - queuePct
              );

              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 transition-all animate-slide-up ${
                    isActive
                      ? 'border-blue-200 bg-blue-50/50'
                      : 'border-surface-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-500">
                        {item.id.substring(0, 8)}
                      </span>
                      <span
                        className={`badge ${
                          isDocQa
                            ? 'bg-docqa-50 text-docqa-600'
                            : 'bg-meeting-50 text-meeting-600'
                        }`}
                      >
                        {isDocQa ? 'Doc Q&A' : 'Meeting'}
                      </span>
                      <span
                        className={`badge ${
                          item.priority === 0
                            ? 'bg-red-50 text-red-600'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        {item.priority === 0 ? 'P0' : 'P1'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.device && (
                        <DeviceBadge type={item.device.type} id={item.device.id} />
                      )}
                      {isActive ? (
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      ) : (
                        <span className="badge bg-green-50 text-green-600">✓</span>
                      )}
                    </div>
                  </div>

                  {/* Timeline bar */}
                  <div className="h-2 bg-surface-200 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-zinc-400 rounded-l-full"
                      style={{ width: `${queuePct}%` }}
                      title={`Queue: ${formatDuration(queueDuration)}`}
                    />
                    <div
                      className={`h-full ${
                        isDocQa ? 'bg-docqa-500' : 'bg-meeting-500'
                      } ${!isActive ? 'rounded-r-full' : ''}`}
                      style={{ width: `${processPct}%` }}
                      title={`Process: ${formatDuration(processDuration)}`}
                    />
                    {isActive && (
                      <div className="flex-1 h-full bg-surface-200 animate-pulse rounded-r-full" />
                    )}
                  </div>

                  <div className="flex justify-between mt-1.5 text-[10px] text-zinc-400 font-mono">
                    <span>{formatTime(item.enqueuedAt)}</span>
                    <span>
                      Queue {formatDuration(queueDuration)}
                      {item.dispatchedAt &&
                        ` · Process ${formatDuration(processDuration)}`}
                    </span>
                    <span>
                      {item.completedAt
                        ? formatTime(item.completedAt)
                        : isActive
                        ? 'running...'
                        : ''}
                    </span>
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
