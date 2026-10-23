import { useState } from 'react';
import { Link } from 'react-router-dom';
import AsyncBoundary from '../../components/AsyncBoundary.jsx';
import Pagination from '../../components/Pagination.jsx';
import ReasonDialog from '../../components/ReasonDialog.jsx';
import FormField from '../../components/FormField.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { listDisputes, resolveDispute } from '../../api/admin.js';
import { useRemote } from '../../hooks/useRemote.js';
import { useToast } from '../../hooks/useToast.js';
import { HANDOVER_STATUS_LABELS } from '../../utils/constants.js';
import { formatDateTime } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/errors.js';

export default function AdminDisputes() {
  const toast = useToast();
  const [state, setState] = useState('open');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null); // { dispute, resolution }
  const [busy, setBusy] = useState(false);

  const { loading, error, data, reload } = useRemote(() => listDisputes({ state, page, limit: 20 }), [state, page]);

  const confirm = async (note) => {
    setBusy(true);
    try {
      await resolveDispute(target.dispute.id, { resolution: target.resolution, note });
      toast.success('Dispute resolved. Both people were notified.');
      setTarget(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const complete = target?.resolution === 'COMPLETE';
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Disputes</h1>
        <div className="w-44">
          <FormField id="dispute-state" label="Show" as="select" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}>
            <option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All</option>
          </FormField>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">Private messages are not visible to administrators. Decide using the reasons and history below, and contact the people through FindIt if needed.</p>

      <div className="mt-6" aria-live="polite">
        <AsyncBoundary loading={loading} error={error} onRetry={reload} isEmpty={data && data.disputes.length === 0} empty={state === 'open' ? 'No open disputes.' : 'Nothing here.'} label="Loading disputes">
          {data && (
            <>
              <ul className="space-y-3">
                {data.disputes.map((d) => (
                  <li key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <StatusBadge status={d.status} />
                        <p className="mt-1 font-semibold text-slate-900">
                          {d.item?.id ? <Link to={`/items/${d.item.id}`} className="hover:underline">{d.item.title}</Link> : 'An item'}
                        </p>
                        <p className="text-sm text-slate-600">Finder: {d.finder?.name} · Claimant: {d.claimant?.name}</p>
                        {d.disputeReason && <p className="mt-2 text-sm text-slate-800">Problem reported: {d.disputeReason}</p>}
                        {d.resolutionNote && <p className="mt-1 text-sm text-slate-600">Decision: {d.resolutionNote}</p>}
                        <ol className="mt-2 space-y-0.5 text-xs text-slate-500">
                          {d.history.map((e, i) => (
                            <li key={`${e.status}-${i}`}>{HANDOVER_STATUS_LABELS[e.status] || e.status} · {e.role.toLowerCase()} · {formatDateTime(e.at)}</li>
                          ))}
                        </ol>
                      </div>
                      {d.status === 'DISPUTED' && (
                        <div className="flex flex-col gap-2 text-sm font-medium">
                          <button type="button" onClick={() => setTarget({ dispute: d, resolution: 'COMPLETE' })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700">Mark as returned</button>
                          <button type="button" onClick={() => setTarget({ dispute: d, resolution: 'CANCEL' })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">Cancel handover</button>
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
        open={Boolean(target)} busy={busy} required danger={!complete}
        title={complete ? 'Mark the item as returned?' : 'Cancel this handover?'}
        message={complete ? 'The report becomes RETURNED and the dispute is closed.' : 'The claim is released so the item can be claimed again.'}
        reasonLabel="Explain your decision (both people will see it)"
        confirmLabel={complete ? 'Mark as returned' : 'Cancel handover'} onConfirm={confirm} onCancel={() => setTarget(null)}
      />
    </section>
  );
}
