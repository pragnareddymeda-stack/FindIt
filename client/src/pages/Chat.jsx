import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SafetyNote from '../components/SafetyNote.jsx';
import { getMessages, sendMessage } from '../api/messages.js';
import { useAuth } from '../hooks/useAuth.js';
import { useRealtime } from '../hooks/useRealtime.js';
import { formatDateTime } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';

const MAX_LENGTH = 1000;
const POLL_MS = 10_000;

const mergeById = (existing, incoming) => {
  const seen = new Set(existing.map((m) => m.id));
  return [...existing, ...incoming.filter((m) => !seen.has(m.id))];
};

export default function Chat() {
  const { id } = useParams();
  const { user } = useAuth();
  const { connected, subscribe, emit, refreshUnread } = useRealtime();
  const [state, setState] = useState({ loading: true, messages: [], conversation: null, hasMore: false, error: '' });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    let active = true;
    setState({ loading: true, messages: [], conversation: null, hasMore: false, error: '' });
    getMessages(id)
      .then((data) => {
        if (!active) return;
        setState({ loading: false, messages: data.messages, conversation: data.conversation, hasMore: data.hasMore, error: '' });
        refreshUnread();
      })
      .catch((err) => active && setState({ loading: false, messages: [], conversation: null, hasMore: false, error: err.response?.status === 404 ? 'This conversation does not exist or you do not have access to it.' : getErrorMessage(err) }));
    return () => { active = false; };
  }, [id, refreshUnread]);

  // Live delivery over Socket.IO.
  useEffect(() => subscribe('message:new', (m) => {
    if (m.conversationId !== id) return;
    setState((s) => ({ ...s, messages: mergeById(s.messages, [m]) }));
    if (m.sender?.id !== user?.id) emit('conversation:read', { conversationId: id }).then(refreshUnread).catch(() => {});
  }), [subscribe, emit, refreshUnread, id, user?.id]);

  // No live connection: say so, and refresh on a timer instead.
  const poll = useCallback(async () => {
    try {
      const data = await getMessages(id);
      setState((s) => ({ ...s, messages: mergeById(s.messages, data.messages), conversation: data.conversation }));
    } catch {
      // Try again on the next tick.
    }
  }, [id]);
  useEffect(() => {
    if (connected || state.loading || state.error) return undefined;
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [connected, state.loading, state.error, poll]);

  useEffect(() => { bottomRef.current?.scrollIntoView?.({ block: 'end' }); }, [state.messages.length]);

  const loadOlder = async () => {
    setLoadingOlder(true);
    try {
      const data = await getMessages(id, { before: state.messages[0].id });
      setState((s) => ({ ...s, messages: [...data.messages, ...s.messages], hasMore: data.hasMore }));
    } catch (err) {
      setSendError(getErrorMessage(err));
    } finally {
      setLoadingOlder(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError('');
    try {
      const message = await sendMessage(id, body);
      setState((s) => ({ ...s, messages: mergeById(s.messages, [message]) }));
      setText('');
    } catch (err) {
      setSendError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (state.loading) return <main className="mx-auto max-w-3xl px-4 py-10"><div role="status" className="h-64 animate-pulse rounded-2xl bg-slate-200" aria-label="Loading conversation" /></main>;
  if (state.error) return <main className="mx-auto max-w-3xl px-4 py-10"><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{state.error}</div></main>;

  const { conversation, messages, hasMore } = state;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">{conversation.other?.name}</h1>
        <p className="text-sm text-slate-600">
          About <Link to={`/claims/${conversation.claimId}`} className="font-medium text-brand-700 hover:underline">{conversation.item?.title}</Link>
        </p>
        <p className={`mt-1 text-xs ${connected ? 'text-emerald-700' : 'text-amber-700'}`} role="status">
          {connected ? 'Live updates are on.' : 'Live updates are unavailable. This page refreshes every 10 seconds.'}
        </p>
      </header>

      <SafetyNote>Do not share passwords, OTPs or payment details, and keep your phone number private until you are comfortable.</SafetyNote>

      <section aria-label="Messages" className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
        {hasMore && (
          <button type="button" onClick={loadOlder} disabled={loadingOlder} className="mx-auto block text-sm font-medium text-brand-700 hover:underline disabled:opacity-60">
            {loadingOlder ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}
        {messages.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No messages yet. Say hello.</p>}
        <ul className="space-y-3">
          {messages.map((m) => {
            const mine = m.sender?.id === user?.id;
            return (
              <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${mine ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-900'}`}>
                  {!mine && <p className="text-xs font-semibold text-slate-500">{m.sender?.name}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`mt-1 text-[11px] ${mine ? 'text-brand-100' : 'text-slate-500'}`}>{formatDateTime(m.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={bottomRef} />
      </section>

      {conversation.canSend ? (
        <form onSubmit={submit} className="mt-4 space-y-2">
          {sendError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{sendError}</div>}
          <label htmlFor="message" className="sr-only">Message</label>
          <textarea
            id="message" rows={3} maxLength={MAX_LENGTH} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{text.length}/{MAX_LENGTH}</span>
            <button type="submit" disabled={sending || !text.trim()} className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      ) : (
        <div role="status" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          This conversation is closed because the claim is no longer active. You can still read it.
        </div>
      )}
    </main>
  );
}
