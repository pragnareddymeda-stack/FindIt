import { useState } from 'react';
import { Link } from 'react-router-dom';
import AsyncBoundary from '../../components/AsyncBoundary.jsx';
import Pagination from '../../components/Pagination.jsx';
import ReasonDialog from '../../components/ReasonDialog.jsx';
import FormField from '../../components/FormField.jsx';
import { listAbuseReports, decideAbuseReport } from '../../api/admin.js';
import { useRemote } from '../../hooks/useRemote.js';
import { useToast } from '../../hooks/useToast.js';
import { abuseReasonLabel } from '../../utils/constants.js';
import { formatDateTime } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/errors.js';

export default function AdminAbuseReports() {
  const toast = useToast();
  const [status, setStatus] = useState('OPEN');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null); // { report, status }
  const [busy, setBusy] = useState(false);

  const { loading, error, data, reload } = useRemote(() => listAbuseReports({ status, page, limit: 20 }), [status, page]);

  const confirm = async (note) => {
    setBusy(true);
    try {
      await decideAbuseReport(target.report.id, { status: target.status, ...(note ? { note } : {}) });
      toast.success(target.status === 'RESOLVED' ? 'Marked as resolved.' : 'Complaint dismissed.');
      setTarget(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Abuse reports</h1>
        <div className="w-44">
          <FormField id="abuse-status" label="Status" as="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="OPEN">Open</option><option value="RESOLVED">Resolved</option><option value="DISMISSED">Dismissed</option>
          </FormField>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">To remove a listing, hide it on the <Link to="/admin/reports?flagged=true" className="font-medium text-brand-700 hover:underline">Reports page</Link>. Hiding closes its open complaints.</p>

      <div className="mt-6" aria-live="polite">
        <AsyncBoundary loading={loading} error={error} onRetry={reload} isEmpty={data && data.abuseReports.length === 0} empty={status === 'OPEN' ? 'No open abuse reports. All clear.' : 'Nothing here.'} label="Loading abuse reports">
          {data && (
            <>
              <ul className="space-y-3">
                {data.abuseReports.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{abuseReasonLabel(r.reason)}</p>
                        <p className="text-sm text-slate-600">
                          About <Link to={`/items/${r.item.id}`} className="font-medium text-brand-700 hover:underline">{r.item.title ?? 'a listing'}</Link>
                          {r.item.status && <span className="text-slate-500"> ({r.item.status.toLowerCase()})</span>}
                        </p>
                        {r.details && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{r.details}</p>}
                        <p className="mt-2 text-xs text-slate-500">Reported by {r.reporter?.name || 'a user'} · {formatDateTime(r.createdAt)}</p>
                        {r.resolutionNote && <p className="mt-1 text-xs text-slate-500">Note: {r.resolutionNote}</p>}
                      </div>
                      {r.status === 'OPEN' && (
                        <div className="flex gap-2 text-sm font-medium">
                          <button type="button" onClick={() => setTarget({ report: r, status: 'DISMISSED' })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">Dismiss</button>
                          <button type="button" onClick={() => setTarget({ report: r, status: 'RESOLVED' })} className="rounded-lg bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700">Mark resolved</button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
            </>
          )}
        </AsyncBoundary>
      </div>

      <ReasonDialog
        open={Boolean(target)} busy={busy}
        title={target ? `${target.status === 'RESOLVED' ? 'Resolve' : 'Dismiss'} this complaint?` : ''}
        reasonLabel="Note" confirmLabel={target?.status === 'RESOLVED' ? 'Mark resolved' : 'Dismiss'}
        onConfirm={confirm} onCancel={() => setTarget(null)}
      />
    </section>
  );
}
