// MeetingSummariser.jsx — MFE 2: Meeting Summariser Panel

import { useState } from 'react';

const SAMPLE_TRANSCRIPT = `[10:00] Sarah: Let's discuss the Q3 roadmap. The migration to microservices is critical.
[10:05] Mike: I've drafted the technical specification. We need to finalize the API contracts.
[10:12] Sarah: Budget for cloud infrastructure was approved — $45K for the quarter.
[10:18] Alex: Design team will have the component library ready by Friday.
[10:25] Mike: We should schedule a stakeholder review before sprint planning.
[10:30] Sarah: Agreed. Let's also address the vendor API integration dependency.
[10:35] Alex: I'll prepare risk assessment documentation for the next standup.
[10:40] Sarah: Great. Action items: Mike — stakeholder review, Alex — risk doc, Team — retro.`;

export default function MeetingSummariser({ onSubmit }) {
  const [prompt, setPrompt] = useState(SAMPLE_TRANSCRIPT);
  const [priority, setPriority] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ mfeId: 'meeting', priority, prompt: prompt.trim() });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-meeting-100 flex items-center justify-center">
            <span className="text-meeting-600 text-xs">🎙️</span>
          </div>
          <h2 className="text-sm font-semibold text-zinc-800">Meeting Summariser</h2>
        </div>
        <span className="badge bg-meeting-50 text-meeting-600 border border-meeting-200">MFE</span>
      </div>

      <div className="panel-body space-y-3">
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Paste meeting transcript here..."
            rows={5}
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-meeting-400 focus:border-transparent resize-none placeholder:text-zinc-400 text-zinc-700 font-mono text-xs leading-relaxed"
          />

          <div className="flex items-center justify-between">
            {/* Priority toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Priority:</span>
              <div className="flex rounded-md border border-surface-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPriority(0)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    priority === 0
                      ? 'bg-red-50 text-red-600'
                      : 'bg-white text-zinc-400 hover:bg-surface-50'
                  }`}
                >
                  P0 User
                </button>
                <button
                  type="button"
                  onClick={() => setPriority(1)}
                  className={`px-2.5 py-1 text-xs font-medium border-l border-surface-200 transition-colors ${
                    priority === 1
                      ? 'bg-zinc-100 text-zinc-600'
                      : 'bg-white text-zinc-400 hover:bg-surface-50'
                  }`}
                >
                  P1 Background
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!prompt.trim() || submitting}
              className="px-4 py-1.5 rounded-lg bg-meeting-600 text-white text-xs font-medium hover:bg-meeting-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Summarising…' : 'Summarise'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
