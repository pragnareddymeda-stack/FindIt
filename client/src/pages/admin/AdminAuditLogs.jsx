import { useState } from 'react';
import AsyncBoundary from '../../components/AsyncBoundary.jsx';
import Pagination from '../../components/Pagination.jsx';
import FormField from '../../components/FormField.jsx';
import { listAuditLogs } from '../../api/admin.js';
import { useRemote } from '../../hooks/useRemote.js';
import { AUDIT_ACTION_LABELS } from '../../utils/constants.js';
import { formatDateTime } from '../../utils/format.js';

export default function AdminAuditLogs() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { loading, error, data, reload } = useRemote(() => {
    const query = { page, limit: 25 };
    if (action) query.action = action;
    return listAuditLogs(query);
  }, [action, page]);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Audit logs</h1>
        <div className="w-56">
          <FormField id="audit-action" label="Action" as="select" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="">All actions</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </FormField>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">Read-only. Entries cannot be edited or deleted.</p>

      <div className="mt-6" aria-live="polite">
        <AsyncBoundary loading={loading} error={error} onRetry={reload} isEmpty={data && data.logs.length === 0} empty="No audit entries yet." label="Loading audit logs">
          {data && (
            <>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Details</th></tr>
                  </thead>
                  <tbody>
                    {data.logs.map((l) => (
                      <tr key={l.id} className="border-b border-slate-100 align-top last:border-0">
                        <td className="whitespace-nowrap p-3 text-slate-600">{formatDateTime(l.createdAt)}</td>
                        <td className="p-3 text-slate-900">{l.actor?.name || 'Unknown'}</td>
                        <td className="whitespace-nowrap p-3">{AUDIT_ACTION_LABELS[l.action] || l.action}</td>
                        <td className="p-3 text-slate-700">{l.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
            </>
          )}
        </AsyncBoundary>
      </div>
    </section>
  );
}
