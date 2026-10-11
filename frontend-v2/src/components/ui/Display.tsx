import React from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCheck,
  CheckCircle2,
  Clock,
  EyeOff,
  FileText,
  Info,
  Loader2,
  MessageSquare,
  Pause,
  RefreshCw,
  Search,
  Star,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  bookingStatusEntry,
  disputeStatus,
  listingStatus,
  paymentStatus,
  payoutStatus,
  refundStatus,
  reviewStatus,
  statusEntry,
  userStatus,
  type StatusEntry,
  type Tone,
} from '@/lib/status';
import { TraceId } from './Feedback';
import type { BookingStatus } from '@/types/api';

const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-success-soft text-success-text',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
  info: 'bg-info-soft text-info-text',
  neutral: 'bg-neutral-soft text-neutral-text',
};

const LISTING_ICONS: Record<string, React.FC<{ className?: string }>> = {
  DRAFT: FileText,
  PENDING_REVIEW: Clock,
  ACTIVE: CheckCircle2,
  PAUSED: Pause,
  SUSPENDED: Ban,
  REJECTED: XCircle,
  DELETED: Trash2,
};

const PAYMENT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  PENDING: Clock,
  SUCCEEDED: CheckCircle2,
  FAILED: XCircle,
  PARTIALLY_REFUNDED: RefreshCw,
  REFUNDED: CheckCheck,
};

const REFUND_ICONS: Record<string, React.FC<{ className?: string }>> = {
  PENDING: Clock,
  SUCCEEDED: CheckCircle2,
  FAILED: XCircle,
};

const PAYOUT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  PAID: CheckCircle2,
  SCHEDULED: Clock,
  HELD: Clock,
  CANCELLED: X,
};

const DISPUTE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  OPEN: MessageSquare,
  UNDER_REVIEW: Search,
  RESOLVED: CheckCircle2,
  REJECTED: XCircle,
};

const REVIEW_ICONS: Record<string, React.FC<{ className?: string }>> = {
  PUBLISHED: Star,
  HIDDEN: EyeOff,
  REMOVED: Trash2,
};

const USER_ICONS: Record<string, React.FC<{ className?: string }>> = {
  ACTIVE: CheckCircle2,
  SUSPENDED: Ban,
  DELETED: Trash2,
};

export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}> = ({ children, tone = 'neutral', className, title }) => (
  <span
    title={title}
    className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
      TONE_CLASSES[tone],
      className
    )}
  >
    {children}
  </span>
);

export type StatusKind =
  | 'booking'
  | 'listing'
  | 'payment'
  | 'refund'
  | 'payout'
  | 'dispute'
  | 'review'
  | 'user';

const bookingStatusIcon = (status: BookingStatus): React.FC<{ className?: string }> => {
  const entry = bookingStatusEntry(status, 'host');
  if (entry.tone === 'success') return CheckCircle2;
  if (entry.tone === 'danger') return XCircle;
  if (status === 'PENDING_APPROVAL') return UserCheck;
  if (status === 'PENDING_PAYMENT') return Clock;
  if (status === 'COMPLETED') return CheckCheck;
  return Clock;
};

