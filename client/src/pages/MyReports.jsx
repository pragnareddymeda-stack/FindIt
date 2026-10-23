import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge, { TypeBadge } from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Pagination from '../components/Pagination.jsx';
import FormField from '../components/FormField.jsx';
import { listMyItems, withdrawItem } from '../api/items.js';
import { useToast } from '../hooks/useToast.js';
import { ITEM_STATUS_LABELS } from '../utils/constants.js';
import { formatDate } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';

export default function MyReports() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ loading: true, items: [], pagination: null, error: '' });
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    const query = { page, limit: 10 };
    if (status) query.status = status;
    listMyItems(query)
      .then(({ items, pagination }) => active && setState({ loading: false, items, pagination, error: '' }))
      .catch((err) => active && setState({ loading: false, items: [], pagination: null, error: getErrorMessage(err) }));
    return () => { active = false; };
  }, [status, page, reloadKey]);

  const confirmWithdraw = async () => {
    setBusy(true);
    try {
      await withdrawItem(target.id);
      toast.success('Report withdrawn.');
      setTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">My reports</h1>
        <div className="w-48">
          <FormField id="status-filter" label="Status" as="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </FormField>
        </div>
      </div>

      <section className="mt-6" aria-live="polite">
        {state.loading && <div role="status" className="h-32 animate-pulse rounded-2xl bg-slate-200" aria-label="Loading your reports" />}
        {!state.loading && state.error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {state.error} <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-medium underline">Try again</button>
          </div>
        )}
        {!state.loading && !state.error && state.items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="font-semibold text-slate-900">{status ? 'No reports with this status' : 'You have not posted any reports yet'}</h2>
            <div className="mt-4 flex justify-center gap-4 text-sm font-medium">
              <Link to="/report/lost" className="text-brand-700 hover:underline">Report a lost item</Link>
              <Link to="/report/found" className="text-brand-700 hover:underline">Report a found item</Link>
            </div>
          </div>
        )}
        {!state.loading && !state.error && state.items.length > 0 && (
          <>
            <ul className="space-y-3">
              {state.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><TypeBadge type={item.type} /><StatusBadge status={item.status} /></div>
                    <Link to={`/items/${item.id}`} className="mt-1 block font-semibold text-slate-900 hover:underline">{item.title}</Link>
                    <p className="text-xs text-slate-500">{item.location} · {formatDate(item.dateOccurred)}</p>
                  </div>
                  <div className="flex gap-2 text-sm font-medium">
                    <Link to={`/items/${item.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">View</Link>
                    {item.status === 'ACTIVE' && (
                      <>
                        <Link to={`/items/${item.id}/matches`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">Matches</Link>
                        <Link to={`/items/${item.id}/edit`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">Edit</Link>
                        <button type="button" onClick={() => setTarget(item)} className="rounded-lg border border-red-300 px-3 py-1.5 text-red-700 hover:bg-red-50">Withdraw</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={state.pagination.page} totalPages={state.pagination.totalPages} onChange={setPage} />
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(target)} busy={busy} title="Withdraw this report?"
        message={target ? `"${target.title}" will no longer appear in search results. You cannot undo this.` : ''}
        confirmLabel="Withdraw" onConfirm={confirmWithdraw} onCancel={() => setTarget(null)}
      />
    </main>
  );
}
