import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import Pagination from '../components/Pagination.jsx';
import FormField from '../components/FormField.jsx';
import { listMyClaims } from '../api/claims.js';
import { CLAIM_STATUS_LABELS } from '../utils/constants.js';
import { formatDate } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';

export default function MyClaims() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ loading: true, claims: [], pagination: null, error: '' });

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    const query = { page, limit: 10 };
    if (status) query.status = status;
    listMyClaims(query)
      .then(({ claims, pagination }) => active && setState({ loading: false, claims, pagination, error: '' }))
      .catch((err) => active && setState({ loading: false, claims: [], pagination: null, error: getErrorMessage(err) }));
    return () => { active = false; };
  }, [status, page, reloadKey]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">My claims</h1>
        <div className="w-48">
          <FormField id="claim-status" label="Status" as="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {Object.entries(CLAIM_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </FormField>
        </div>
      </div>

      <section className="mt-6" aria-live="polite">
        {state.loading && <div role="status" className="h-28 animate-pulse rounded-2xl bg-slate-200" aria-label="Loading your claims" />}
        {!state.loading && state.error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {state.error} <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-medium underline">Try again</button>
          </div>
        )}
        {!state.loading && !state.error && state.claims.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="font-semibold text-slate-900">{status ? 'No claims with this status' : 'You have not claimed anything yet'}</h2>
            <Link to="/items?type=FOUND" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">Browse found items</Link>
          </div>
        )}
        {!state.loading && !state.error && state.claims.length > 0 && (
          <>
            <ul className="space-y-3">
              {state.claims.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div>
                    <StatusBadge status={c.status} />
                    <p className="mt-1 font-semibold text-slate-900">{c.item?.title || 'Item'}</p>
                    <p className="text-xs text-slate-500">Submitted {formatDate(c.createdAt)}</p>
                  </div>
                  <Link to={`/claims/${c.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">View claim</Link>
                </li>
              ))}
            </ul>
            <Pagination page={state.pagination.page} totalPages={state.pagination.totalPages} onChange={setPage} />
          </>
        )}
      </section>
    </main>
  );
}