/** State is always colour plus text, never colour alone (architecture 6.1). */
export const StatusBadge: React.FC<{
  status: string | null | undefined;
  kind: StatusKind;
  viewer?: 'guest' | 'host';
  className?: string;
}> = ({ status, kind, viewer = 'guest', className }) => {
  let entry: StatusEntry;
  let Icon: React.FC<{ className?: string }> | null = null;

  switch (kind) {
    case 'booking':
      entry = status
        ? bookingStatusEntry(status as BookingStatus, viewer)
        : { label: '—', tone: 'neutral' };
      if (status) Icon = bookingStatusIcon(status as BookingStatus);
      break;
    case 'listing':
      entry = statusEntry(listingStatus, status);
      if (status) Icon = LISTING_ICONS[status] ?? null;
      break;
    case 'payment':
      entry = statusEntry(paymentStatus, status);
      if (status) Icon = PAYMENT_ICONS[status] ?? null;
      break;
    case 'refund':
      entry = statusEntry(refundStatus, status);
      if (status) Icon = REFUND_ICONS[status] ?? null;
      break;
    case 'payout':
      entry = statusEntry(payoutStatus, status);
      if (status) Icon = PAYOUT_ICONS[status] ?? null;
      break;
    case 'dispute':
      entry = statusEntry(disputeStatus, status);
      if (status) Icon = DISPUTE_ICONS[status] ?? null;
      break;
    case 'review':
      entry = statusEntry(reviewStatus, status);
      if (status) Icon = REVIEW_ICONS[status] ?? null;
      break;
    case 'user':
      entry = statusEntry(userStatus, status);
      if (status) Icon = USER_ICONS[status] ?? null;
      break;
    default:
      entry = statusEntry({}, status);
  }

  return (
    <Badge tone={entry.tone} className={cn('gap-1.5', className)} title={entry.hint}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span className="leading-none">{entry.label}</span>
    </Badge>
  );
};

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}> = ({ children, className, as = 'div' }) => {
  const Tag = as;
  return (
    <Tag className={cn('rounded-card border border-line bg-surface shadow-card', className)}>{children}</Tag>
  );
};

export const Avatar: React.FC<{
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ name, size = 'md', className }) => (
  <span
    aria-hidden
    className={cn(
      'inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold uppercase text-white shadow-sm ring-2 ring-white/80',
      size === 'sm' && 'h-8 w-8 text-xs',
      size === 'md' && 'h-10 w-10 text-sm',
      size === 'lg' && 'h-14 w-14 text-lg',
      className
    )}
  >
    {name.trim().slice(0, 2)}
  </span>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('skeleton rounded-control bg-sand', className)} aria-hidden />
);

export const Spinner: React.FC<{ className?: string; label?: string }> = ({ className, label }) => (
  <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
    <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden />
    {label ?? 'Loading…'}
  </span>
);

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'accent';
  className?: string;
  valueClassName?: string;
}> = ({ label, value, hint, tone = 'default', className, valueClassName }) => (
  <Card
    className={cn(
      'flex flex-col justify-between p-3 sm:p-3.5 transition-shadow hover:shadow-card-hover min-w-0 overflow-hidden',
      className
    )}
  >
    <div className="min-w-0">
      <p
        className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted leading-snug min-h-[2.25rem] flex items-center"
        title={label}
      >
        {label}
      </p>
      <div
        className={cn(
          'tabular mt-1.5 text-base sm:text-lg font-bold tracking-tight truncate',
          tone === 'accent' ? 'text-accent' : 'text-ink',
          valueClassName
        )}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </div>
    </div>
    {hint && (
      <p
        className="mt-2 text-xs text-muted leading-relaxed line-clamp-2"
        title={typeof hint === 'string' ? hint : undefined}
      >
        {hint}
      </p>
    )}
  </Card>
);

const BANNER_TONES: Record<Tone, { wrapper: string; Icon: typeof Info }> = {
  info: { wrapper: 'border-info/20 bg-info-soft text-info-text', Icon: Info },
  warning: { wrapper: 'border-warning/30 bg-warning-soft text-warning-text', Icon: AlertTriangle },
  danger: { wrapper: 'border-danger/30 bg-danger-soft text-danger-text', Icon: XCircle },
  success: { wrapper: 'border-success/20 bg-success-soft text-success-text', Icon: Info },
  neutral: { wrapper: 'border-neutral/20 bg-neutral-soft text-neutral-text', Icon: Info },
};

export const Banner: React.FC<{
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}> = ({ tone = 'info', title, children, action, icon, className }) => {
  const { wrapper, Icon } = BANNER_TONES[tone];
  return (
    <div role="status" className={cn('flex flex-wrap items-start gap-3 rounded-control border px-4 py-3 text-sm', wrapper, className)}>
      {icon !== undefined ? icon : <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
      </div>
      {action}
    </div>
  );
};