import { useState } from 'react';
import AsyncBoundary from '../../components/AsyncBoundary.jsx';
import Pagination from '../../components/Pagination.jsx';
import ReasonDialog from '../../components/ReasonDialog.jsx';
import FormField from '../../components/FormField.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { listUsers, setUserStatus } from '../../api/admin.js';
import { useRemote } from '../../hooks/useRemote.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { formatDate } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/errors.js';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState({ q: '', role: '', status: '' });
  const [filters, setFilters] = useState({ q: '', role: '', status: '' });
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null); // { user, status }
  const [busy, setBusy] = useState(false);

  const { loading, error, data, reload } = useRemote(() => {
    const query = { page, limit: 20 };
    Object.entries(filters).forEach(([k, v]) => { if (v) query[k] = v; });
    return listUsers(query);
  }, [filters, page]);

  const apply = (e) => { e.preventDefault(); setFilters(draft); setPage(1); };
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const confirm = async (reason) => {
    setBusy(true);
    try {
      await setUserStatus(target.user.id, { status: target.status, ...(reason ? { reason } : {}) });
      toast.success(target.status === 'SUSPENDED' ? 'Account suspended.' : 'Account reactivated.');
      setTarget(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const suspending = target?.status === 'SUSPENDED';
  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-900">Users</h1>
      <form onSubmit={apply} aria-label="User filters" className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <FormField id="u-q" label="Search name or email" value={draft.q} onChange={set('q')} />
        <FormField id="u-role" label="Role" as="select" value={draft.role} onChange={set('role')}>
          <option value="">All</option><option value="USER">User</option><option value="ADMIN">Admin</option>
        </FormField>
        <FormField id="u-status" label="Status" as="select" value={draft.status} onChange={set('status')}>
          <option value="">All</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option>
        </FormField>
        <div className="flex items-end"><button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">Apply</button></div>
      </form>

      <div className="mt-6" aria-live="polite">
        <AsyncBoundary loading={loading} error={error} onRetry={reload} isEmpty={data && data.users.length === 0} empty="No users match these filters." label="Loading users">
          {data && (
            <>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Joined</th><th className="p-3"><span className="sr-only">Actions</span></th></tr>
                  </thead>
                  <tbody>
                    {data.users.map((u) => (
                      <tr key={u.id} className="border-b border-slate-100 last:border-0">
                        <td className="p-3 font-medium text-slate-900">{u.name}</td>
                        <td className="p-3 text-slate-600">{u.email}</td>
                        <td className="p-3">{u.role === 'ADMIN' ? 'Admin' : 'User'}</td>
                        <td className="p-3"><StatusBadge status={u.status === 'ACTIVE' ? 'ACTIVE' : 'HIDDEN'} /> <span className="sr-only">{u.status}</span></td>
                        <td className="p-3 text-slate-600">{formatDate(u.createdAt)}</td>
                        <td className="p-3 text-right">
                          {u.role !== 'ADMIN' && u.id !== me?.id && (
                            u.status === 'ACTIVE'
                              ? <button type="button" onClick={() => setTarget({ user: u, status: 'SUSPENDED' })} className="rounded-lg border border-red-300 px-3 py-1 font-medium text-red-700 hover:bg-red-50">Suspend {u.name}</button>
                              : <button type="button" onClick={() => setTarget({ user: u, status: 'ACTIVE' })} className="rounded-lg border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-50">Reactivate {u.name}</button>
                          )}
                        </td>
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

      <ReasonDialog
        open={Boolean(target)} busy={busy} danger={suspending} required={suspending}
        title={target ? `${suspending ? 'Suspend' : 'Reactivate'} ${target.user.name}?` : ''}
        message={suspending ? 'They will be signed out immediately and cannot log in until reactivated. The reason is saved in the audit log.' : 'They will be able to log in again.'}
        reasonLabel={suspending ? 'Reason for suspension' : 'Note'}
        confirmLabel={suspending ? 'Suspend' : 'Reactivate'} onConfirm={confirm} onCancel={() => setTarget(null)}
      />
    </section>
  );
}
