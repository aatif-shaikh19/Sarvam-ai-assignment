// QueueTable.jsx — Real-time queue and active request table

import StatusBadge from './StatusBadge.jsx';
import DeviceBadge from './DeviceBadge.jsx';

function MfeBadge({ mfeId }) {
  const isDocQa = mfeId === 'doc-qa';
  return (
    <span
      className={`badge border ${
        isDocQa
          ? 'bg-docqa-50 text-docqa-600 border-docqa-200'
          : 'bg-meeting-50 text-meeting-600 border-meeting-200'
      }`}
    >
      {isDocQa ? 'Doc Q&A' : 'Meeting'}
    </span>
  );
}

function PriorityBadge({ priority }) {
  return (
    <span
      className={`badge ${
        priority === 0
          ? 'bg-red-50 text-red-700 border border-red-200'
          : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
      }`}
    >
      {priority === 0 ? 'P0' : 'P1'}
    </span>
  );
}

export default function QueueTable({ queue, active, tokens }) {
  const allItems = [
    ...active.map((r) => ({ ...r, _section: 'active' })),
    ...queue.map((r) => ({ ...r, _section: 'queued' })),
  ];

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <h2 className="text-sm font-semibold text-zinc-800">Request Queue</h2>
        </div>
        <div className="flex gap-3 text-xs text-zinc-400">
          <span>Active: <span className="text-zinc-700 font-medium">{active.length}</span></span>
          <span>Queued: <span className="text-zinc-700 font-medium">{queue.length}</span></span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {allItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-zinc-400">
            <div className="text-center">
              <div className="text-2xl mb-2">⏳</div>
              <p>No requests in queue</p>
              <p className="text-xs mt-1">Submit a request from an MFE panel</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-400 uppercase tracking-wider border-b border-surface-200">
                <th className="text-left px-4 py-2.5 font-medium">#</th>
                <th className="text-left px-4 py-2.5 font-medium">Request ID</th>
                <th className="text-left px-4 py-2.5 font-medium">MFE</th>
                <th className="text-left px-4 py-2.5 font-medium">Priority</th>
                <th className="text-left px-4 py-2.5 font-medium">State</th>
                <th className="text-left px-4 py-2.5 font-medium">Device</th>
                <th className="text-left px-4 py-2.5 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((item, idx) => {
                const tokenData = tokens[item.id];
                const progress = tokenData?.progress || 0;

                return (
                  <tr
                    key={item.id}
                    className="border-b border-surface-100 hover:bg-surface-50 transition-colors animate-fade-in"
                  >
                    <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">
                      {item._section === 'active' ? '▸' : item.position || idx + 1}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-600">
                      {item.id.substring(0, 8)}
                    </td>
                    <td className="px-4 py-2.5">
                      <MfeBadge mfeId={item.mfeId} />
                    </td>
                    <td className="px-4 py-2.5">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge state={item.state} />
                    </td>
                    <td className="px-4 py-2.5">
                      {item.device ? (
                        <DeviceBadge type={item.device.type} id={item.device.id} />
                      ) : (
                        <span className="text-xs text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {item._section === 'active' ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-200 rounded-full overflow-hidden max-w-[80px]">
                            <div
                              className="h-full bg-blue-500 rounded-full progress-fill"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 font-mono w-8 text-right">
                            {progress}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
