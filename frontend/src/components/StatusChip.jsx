const STATUS_STYLES = {
  planned: "bg-slate-800/70 text-slate-200 ring-1 ring-slate-700/70",
  sourcing: "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/60",
  ordered: "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/70",
  procured: "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/70",
  abandoned: "bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/60"
};

function StatusChip({ status }) {
  if (!status) return null;
  const normalized = status.toLowerCase();
  const classes = STATUS_STYLES[normalized] ?? STATUS_STYLES.planned;
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${classes}`}>
      {label}
    </span>
  );
}

export default StatusChip;
