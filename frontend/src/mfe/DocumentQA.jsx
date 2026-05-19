// DocumentQA.jsx — MFE 1: Document Q&A Panel

import { useState } from 'react';

const SAMPLE_QUESTIONS = [
  'What are the key findings in section 4.2?',
  'Summarize the methodology used in the study.',
  'What performance metrics exceeded baseline?',
  'List the main conclusions from the analysis.',
  'How does the RAG pipeline retrieve context?',
];

export default function DocumentQA({ onSubmit }) {
  const [prompt, setPrompt] = useState('');
  const [priority, setPriority] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ mfeId: 'doc-qa', priority, prompt: prompt.trim() });
      setPrompt('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickQuestion = (q) => {
    setPrompt(q);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-docqa-100 flex items-center justify-center">
            <span className="text-docqa-600 text-xs">📄</span>
          </div>
          <h2 className="text-sm font-semibold text-zinc-800">Document Q&A</h2>
        </div>
        <span className="badge bg-docqa-50 text-docqa-600 border border-docqa-200">MFE</span>
      </div>

      <div className="panel-body space-y-3">
        {/* Quick questions */}
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => handleQuickQuestion(q)}
              className="text-[11px] px-2 py-1 rounded-md bg-surface-100 text-zinc-500 hover:bg-docqa-50 hover:text-docqa-600 transition-colors truncate max-w-full"
              title={q}
            >
              {q.length > 40 ? q.substring(0, 40) + '…' : q}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask a question about your document..."
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-docqa-400 focus:border-transparent resize-none placeholder:text-zinc-400 text-zinc-700"
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
              className="px-4 py-1.5 rounded-lg bg-docqa-600 text-white text-xs font-medium hover:bg-docqa-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
