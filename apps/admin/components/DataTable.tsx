'use client';

import { ReactNode, useState, useMemo } from 'react';

interface Column<T> {
  header: string;
  accessor: (row: T) => ReactNode;
  sortKey?: (row: T) => string | number;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
  emptyIcon?: string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  isLoading = false,
  emptyIcon = '📋',
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const hasPagination = totalPages > 1 && onPageChange;

  const sortedData = useMemo(() => {
    if (sortCol === null) return data;
    const col = columns[sortCol];
    if (!col?.sortKey) return data;
    const key = col.sortKey;
    return [...data].sort((a, b) => {
      const av = key(a);
      const bv = key(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortCol, sortDir, columns]);

  const handleSort = (idx: number) => {
    if (!columns[idx]?.sortKey) return;
    if (sortCol === idx) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(idx);
      setSortDir('asc');
    }
  };

  return (
    <div>
      <div className="data-table-wrap" role="region" aria-label="Data table" tabIndex={0}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column, idx) => {
                const isSortable = !!column.sortKey;
                const isSorted = sortCol === idx;
                return (
                  <th
                    key={idx}
                    className={`${column.className || ''} ${isSortable ? 'sortable' : ''} ${isSorted ? 'sorted' : ''}`}
                    onClick={isSortable ? () => handleSort(idx) : undefined}
                    onKeyDown={isSortable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(idx); } } : undefined}
                    tabIndex={isSortable ? 0 : undefined}
                    role={isSortable ? 'columnheader' : undefined}
                    aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : isSortable ? 'none' : undefined}
                  >
                    {column.header}
                    {isSortable && (
                      <span className="sort-icon">
                        {isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skel-${idx}`}>
                  {columns.map((_, colIdx) => (
                    <td key={colIdx}>
                      <div
                        className="skeleton skeleton-text"
                        style={{ width: `${45 + ((idx * 13 + colIdx * 17) % 40)}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="empty-state">
                    <div className="empty-state-icon">{emptyIcon}</div>
                    <p>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {columns.map((column, colIdx) => (
                    <td key={colIdx} className={column.className}>
                      {column.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasPagination && (
        <div className="pagination">
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          <div className="pagination-controls">
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              ← Previous
            </button>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
