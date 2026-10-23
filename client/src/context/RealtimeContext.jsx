import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { createSocket } from '../realtime/socket.js';
import { fetchUnreadCount } from '../api/notifications.js';

export const RealtimeContext = createContext(null);

const UNREAD_POLL_MS = 60_000;

/**
 * Connects a Socket.IO client while someone is signed in and shares: whether live updates are really connected,
 * the unread notification count, and a tiny pub/sub for server events. If the socket cannot connect, `connected`
 * stays false and pages fall back to polling instead of pretending updates are live.
 */
export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);
  const socketRef = useRef(null);
  const listeners = useRef(new Map());

  const subscribe = useCallback((event, handler) => {
    const set = listeners.current.get(event) ?? new Set();
    set.add(handler);
    listeners.current.set(event, set);
    return () => set.delete(handler);
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      setUnread(await fetchUnreadCount());
    } catch {
      // Keep the previous count; the next refresh will try again.
    }
  }, []);

  const emit = useCallback(
    (event, payload) =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) return reject(new Error('Live connection unavailable'));
        return socket.emit(event, payload, (ack) => (ack?.ok ? resolve(ack) : reject(new Error(ack?.error || 'Request failed'))));
      }),
    [],
  );

  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setUnread(0);
      setConnected(false);
      return undefined;
    }
    let active = true;
    refreshUnread();

    const socket = createSocket();
    socketRef.current = socket;
    const dispatch = (event, payload) => listeners.current.get(event)?.forEach((h) => h(payload));
    socket.on('connect', () => active && setConnected(true));
    socket.on('disconnect', () => active && setConnected(false));
    socket.on('connect_error', () => active && setConnected(false));
    socket.on('notification:new', (n) => {
      if (!active) return;
      if (window.location.pathname !== n.link) toast.success(n.title); // no pop-up for the chat you are looking at
      refreshUnread();
      dispatch('notification:new', n);
    });
    socket.on('message:new', (m) => active && dispatch('message:new', m));

    return () => {
      active = false;
      socketRef.current = null;
      socket.disconnect();
    };
    // toast and refreshUnread are stable; reconnect only when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Without a live connection, keep the unread badge fresh by polling.
  useEffect(() => {
    if (!userId || connected) return undefined;
    const timer = setInterval(refreshUnread, UNREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [userId, connected, refreshUnread]);

  const value = useMemo(() => ({ connected, unread, subscribe, emit, refreshUnread }), [connected, unread, subscribe, emit, refreshUnread]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
