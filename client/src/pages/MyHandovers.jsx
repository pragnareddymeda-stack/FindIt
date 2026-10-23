import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import Pagination from '../components/Pagination.jsx';
import FormField from '../components/FormField.jsx';
import { listMyHandovers } from '../api/handovers.js';
import { HANDOVER_STATUS_LABELS } from '../utils/constants.js';
import { formatDateTime } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';

export default function MyHandovers() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ loading: true, handovers: [], pagination: null, error: '' });

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    const query = { page, limit: 10 };
    if (status) query.status = status;
    listMyHandovers(query)
      .then(({ handovers, pagination }) => active && setState({ loading: false, handovers, pagination, error: '' }))
      .catch((err) => active && setState({ loading: false, handovers: [], pagination: null, error: getErrorMessage(err) }));
    return () => { active = false; };
  }, [status, page, reloadKey]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Handovers</h1>
        <div className="w-48">
          <FormField id="handover-status" label="Status" as="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {Object.entries(HANDOVER_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </FormField>
        </div>
      </div>

      <section className="mt-6" aria-live="polite">
        {state.loading && <div role="status" className="h-28 animate-pulse rounded-2xl bg-slate-200" aria-label="Loading handovers" />}
        {!state.loading && state.error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {state.error} <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-medium underline">Try again</button>
          </div>
        )}
        {!state.loading && !state.error && state.handovers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="font-semibold text-slate-900">{status ? 'No handovers with this status' : 'No handovers yet'}</h2>
            <p className="mt-1 text-sm text-slate-600">A handover starts after a claim has been approved.</p>
          </div>
        )}
        {!state.loading && !state.error && state.handovers.length > 0 && (
          <>
            <ul className="space-y-3">
              {state.handovers.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div>
                    <StatusBadge status={h.status} />
                    <p className="mt-1 font-semibold text-slate-900">{h.item?.title || 'Item'}</p>
                    <p className="text-xs text-slate-500">
                      You are the {h.viewAs === 'FINDER' ? 'finder' : 'claimant'}
                      {h.meetingTime ? ` · Meeting ${formatDateTime(h.meetingTime)}` : ''}
                    </p>
                  </div>
                  <Link to={`/handovers/${h.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Open</Link>
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
