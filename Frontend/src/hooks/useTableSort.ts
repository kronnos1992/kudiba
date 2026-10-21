import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export function useTableSort<T>(
  items: T[],
  initialKeyOrConfig?: string | { key: string; direction?: SortDirection },
  initialDirection: SortDirection = 'asc'
) {
  const initialKey =
    typeof initialKeyOrConfig === 'string'
      ? initialKeyOrConfig
      : initialKeyOrConfig?.key;
  const initialDir =
    typeof initialKeyOrConfig === 'object' && initialKeyOrConfig?.direction
      ? initialKeyOrConfig.direction
      : initialDirection;

  const [sortConfig, setSortConfig] = useState<SortConfig | null>(
    initialKey ? { key: initialKey, direction: initialDir } : null
  );

  const requestSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') {
          return { key, direction: 'desc' };
        }
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items;

    const getVal = (obj: any, path: string) => {
      if (!obj) return null;
      if (!path.includes('.')) return obj[path];
      return path.split('.').reduce((acc, part) => acc?.[part], obj);
    };

    return [...items].sort((a: any, b: any) => {
      const aVal = getVal(a, sortConfig.key);
      const bVal = getVal(b, sortConfig.key);

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        return sortConfig.direction === 'asc'
          ? (aVal === bVal ? 0 : aVal ? -1 : 1)
          : (aVal === bVal ? 0 : aVal ? 1 : -1);
      }

      const aDate = Date.parse(aVal);
      const bDate = Date.parse(bVal);
      if (!isNaN(aDate) && !isNaN(bDate) && typeof aVal === 'string' && (aVal.includes('-') || aVal.includes('/'))) {
        return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      return sortConfig.direction === 'asc'
        ? aStr.localeCompare(bStr, 'pt-AO', { numeric: true })
        : bStr.localeCompare(aStr, 'pt-AO', { numeric: true });
    });
  }, [items, sortConfig]);

  return {
    sortedItems,
    sortedData: sortedItems,
    sortConfig,
    requestSort,
    setSortConfig,
  };
}
