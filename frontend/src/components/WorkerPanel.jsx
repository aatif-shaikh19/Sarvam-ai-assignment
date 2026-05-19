// WorkerPanel.jsx — 4-slot worker state grid with crash simulation
// States: AVAILABLE, RUNNING, RECOVERING, DEAD

import { useState, useEffect } from 'react';
import DeviceBadge from './DeviceBadge.jsx';

const STATE_STYLES = {
  AVAILABLE: {
    border: 'border-dashed border-emerald-300',
    bg: 'bg-emerald-50/50',
    dot: 'bg-emerald-400',
    label: 'Available',
    labelColor: 'text-emerald-600',
  },
  RUNNING: {
    border: 'border-solid',
    // bg set dynamically per MFE
    dot: 'animate-pulse',
    label: 'Running',
    labelColor: 'text-zinc-700',
  },
  RECOVERING: {
    border: 'border-solid border-red-300 recovering-glow',
    bg: 'bg-red-50',
    dot: 'bg-red-500 animate-pulse',
    label: 'Recovering',
    labelColor: 'text-red-600',
  },
  DEAD: {
    border: 'border-solid border-zinc-300',
    bg: 'bg-zinc-100',
    dot: 'bg-zinc-400',
    label: 'Dead',
    labelColor: 'text-zinc-500',
  },
};

function CountdownTimer({ recoverAt }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!recoverAt) return;

    const tick = () => {
      const diff = Math.max(0, recoverAt - Date.now());
      setRemaining(diff);
    };

    tick();
    const interval = setInterval(tick, 50);
    return () => clearInterval(interval);
  }, [recoverAt]);

  const seconds = (remaining / 1000).toFixed(1);

  return (
    <div className="mt-1.5">
      <div className="h-1.5 bg-red-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-red-500 rounded-full transition-all duration-100"
          style={{ width: `${Math.max(0, (remaining / 3000) * 100)}%` }}
        />
      </div>
      <p className="text-[10px] text-red-500 mt-0.5 font-mono text-center">
        Recovery in {seconds}s
      </p>
    </div>
  );
}

export default function WorkerPanel({ slots, active, tokens, workerStates, onCrashWorker }) {
  const totalSlots = slots?.total || 4;
  const maxPerMfe = slots?.maxPerMfe || 2;
  const perMfe = slots?.perMfe || {};
  const docQaCount = perMfe['doc-qa'] || 0;
  const meetingCount = perMfe['meeting'] || 0;
  const recoveringCount = slots?.recovering || 0;

  // Build slot display by merging worker states with active requests
  const slotDisplays = [];
  const activeList = active || [];
  const workers = workerStates || [];

  for (let i = 0; i < totalSlots; i++) {
    const worker = workers[i] || { slotIndex: i, state: 'AVAILABLE' };
    const assignedRequestId = slots?.assignment?.[i];
    const req = assignedRequestId
      ? activeList.find(r => r.id === assignedRequestId)
      : null;
    const tokenData = req ? tokens?.[req.id] : null;

    slotDisplays.push({
      slotIndex: i,
      workerState: worker.state,
      recoverAt: worker.recoverAt,
      crashCount: worker.crashCount || 0,
      request: req,
      tokenData,
    });
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <h2 className="text-sm font-semibold text-zinc-800">Worker Slots</h2>
        </div>
        <div className="flex items-center gap-2">
          {recoveringCount > 0 && (
            <span className="badge bg-red-50 text-red-600 border border-red-200 animate-pulse">
              {recoveringCount} recovering
            </span>
          )}
          <span className="text-xs text-zinc-400">
            {activeList.length}/{totalSlots} active
          </span>
        </div>
      </div>

      <div className="panel-body space-y-3">
        {/* Per-MFE slot counters */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-docqa-50 border border-docqa-200">
            <span className="text-xs font-medium text-docqa-600">Doc Q&A</span>
            <span className="ml-auto text-xs font-mono text-docqa-600">
              {docQaCount}/{maxPerMfe}
            </span>
          </div>
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-meeting-50 border border-meeting-200">
            <span className="text-xs font-medium text-meeting-600">Meeting</span>
            <span className="ml-auto text-xs font-mono text-meeting-600">
              {meetingCount}/{maxPerMfe}
            </span>
          </div>
        </div>

        {/* Slot grid */}
        <div className="grid grid-cols-2 gap-2">
          {slotDisplays.map((slot) => {
            const stateKey = slot.workerState || 'AVAILABLE';
            const style = STATE_STYLES[stateKey] || STATE_STYLES.AVAILABLE;
            const isRunning = stateKey === 'RUNNING';
            const isRecovering = stateKey === 'RECOVERING';
            const req = slot.request;
            const isDocQa = req?.mfeId === 'doc-qa';

            // Dynamic bg for RUNNING state (based on MFE)
            const bgClass = isRunning
              ? req
                ? isDocQa
                  ? 'bg-docqa-50'
                  : 'bg-meeting-50'
                : 'bg-blue-50'
              : style.bg;

            const borderClass = isRunning
              ? req
                ? isDocQa
                  ? 'border-docqa-200'
                  : 'border-meeting-200'
                : 'border-blue-200'
              : style.border;

            return (
              <div
                key={slot.slotIndex}
                className={`rounded-lg border p-3 transition-all duration-300 ${borderClass} ${bgClass} ${
                  isRecovering ? 'animate-shake' : ''
                }`}
              >
                {/* Slot header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    Slot {slot.slotIndex}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-medium ${style.labelColor}`}>
                      {style.label}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isRunning
                          ? `animate-pulse ${isDocQa ? 'bg-docqa-500' : 'bg-meeting-500'}`
                          : style.dot
                      }`}
                    />
                  </div>
                </div>

                {/* Content by state */}
                {isRunning && req ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-zinc-700 truncate">
                        {isDocQa ? 'Doc Q&A' : 'Meeting'}
                      </p>
                      {/* Crash button */}
                      <button
                        onClick={() => onCrashWorker?.(slot.slotIndex)}
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                        title="Simulate worker crash"
                      >
                        ✕ Crash
                      </button>
                    </div>
                    {req.device && (
                      <DeviceBadge type={req.device.type} id={req.device.id} />
                    )}
                    <div className="mt-1">
                      <div className="h-1 bg-white/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full progress-fill ${
                            isDocQa ? 'bg-docqa-500' : 'bg-meeting-500'
                          }`}
                          style={{ width: `${slot.tokenData?.progress || 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                        {slot.tokenData?.progress || 0}%
                      </p>
                    </div>
                  </div>
                ) : isRecovering ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-red-500 text-sm">⚠</span>
                      <p className="text-xs font-medium text-red-600">Worker Crashed</p>
                    </div>
                    <p className="text-[10px] text-red-400">
                      Crashes: {slot.crashCount}
                    </p>
                    <CountdownTimer recoverAt={slot.recoverAt} />
                  </div>
                ) : stateKey === 'DEAD' ? (
                  <div className="space-y-1">
                    <span className="text-zinc-400 text-sm">☠</span>
                    <p className="text-xs text-zinc-500">Worker dead</p>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-500 italic">Ready for dispatch</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
