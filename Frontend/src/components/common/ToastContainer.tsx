import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, ToastType } from '../../stores/toastStore';

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
  error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
  info: <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />,
};

const TOAST_STYLES: Record<ToastType, string> = {
  success:
    'bg-slate-900/95 text-slate-100 border-emerald-500/40 shadow-emerald-950/40',
  error:
    'bg-slate-900/95 text-slate-100 border-rose-500/40 shadow-rose-950/40',
  warning:
    'bg-slate-900/95 text-slate-100 border-amber-500/40 shadow-amber-950/40',
  info:
    'bg-slate-900/95 text-slate-100 border-sky-500/40 shadow-sky-950/40',
};

const BADGE_STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  error: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  info: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
};

const TYPE_LABELS: Record<ToastType, string> = {
  success: 'Sucesso',
  error: 'Erro',
  warning: 'Aviso',
  info: 'Informação',
};

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-[99999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none p-2 sm:p-0"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-xl border backdrop-blur-md shadow-2xl p-3 sm:p-4 flex items-start gap-3 transition-all duration-200 transform translate-y-0 ${TOAST_STYLES[toast.type]}`}
        >
          {TOAST_ICONS[toast.type]}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${BADGE_STYLES[toast.type]}`}
              >
                {TYPE_LABELS[toast.type]}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium leading-relaxed break-words text-white/95">
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
            title="Fechar notificação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
