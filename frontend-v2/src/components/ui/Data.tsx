import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/** Numbered pager driven by the server's `totalPages`; filters reset to page 1. */
export const Pagination: React.FC<{
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}> = ({ page, totalPages, onChange, className }) => {
  if (totalPages <= 1) return null;

  const pages: (number | 'gap')[] = [];
  const push = (value: number | 'gap') => pages.push(value);
  const start = Math.max(1, page - 1);
  const end = Math.min(totalPages, page + 1);
  if (start > 1) {
    push(1);
    if (start > 2) push('gap');
  }
  for (let i = start; i <= end; i += 1) push(i);
  if (end < totalPages) {
    if (end < totalPages - 1) push('gap');
    push(totalPages);
  }

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-1', className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Prev
      </Button>
      {pages.map((value, index) =>
        value === 'gap' ? (
          <span key={`gap-${index}`} className="px-2 text-sm text-muted">
            …
          </span>
        ) : (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-current={value === page ? 'page' : undefined}
            className={cn(
              'h-9 min-w-9 rounded-control px-2 text-sm tabular transition-colors',
              value === page ? 'bg-primary text-white' : 'text-ink hover:bg-surface'
            )}
          >
            {value}
          </button>
        )
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </nav>
  );
};

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  className?: string;
  numeric?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  caption?: string;
  className?: string;
}

/** Dense, sticky-header table for the host and staff consoles (architecture 13). */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  caption,
  className,
}: DataTableProps<T>) {
  return (
    // `overflow-x-auto` alone computes overflow-y to `auto` as well, which makes this the
    // scroll container and leaves the sticky header with no range to stick inside. The
    // height cap gives it one, so `thead` stays put while the body scrolls.
    <div className={cn('max-h-[70vh] overflow-auto rounded-card border border-line bg-surface', className)}>
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 z-10 bg-bg text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn('px-4 py-3 font-medium', column.numeric && 'text-right', column.className)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('border-t border-line', onRowClick && 'cursor-pointer hover:bg-bg')}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn('px-4 py-3 align-middle text-ink', column.numeric && 'text-right tabular')}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}