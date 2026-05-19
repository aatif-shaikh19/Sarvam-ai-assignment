// StreamingPanel.jsx — Live token output with typewriter effect

import { useState } from 'react';

export default function StreamingPanel({ tokens, active }) {
  const [selectedId, setSelectedId] = useState(null);

  // Get active streaming request IDs
  const streamingIds = Object.keys(tokens).filter(
    (id) => !tokens[id].complete
  );
  const completedIds = Object.keys(tokens)
    .filter((id) => tokens[id].complete)
    .slice(0, 5);

  const allIds = [...streamingIds, ...completedIds];
  const currentId = selectedId && tokens[selectedId] ? selectedId : allIds[0];
  const currentToken = currentId ? tokens[currentId] : null;

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <h2 className="text-sm font-semibold text-zinc-800">Token Stream</h2>
        </div>
        <span className="text-xs text-zinc-400">
          {streamingIds.length} active
        </span>
      </div>

      {/* Tab bar for active streams */}
      {allIds.length > 0 && (
        <div className="flex gap-1 px-3 pt-2 overflow-x-auto">
          {allIds.map((id) => {
            const t = tokens[id];
            const isActive = id === currentId;
            const isDocQa = t?.mfeId === 'doc-qa';

            return (
              <button
                key={id}
                onClick={() => setSelectedId(id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? isDocQa
                      ? 'bg-docqa-100 text-docqa-700'
                      : 'bg-meeting-100 text-meeting-700'
                    : 'bg-surface-100 text-zinc-500 hover:bg-surface-200'
                }`}
              >
                {!t?.complete && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                      isDocQa ? 'bg-docqa-500' : 'bg-meeting-500'
                    }`}
                  />
                )}
                {t?.complete && <span className="text-green-500">✓</span>}
                {id.substring(0, 6)}
              </button>
            );
          })}
        </div>
      )}

      {/* Token output */}
      <div className="flex-1 overflow-auto p-4">
        {currentToken ? (
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`badge ${
                    currentToken.mfeId === 'doc-qa'
                      ? 'bg-docqa-50 text-docqa-600'
                      : 'bg-meeting-50 text-meeting-600'
                  }`}
                >
                  {currentToken.mfeId === 'doc-qa' ? 'Doc Q&A' : 'Meeting'}
                </span>
                {currentToken.complete && (
                  <span className="badge bg-green-50 text-green-600">Complete</span>
                )}
              </div>
              <span className="text-xs font-mono text-zinc-400">
                {currentToken.tokens.length}/{currentToken.totalTokens} tokens
              </span>
            </div>

            {/* Progress */}
            <div className="h-1 bg-surface-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full progress-fill ${
                  currentToken.complete ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${currentToken.progress}%` }}
              />
            </div>

            {/* Token text */}
            <div className="bg-surface-50 rounded-lg p-3 border border-surface-200 min-h-[120px] font-mono text-sm leading-relaxed text-zinc-700">
              {currentToken.tokens.join(' ')}
              {!currentToken.complete && <span className="typing-cursor" />}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-zinc-400">
            <div className="text-center">
              <div className="text-2xl mb-2">✦</div>
              <p>No active token streams</p>
              <p className="text-xs mt-1">Tokens will appear here during inference</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
