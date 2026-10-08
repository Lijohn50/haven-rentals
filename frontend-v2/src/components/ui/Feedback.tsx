import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ApiError } from '@/api/errors';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/** The `traceId` is how support can find the exact server log line (architecture 4.5). */
export const TraceId: React.FC<{ error: unknown; className?: string }> = ({ error, className }) => {
  if (!(error instanceof ApiError) || !error.traceId) return null;
  return (
    <p className={cn('text-xs text-muted', className)}>
      Reference: <span className="tabular">{error.traceId}</span>
    </p>
  );
};

export const ErrorState: React.FC<{
  title?: string;
  error?: unknown;
  message?: string;
  onRetry?: () => void;
  className?: string;
}> = ({ title = 'Something went wrong', error, message, onRetry, className }) => {
  const detail = message ?? (error instanceof ApiError ? error.detail : error instanceof Error ? error.message : undefined);
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-start gap-3 rounded-card border border-line bg-surface p-6', className)}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {detail && <p className="mt-1 text-sm text-muted">{detail}</p>}
          <TraceId error={error} className="mt-1" />
        </div>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Try again
        </Button>
      )}
    </div>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, description, action, className }) => (
  <div className={cn('flex flex-col items-start gap-3 rounded-card border border-dashed border-line bg-surface p-8', className)}>
    <h2 className="text-base font-semibold text-ink">{title}</h2>
    {description && <p className="max-w-prose text-sm text-muted">{description}</p>}
    {action}
  </div>
);

/** Form-level alert: business-rule errors that belong next to the action. */
export const InlineAlert: React.FC<{
  tone?: 'info' | 'warning' | 'danger' | 'success';
  children: React.ReactNode;
  className?: string;
}> = ({ tone = 'danger', children, className }) => {
  const tones = {
    info: 'bg-info-soft text-info-text',
    warning: 'bg-warning-soft text-warning-text',
    danger: 'bg-danger-soft text-danger-text',
    success: 'bg-success-soft text-success-text',
  } as const;
  return (
    <div role="alert" className={cn('rounded-control px-3 py-2 text-sm', tones[tone], className)}>
      {children}
    </div>
  );
};

/**
 * Maps `ApiError.fieldErrors` onto react-hook-form's `setError`, leaving anything unmatched
 * in a form-level alert (architecture 4.5 step 1).
 */
export function applyFieldErrors(
  error: unknown,
  setError: (name: string, message: string) => void,
  knownFields: string[]
): string[] {
  if (!(error instanceof ApiError)) return [];
  const unmatched: string[] = [];
  for (const fieldError of error.fieldErrors) {
    const name = fieldError.field.replace(/^[^\[]*\[(\d+)\]$/, '.$1');
    if (knownFields.includes(name)) setError(name, fieldError.message);
    else unmatched.push(fieldError.message);
  }
  return unmatched;
}