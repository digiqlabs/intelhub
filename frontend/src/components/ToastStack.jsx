import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

const VARIANT_CLASSES = {
  info: {
    container: "bg-slate-900/90 border-slate-700 text-slate-100",
    icon: Info
  },
  success: {
    container: "bg-emerald-500/20 border-emerald-400/60 text-emerald-100",
    icon: CheckCircle2
  },
  error: {
    container: "bg-rose-500/20 border-rose-400/70 text-rose-100",
    icon: AlertTriangle
  }
};

function ToastStack({ toasts, onDismiss }) {
  if (!toasts?.length) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const variant = VARIANT_CLASSES[toast.variant] ?? VARIANT_CLASSES.info;
        const Icon = variant.icon;
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${variant.container}`}
          >
            <Icon className="mt-1 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description && <p className="mt-1 text-xs text-slate-300/90">{toast.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => onDismiss?.(toast.id)}
              className="rounded-full px-2 text-xs uppercase tracking-[0.2em] text-slate-400 transition hover:text-white"
            >
              Close
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastStack;
