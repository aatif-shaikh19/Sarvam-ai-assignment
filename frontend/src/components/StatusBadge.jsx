// StatusBadge.jsx — Request state pill

const CONFIG = {
  queued: {
    bg: 'bg-zinc-100',
    text: 'text-zinc-600',
    dot: 'bg-zinc-400',
    label: 'Queued',
  },
  active: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    label: 'Active',
    pulse: true,
  },
  streaming: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Streaming',
    pulse: true,
  },
  completed: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    dot: 'bg-green-500',
    label: 'Completed',
  },
  failed: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    label: 'Failed',
  },
};

export default function StatusBadge({ state }) {
  const cfg = CONFIG[state] || CONFIG.queued;

  return (
    <span className={`badge ${cfg.bg} ${cfg.text}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`}
      />
      {cfg.label}
    </span>
  );
}
