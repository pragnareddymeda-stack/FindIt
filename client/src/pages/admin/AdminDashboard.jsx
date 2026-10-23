import { Link } from 'react-router-dom';
import AsyncBoundary from '../../components/AsyncBoundary.jsx';
import { getDashboard } from '../../api/admin.js';
import { useRemote } from '../../hooks/useRemote.js';
import { categoryLabel } from '../../utils/constants.js';

const CARDS = [
  ['users', 'Registered users', '/admin/users'],
  ['activeLost', 'Active lost reports', '/admin/reports?type=LOST&status=ACTIVE'],
  ['activeFound', 'Active found reports', '/admin/reports?type=FOUND&status=ACTIVE'],
  ['pendingClaims', 'Pending claims', null],
  ['successfulReturns', 'Successful returns', '/admin/reports?status=RETURNED'],
  ['awaitingModeration', 'Reports awaiting moderation', '/admin/reports?flagged=true'],
  ['openDisputes', 'Open disputes', '/admin/disputes'],
  ['openAbuseReports', 'Open abuse reports', '/admin/abuse-reports'],
];

export default function AdminDashboard() {
  const { loading, error, data, reload } = useRemote(() => getDashboard(), []);

  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-900">Admin dashboard</h1>
      <div className="mt-6">
        <AsyncBoundary loading={loading} error={error} onRetry={reload} label="Loading dashboard">
          {data && (
            <>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {CARDS.map(([key, label, href]) => {
                  const inner = (
                    <>
                      <dt className="text-sm text-slate-500">{label}</dt>
                      <dd className="mt-1 text-3xl font-bold text-slate-900">{data.totals[key]}</dd>
                    </>
                  );
                  const cls = 'rounded-2xl border border-slate-200 bg-white p-4';
                  return href
                    ? <Link key={key} to={href} className={`${cls} block hover:border-brand-500`}>{inner}</Link>
                    : <div key={key} className={cls}>{inner}</div>;
                })}
              </dl>
              {data.totals.suspendedUsers > 0 && <p className="mt-3 text-sm text-slate-500">{data.totals.suspendedUsers} account(s) currently suspended.</p>}

              <h2 className="mt-8 font-semibold text-slate-900">Reports by category</h2>
              <p className="text-xs text-slate-500">Excludes withdrawn and hidden reports.</p>
              <ul className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
                {(() => {
                  const max = Math.max(1, ...data.categories.map((c) => c.total));
                  return data.categories.map((c) => (
                    <li key={c.category} className="flex items-center gap-3 text-sm">
                      <span className="w-40 shrink-0 text-slate-700">{categoryLabel(c.category)}</span>
                      <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${c.lost} lost, ${c.found} found`}>
                        <div className="bg-amber-400" style={{ width: `${(c.lost / max) * 100}%` }} />
                        <div className="bg-sky-500" style={{ width: `${(c.found / max) * 100}%` }} />
                      </div>
                      <span className="w-24 shrink-0 text-right text-slate-600">{c.lost} lost · {c.found} found</span>
                    </li>
                  ));
                })()}
              </ul>
            </>
          )}
        </AsyncBoundary>
      </div>
    </section>
  );
}
