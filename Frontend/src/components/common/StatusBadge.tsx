import React from 'react';

export type StatusType = 'ok' | 'medio' | 'critico' | 'acompanhar';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  size?: 'small' | 'medium';
}

const statusStyles: Record<StatusType, { badge: string; dot: string }> = {
  ok: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
  },
  medio: {
    badge: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    dot: 'bg-amber-600 dark:bg-amber-400',
  },
  critico: {
    badge: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
    dot: 'bg-rose-600 dark:bg-rose-400',
  },
  acompanhar: {
    badge: 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800',
    dot: 'bg-sky-600 dark:bg-sky-400',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'small' }) => {
  const current = statusStyles[status] || statusStyles.ok;
  const sizeClasses = size === 'small' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${sizeClasses} ${current.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      {label}
    </span>
  );
};
