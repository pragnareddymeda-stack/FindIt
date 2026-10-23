import { STATUS_LABELS } from '../utils/constants.js';

const STYLES = {
  ACTIVE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  RETURNED: 'bg-brand-50 text-brand-700 border-brand-100',
  CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
  WITHDRAWN: 'bg-slate-100 text-slate-600 border-slate-200',
  HIDDEN: 'bg-red-50 text-red-800 border-red-200',
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-800 border-red-200',
  ARRANGING: 'bg-amber-50 text-amber-800 border-amber-200',
  SCHEDULED: 'bg-sky-50 text-sky-800 border-sky-200',
  HANDED_OVER: 'bg-brand-50 text-brand-700 border-brand-100',
  COMPLETED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  DISPUTED: 'bg-red-50 text-red-800 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[status] || STYLES.CLOSED}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function TypeBadge({ type }) {
  const lost = type === 'LOST';
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${lost ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
      {lost ? 'Lost' : 'Found'}
    </span>
  );
}
