import { Link } from 'react-router-dom';
import AsyncBoundary from '../components/AsyncBoundary.jsx';
import StatusBadge, { TypeBadge } from '../components/StatusBadge.jsx';
import { listMyItems } from '../api/items.js';
import { listMyClaims, listIncomingClaims } from '../api/claims.js';
import { listMyHandovers } from '../api/handovers.js';
import { useAuth } from '../hooks/useAuth.js';
import { useRealtime } from '../hooks/useRealtime.js';
import { useRemote } from '../hooks/useRemote.js';
import { formatDate } from '../utils/format.js';

function Section({ title, to, linkLabel, empty, children, isEmpty }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <Link to={to} className="text-sm font-medium text-brand-700 hover:underline">{linkLabel}</Link>
      </div>
      {isEmpty ? <p className="mt-3 text-sm text-slate-500">{empty}</p> : <ul className="mt-3 space-y-2">{children}</ul>}
    </section>
  );
}

const Row = ({ to, children }) => (
  <li><Link to={to} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">{children}</Link></li>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { unread } = useRealtime();
  const { loading, error, data, reload } = useRemote(async () => {
    const [reports, claims, incoming, handovers] = await Promise.all([
      listMyItems({ status: 'ACTIVE', limit: 5 }),
      listMyClaims({ limit: 5 }),
      listIncomingClaims({ status: 'PENDING', limit: 5 }),
      listMyHandovers({ limit: 5 }),
    ]);
    return { reports, claims, incoming, handovers };
  }, []);

  const primary = 'rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700';
  const secondary = 'rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50';

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name}</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to="/report/lost" className={primary}>Report a lost item</Link>
        <Link to="/report/found" className={secondary}>Report a found item</Link>
        <Link to="/items" className={secondary}>Browse reports</Link>
      </div>

      <div className="mt-8">
        <AsyncBoundary loading={loading} error={error} onRetry={reload} label="Loading your dashboard">
          {data && (
            <>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Active reports', data.reports.pagination.total, '/my-reports'],
                  ['My claims', data.claims.pagination.total, '/my-claims'],
                  ['Claims to review', data.incoming.pagination.total, '/incoming-claims'],
                  ['Unread notifications', unread, '/notifications'],
                ].map(([label, value, to]) => (
                  <Link key={label} to={to} className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-500">
                    <dt className="text-sm text-slate-500">{label}</dt>
                    <dd className="mt-1 text-3xl font-bold text-slate-900">{value}</dd>
                  </Link>
                ))}
              </dl>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <Section title="Your active reports" to="/my-reports" linkLabel="View all" isEmpty={data.reports.items.length === 0} empty="You have no active reports. Report something lost or found to get started.">
                  {data.reports.items.map((i) => (
                    <Row key={i.id} to={`/items/${i.id}`}>
                      <span className="flex items-center gap-2"><TypeBadge type={i.type} />{i.title}</span>
                      <span className="text-xs text-slate-500">{formatDate(i.dateOccurred)}</span>
                    </Row>
                  ))}
                </Section>

                <Section title="Claims waiting for your review" to="/incoming-claims" linkLabel="View all" isEmpty={data.incoming.claims.length === 0} empty="Nobody is waiting on you right now.">
                  {data.incoming.claims.map((c) => (
                    <Row key={c.id} to={`/claims/${c.id}`}>
                      <span>{c.claimant?.name || 'Someone'} claimed {c.item?.title || 'an item'}</span>
                      <span className="text-xs text-slate-500">{formatDate(c.createdAt)}</span>
                    </Row>
                  ))}
                </Section>

                <Section title="Your recent claims" to="/my-claims" linkLabel="View all" isEmpty={data.claims.claims.length === 0} empty="You have not claimed anything yet.">
                  {data.claims.claims.map((c) => (
                    <Row key={c.id} to={`/claims/${c.id}`}>
                      <span>{c.item?.title || 'Item'}</span>
                      <StatusBadge status={c.status} />
                    </Row>
                  ))}
                </Section>

                <Section title="Recent handovers" to="/handovers" linkLabel="View all" isEmpty={data.handovers.handovers.length === 0} empty="No handovers yet. They start after a claim is approved.">
                  {data.handovers.handovers.map((h) => (
                    <Row key={h.id} to={`/handovers/${h.id}`}>
                      <span>{h.item?.title || 'Item'}</span>
                      <StatusBadge status={h.status} />
                    </Row>
                  ))}
                </Section>
              </div>
            </>
          )}
        </AsyncBoundary>
      </div>
    </main>
  );
}
