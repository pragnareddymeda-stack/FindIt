import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Pagination from '../components/Pagination.jsx';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notifications.js';
import { useRealtime } from '../hooks/useRealtime.js';
import { useToast } from '../hooks/useToast.js';
import { formatDateTime } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';

export default function Notifications() {
  const { refreshUnread, subscribe } = useRealtime();
  const toast = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ loading: true, notifications: [], unreadCount: 0, pagination: null, error: '' });

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    const query = { page, limit: 15 };
    if (unreadOnly) query.unread = 'true';
    listNotifications(query)
      .then(({ notifications, unreadCount, pagination }) => active && setState({ loading: false, notifications, unreadCount, pagination, error: '' }))
      .catch((err) => active && setState({ loading: false, notifications: [], unreadCount: 0, pagination: null, error: getErrorMessage(err) }));
    return () => { active = false; };
  }, [page, unreadOnly, reloadKey]);

  // A new notification arrived while this page is open: reload the list.
  useEffect(() => subscribe('notification:new', () => setReloadKey((k) => k + 1)), [subscribe]);

  const open = (n) => {
    if (n.read) return;
    setState((s) => ({
      ...s,
      unreadCount: Math.max(0, s.unreadCount - 1),
      notifications: s.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
    }));
    markNotificationRead(n.id).then(refreshUnread).catch(() => {});
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      toast.success('All notifications marked as read.');
      setReloadKey((k) => k + 1);
      refreshUnread();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} />
            Unread only
          </label>
          <button type="button" onClick={markAll} disabled={state.unreadCount === 0} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Mark all as read
          </button>
        </div>
      </div>

      <section className="mt-6" aria-live="polite">
        {state.loading && <div role="status" className="h-28 animate-pulse rounded-2xl bg-slate-200" aria-label="Loading notifications" />}
        {!state.loading && state.error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {state.error} <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-medium underline">Try again</button>
          </div>
        )}
        {!state.loading && !state.error && state.notifications.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="font-semibold text-slate-900">{unreadOnly ? 'No unread notifications' : 'No notifications yet'}</h2>
            <p className="mt-1 text-sm text-slate-600">Claims, messages and handover updates will show up here.</p>
          </div>
        )}
        {!state.loading && !state.error && state.notifications.length > 0 && (
          <>
            <ul className="space-y-2">
              {state.notifications.map((n) => {
                const body = (
                  <>
                    <div className="flex items-center gap-2">
                      {!n.read && <span className="h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />}
                      <span className={`font-semibold ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</span>
                    </div>
                    {n.body && <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>}
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(n.updatedAt)}</p>
                  </>
                );
                const cls = `block rounded-2xl border p-4 ${n.read ? 'border-slate-200 bg-white' : 'border-brand-100 bg-brand-50/50'}`;
                return (
                  <li key={n.id}>
                    {n.link?.startsWith('/')
                      ? <Link to={n.link} onClick={() => open(n)} className={`${cls} hover:border-brand-500`}>{body}</Link>
                      : <div className={cls}>{body}</div>}
                  </li>
                );
              })}
            </ul>
            <Pagination page={state.pagination.page} totalPages={state.pagination.totalPages} onChange={setPage} />
          </>
        )}
      </section>
    </main>
  );
}
