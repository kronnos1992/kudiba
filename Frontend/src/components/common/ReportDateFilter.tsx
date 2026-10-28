import React from 'react';
import { CalendarDays } from 'lucide-react';

export interface ReportDateRange {
  startDate: string;
  endDate: string;
}

export const getLocalDateString = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const resolveReportDateRange = (
  startDate: string,
  endDate: string,
): ReportDateRange => {
  const fallbackDate = getLocalDateString();
  const resolvedStart = startDate || endDate || fallbackDate;
  const resolvedEnd = endDate || startDate || fallbackDate;

  return resolvedStart <= resolvedEnd
    ? { startDate: resolvedStart, endDate: resolvedEnd }
    : { startDate: resolvedEnd, endDate: resolvedStart };
};

interface ReportDateFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}

export const ReportDateFilter: React.FC<ReportDateFilterProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) => (
  <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
    <div className="flex items-center gap-2 pb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
      <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      Período do relatório
    </div>
    <label className="grid gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
      Início
      <input
        type="date"
        value={startDate}
        max={endDate || undefined}
        onChange={(event) => onStartDateChange(event.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
    </label>
    <label className="grid gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
      Fim
      <input
        type="date"
        value={endDate}
        min={startDate || undefined}
        onChange={(event) => onEndDateChange(event.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
    </label>
    <span className="pb-2 text-xs text-slate-400">
      Sem período definido, são considerados apenas os registos de hoje.
    </span>
  </div>
);
