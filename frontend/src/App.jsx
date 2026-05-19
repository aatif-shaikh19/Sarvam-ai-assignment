// App.jsx — Shell: owns EdgeAgentService singleton, composes MFEs + dashboard panels
// Extended with worker crash controls, recovery timeline, device health, and fallback log.

import useEdgeAgent from './hooks/useEdgeAgent.js';
import DocumentQA from './mfe/DocumentQA.jsx';
import MeetingSummariser from './mfe/MeetingSummariser.jsx';
import QueueTable from './components/QueueTable.jsx';
import WorkerPanel from './components/WorkerPanel.jsx';
import StreamingPanel from './components/StreamingPanel.jsx';
import TimelinePanel from './components/TimelinePanel.jsx';
import RecoveryTimeline from './components/RecoveryTimeline.jsx';
import DeviceHealthPanel from './components/DeviceHealthPanel.jsx';
import FallbackTimeline from './components/FallbackTimeline.jsx';
import ObservabilityDashboard from './components/ObservabilityDashboard.jsx';
import { useState } from 'react';

function ConnectionIndicator({ connected }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`w-2 h-2 rounded-full ${
          connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'
        }`}
      />
      <span className="text-xs text-zinc-400">
        {connected ? 'SSE Connected' : 'Disconnected'}
      </span>
    </div>
  );
}

function DeviceOverview({ devices }) {
  return (
    <div className="flex items-center gap-3">
      {(devices || []).map((d) => {
        const isHealthy = d.status === 'HEALTHY';
        const isFailed = d.status === 'FAILED';

        return (
          <div
            key={d.id}
            className="flex items-center gap-1.5 text-xs text-zinc-400"
            title={`${d.id}: ${d.status} | CB: ${d.circuitBreaker} | ${d.estimatedTokenMs}ms/tok`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isFailed
                  ? 'bg-red-500'
                  : d.status === 'RECOVERING'
                  ? 'bg-amber-500 animate-pulse'
                  : d.active > 0
                  ? d.type === 'NPU'
                    ? 'bg-emerald-500'
                    : d.type === 'GPU'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                  : isHealthy
                  ? 'bg-surface-300'
                  : 'bg-red-300'
              }`}
            />
            <span className={`font-mono ${isFailed ? 'line-through text-red-400' : ''}`}>
              {d.type} {isHealthy ? `${d.active}/${d.maxSlots}` : d.status.charAt(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const {
    queue, active, history, slots, devices, tokens,
    workerStates, recoveryLog, deviceEvents, observability,
    connected, submit, crashWorker, failDevice,
  } = useEdgeAgent();

  const [view, setView] = useState('scheduler'); // 'scheduler' | 'observability'

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── Header ──────────────────────────────────── */}
      <header className="border-b border-surface-200 bg-white sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">E</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-zinc-900 leading-tight">
                Edge Agent Runtime
              </h1>
              <p className="text-[11px] text-zinc-400 leading-tight">
                On-Device Scheduler Simulator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            
            {/* View Toggle */}
            <div className="flex items-center bg-surface-100 p-1 rounded-lg border border-surface-200">
              <button 
                onClick={() => setView('scheduler')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === 'scheduler' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Scheduler
              </button>
              <button 
                onClick={() => setView('observability')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === 'observability' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Observability
              </button>
            </div>

            <div className="h-4 w-px bg-surface-200" />
            <DeviceOverview devices={devices} />
            <div className="h-4 w-px bg-surface-200" />
            <ConnectionIndicator connected={connected} />
          </div>
        </div>
      </header>

      {/* ── Main Layout ─────────────────────────────── */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-6 h-[calc(100vh-3.5rem)]">
        {view === 'scheduler' ? (
          <div className="grid grid-cols-12 gap-4 h-[calc(100vh-5rem)]">
            {/* Left column: MFE panels + Device Health */}
            <div className="col-span-3 flex flex-col gap-4 overflow-auto">
              <DocumentQA onSubmit={submit} />
              <MeetingSummariser onSubmit={submit} />
              <DeviceHealthPanel devices={devices} onFailDevice={failDevice} />
            </div>

            {/* Center column: Queue + Timeline + Fallback Log */}
            <div className="col-span-5 flex flex-col gap-4 overflow-hidden">
              <div className="flex-[2] min-h-0">
                <QueueTable queue={queue} active={active} tokens={tokens} />
              </div>
              <div className="flex-1 min-h-0">
                <TimelinePanel active={active} history={history} />
              </div>
              <div className="flex-1 min-h-0">
                <FallbackTimeline deviceEvents={deviceEvents} />
              </div>
            </div>

            {/* Right column: Workers + Recovery Log + Streaming */}
            <div className="col-span-4 flex flex-col gap-4 overflow-hidden">
              <WorkerPanel
                slots={slots}
                active={active}
                tokens={tokens}
                workerStates={workerStates}
                onCrashWorker={crashWorker}
              />
              <div className="flex-1 min-h-0">
                <RecoveryTimeline recoveryLog={recoveryLog} />
              </div>
              <div className="flex-1 min-h-0">
                <StreamingPanel tokens={tokens} active={active} />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[calc(100vh-5rem)]">
            <ObservabilityDashboard observability={observability} />
          </div>
        )}
      </main>
    </div>
  );
}
