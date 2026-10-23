import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Pagination from '../components/Pagination.jsx';
import { listConversations } from '../api/messages.js';
import { formatDateTime } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';

export default function Conversations() {
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ loading: true, conversations: [], pagination: null, error: '' });

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    listConversations({ page, limit: 15 })
      .then(({ conversations, pagination }) => active && setState({ loading: false, conversations, pagination, error: '' }))
      .catch((err) => active && setState({ loading: false, conversations: [], pagination: null, error: getErrorMessage(err) }));
    return () => { active = false; };
  }, [page, reloadKey]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
      <section className="mt-6" aria-live="polite">
        {state.loading && <div role="status" className="h-28 animate-pulse rounded-2xl bg-slate-200" aria-label="Loading conversations" />}
        {!state.loading && state.error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {state.error} <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-medium underline">Try again</button>
          </div>
        )}
        {!state.loading && !state.error && state.conversations.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="font-semibold text-slate-900">No conversations yet</h2>
            <p className="mt-1 text-sm text-slate-600">You can message the other person from a claim page once a claim exists.</p>
          </div>
        )}
        {!state.loading && !state.error && state.conversations.length > 0 && (
          <>
            <ul className="space-y-3">
              {state.conversations.map((c) => (
                <li key={c.id}>
                  <Link to={`/conversations/${c.id}`} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-500">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{c.other?.name || 'Someone'}</p>
                      <p className="text-xs text-slate-500">About {c.item?.title || 'an item'}</p>
                      <p className="mt-1 truncate text-sm text-slate-600">
                        {c.lastMessage ? `${c.lastMessage.mine ? 'You: ' : ''}${c.lastMessage.text}` : 'No messages yet'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {c.lastMessage && <p className="text-xs text-slate-500">{formatDateTime(c.lastMessage.at)}</p>}
                      {c.unread > 0 && (
                        <span className="mt-1 inline-block rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${c.unread} unread messages`}>{c.unread}</span>
                      )}
                    </div>
                  </Link>
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
