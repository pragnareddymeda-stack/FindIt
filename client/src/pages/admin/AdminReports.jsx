import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AsyncBoundary from '../../components/AsyncBoundary.jsx';
import Pagination from '../../components/Pagination.jsx';
import ReasonDialog from '../../components/ReasonDialog.jsx';
import FormField from '../../components/FormField.jsx';
import StatusBadge, { TypeBadge } from '../../components/StatusBadge.jsx';
import { listReports, moderateReport } from '../../api/admin.js';
import { useRemote } from '../../hooks/useRemote.js';
import { useToast } from '../../hooks/useToast.js';
import { ITEM_STATUS_LABELS } from '../../utils/constants.js';
import { formatDate } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/errors.js';

const KEYS = ['q', 'type', 'status', 'flagged'];

export default function AdminReports() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(KEYS.map((k) => [k, params.get(k) || '']));
  const page = Number(params.get('page')) || 1;
  const [draft, setDraft] = useState(filters);
  const [target, setTarget] = useState(null); // { report, action }
  const [busy, setBusy] = useState(false);

  const { loading, error, data, reload } = useRemote(() => {
    const query = { page, limit: 20 };
    KEYS.forEach((k) => { if (filters[k]) query[k] = filters[k]; });
    return listReports(query);
  }, [params.toString()]);

  const apply = (e) => {
    e.preventDefault();
    const next = new URLSearchParams();
    KEYS.forEach((k) => { if (draft[k]) next.set(k, draft[k]); });
    setParams(next);
  };
  const goTo = (p) => { const next = new URLSearchParams(params); next.set('page', String(p)); setParams(next); };
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const confirm = async (reason) => {
    setBusy(true);
    try {
      await moderateReport(target.report.id, { action: target.action, ...(reason ? { reason } : {}) });
      toast.success(target.action === 'HIDE' ? 'Report hidden.' : 'Report restored.');
      setTarget(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const hiding = target?.action === 'HIDE';
  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-900">Report moderation</h1>
      <form onSubmit={apply} aria-label="Report filters" className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-5">
        <FormField id="r-q" label="Keyword" value={draft.q} onChange={set('q')} />
        <FormField id="r-type" label="Type" as="select" value={draft.type} onChange={set('type')}>
          <option value="">All</option><option value="LOST">Lost</option><option value="FOUND">Found</option>
        </FormField>
        <FormField id="r-status" label="Status" as="select" value={draft.status} onChange={set('status')}>
          <option value="">All</option>
          {Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </FormField>
        <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={draft.flagged === 'true'} onChange={(e) => setDraft((d) => ({ ...d, flagged: e.target.checked ? 'true' : '' }))} />
          Flagged only
        </label>
        <div className="flex items-end"><button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">Apply</button></div>
      </form>

      <div className="mt-6" aria-live="polite">
        <AsyncBoundary loading={loading} error={error} onRetry={reload} isEmpty={data && data.reports.length === 0} empty="No reports match these filters." label="Loading reports">
          {data && (
            <>
              <ul className="space-y-3">
                {data.reports.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <TypeBadge type={r.type} /><StatusBadge status={r.status} />
                        {r.openAbuseReports > 0 && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">{r.openAbuseReports} open complaint{r.openAbuseReports === 1 ? '' : 's'}</span>}
                      </div>
                      <Link to={`/items/${r.id}`} className="mt-1 block font-semibold text-slate-900 hover:underline">{r.title}</Link>
                      <p className="text-xs text-slate-500">By {r.owner?.name || 'unknown'} · {r.location} · {formatDate(r.createdAt)}</p>
                    </div>
                    <div>
                      {r.status === 'ACTIVE' && <button type="button" onClick={() => setTarget({ report: r, action: 'HIDE' })} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">Hide {r.title}</button>}
                      {r.status === 'HIDDEN' && <button type="button" onClick={() => setTarget({ report: r, action: 'UNHIDE' })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Restore {r.title}</button>}
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={goTo} />
            </>
          )}
        </AsyncBoundary>
      </div>

      <ReasonDialog
        open={Boolean(target)} busy={busy} danger={hiding} required={hiding}
        title={target ? `${hiding ? 'Hide' : 'Restore'} "${target.report.title}"?` : ''}
        message={hiding ? 'It disappears from search and public pages. The owner is told why, and open complaints about it are closed.' : 'It becomes visible to everyone again.'}
        reasonLabel={hiding ? 'Reason (shown to the owner)' : 'Note'}
        confirmLabel={hiding ? 'Hide report' : 'Restore report'} onConfirm={confirm} onCancel={() => setTarget(null)}
      />
    </section>
  );
}
