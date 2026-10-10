import React from 'react';
import { CalendarClock, CheckCircle2, CircleAlert, Clock3, RefreshCw } from 'lucide-react';
import { GrantStatus } from '../types';

const GRANT_STATUS_PRESENTATION: Record<GrantStatus, {
  label: string;
  className: string;
  Icon: typeof Clock3;
}> = {
  PENDING_REVIEW: {
    label: 'PENDING REVIEW',
    className: 'border-amber-200 bg-amber-50 text-amber-900',
    Icon: Clock3,
  },
  UNDER_COMMITTEE_REVIEW: {
    label: 'UNDER REVIEW',
    className: 'border-blue-200 bg-blue-50 text-blue-900',
    Icon: RefreshCw,
  },
  APPROVED: {
    label: 'APPROVED (PENDING DISBURSEMENT)',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    Icon: CalendarClock,
  },
  DISBURSED: {
    label: 'FUNDS DISBURSED',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    Icon: CheckCircle2,
  },
  REJECTED: {
    label: 'NOT APPROVED',
    className: 'border-red-200 bg-red-50 text-red-900',
    Icon: CircleAlert,
  },
};

export const normalizeGrantStatus = (status: string): GrantStatus => {
  const normalizedStatus = status.toUpperCase().replace(/[_-]+/g, ' ').trim();
  if (normalizedStatus === 'PENDING' || normalizedStatus === 'PENDING REVIEW') return 'PENDING_REVIEW';
  if (['UNDER REVIEW', 'UNDER COMMITTEE REVIEW', 'UNDER COMMITTEE EVALUATION'].includes(normalizedStatus)) {
    return 'UNDER_COMMITTEE_REVIEW';
  }
  if (normalizedStatus === 'APPROVED') return 'APPROVED';
  if (normalizedStatus === 'DISBURSED') return 'DISBURSED';
  if (normalizedStatus === 'REJECTED') return 'REJECTED';
  throw new Error(`Unsupported grant status: ${status}`);
};

interface GrantStatusBadgeProps {
  status: GrantStatus;
  className?: string;
}

export const GrantStatusBadge: React.FC<GrantStatusBadgeProps> = ({ status, className = '' }) => {
  const presentation = GRANT_STATUS_PRESENTATION[status];
  const { Icon } = presentation;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold ${presentation.className} ${className}`}>
      <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${status === 'UNDER_COMMITTEE_REVIEW' ? 'animate-spin' : ''}`} />
      {presentation.label}
    </span>
  );
};
