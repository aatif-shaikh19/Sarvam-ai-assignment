// DeviceBadge.jsx — NPU / GPU / CPU indicator pill

const CONFIG = {
  NPU: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'NPU',
  },
  GPU: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    label: 'GPU',
  },
  CPU: {
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    label: 'CPU',
  },
};

export default function DeviceBadge({ type, id }) {
  const cfg = CONFIG[type] || CONFIG.CPU;

  return (
    <span
      className={`badge border ${cfg.bg} ${cfg.text} ${cfg.border}`}
      title={id || type}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
