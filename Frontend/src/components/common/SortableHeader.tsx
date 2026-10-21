import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface SortableHeaderProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  field?: string;
  columnKey?: string;
  label?: React.ReactNode;
  currentSort?: { key: string; direction: 'asc' | 'desc' } | null;
  currentSortField?: string | null;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: (field: string) => void;
  align?: 'left' | 'center' | 'right';
  children?: React.ReactNode;
  sticky?: boolean;
}

export const SortableHeader: React.FC<SortableHeaderProps> = ({
  field,
  columnKey,
  label,
  currentSort,
  currentSortField,
  sortDirection,
  onSort,
  align = 'left',
  children,
  className = '',
  sticky = true,
  ...rest
}) => {
  const activeField = field || columnKey;
  const activeCurrentField = currentSort ? currentSort.key : currentSortField;
  const activeDirection = currentSort ? currentSort.direction : sortDirection;
  const content = children ?? label;

  const isSorted = Boolean(activeField && activeCurrentField === activeField);
  const isClickable = Boolean(activeField && onSort);

  const alignClass =
    align === 'right'
      ? 'justify-end text-right'
      : align === 'center'
      ? 'justify-center text-center'
      : 'justify-start text-left';

  const stickyClass = sticky
    ? 'sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs'
    : '';

  return (
    <th
      className={`${stickyClass} ${className}`}
      {...rest}
    >
      {isClickable ? (
        <button
          type="button"
          onClick={() => {
            if (activeField && onSort) {
              onSort(activeField);
            }
          }}
          className={`group inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs transition select-none hover:text-blue-600 dark:hover:text-blue-400 ${alignClass} w-full`}
          title={`Ordenar por ${typeof content === 'string' ? content : 'coluna'}`}
        >
          <span>{content}</span>
          <span className="shrink-0 transition-opacity">
            {isSorted ? (
              activeDirection === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </span>
        </button>
      ) : (
        <div className={`inline-flex items-center font-bold uppercase tracking-wider text-xs ${alignClass} w-full`}>
          {content}
        </div>
      )}
    </th>
  );
};
