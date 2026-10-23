import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import { RealtimeContext } from '../src/context/RealtimeContext.jsx';
import Chat from '../src/pages/Chat.jsx';
import Conversations from '../src/pages/Conversations.jsx';
import Notifications from '../src/pages/Notifications.jsx';
import Navbar from '../src/components/Navbar.jsx';
import ClaimDetails from '../src/pages/ClaimDetails.jsx';

vi.mock('../src/api/auth.js', () => ({
  fetchMe: vi.fn(), loginRequest: vi.fn(), registerRequest: vi.fn(), logoutRequest: vi.fn(), updateProfileRequest: vi.fn(),
}));
vi.mock('../src/api/messages.js', () => ({
  getClaimConversation: vi.fn(), listConversations: vi.fn(), getMessages: vi.fn(), sendMessage: vi.fn(),
}));
vi.mock('../src/api/notifications.js', () => ({
  listNotifications: vi.fn(), fetchUnreadCount: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn(),
}));
vi.mock('../src/api/claims.js', () => ({
  createClaim: vi.fn(), listMyClaims: vi.fn(), listIncomingClaims: vi.fn(), listItemClaims: vi.fn(), getClaim: vi.fn(), decideClaim: vi.fn(), withdrawClaim: vi.fn(),
}));
import { fetchMe } from '../src/api/auth.js';
import { getClaimConversation, listConversations, getMessages, sendMessage } from '../src/api/messages.js';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../src/api/notifications.js';
import { getClaim } from '../src/api/claims.js';

const me = { id: 'u1', name: 'Asha', role: 'USER' };
let handlers;
let rt;

function renderWith(path, routes, rtOverrides = {}) {
  rt = { connected: true, unread: 0, refreshUnread: vi.fn(), emit: vi.fn().mockResolvedValue({ ok: true }), subscribe: vi.fn((event, h) => { handlers[event] = h; return () => {}; }), ...rtOverrides };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ToastProvider>
          <RealtimeContext.Provider value={rt}>
            <Routes>{routes}</Routes>
          </RealtimeContext.Provider>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const msg = (id, text, sender = { id: 'u2', name: 'Ravi' }) => ({ id, conversationId: 'c1', sender, text, createdAt: '2026-10-12T10:00:00.000Z' });
const convo = (over = {}) => ({ id: 'c1', claimId: 'cl1', canSend: true, item: { id: 'i1', title: 'Brown wallet' }, other: { id: 'u2', name: 'Ravi' }, unread: 0, ...over });
const chat = (rtOverrides) => renderWith('/conversations/c1', <Route path="/conversations/:id" element={<Chat />} />, rtOverrides);

beforeEach(() => {
  vi.clearAllMocks();
  handlers = {};
  fetchMe.mockResolvedValue(me);
});

describe('Chat', () => {
  it('shows the history, who sent each message, and the safety advice', async () => {
    getMessages.mockResolvedValue({ messages: [msg('m1', 'Hello there'), msg('m2', 'Hi Ravi', { id: 'u1', name: 'Asha' })], hasMore: false, conversation: convo() });
    chat();
    expect(await screen.findByText('Hello there')).toBeInTheDocument();
    expect(screen.getByText('Hi Ravi')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ravi' })).toBeInTheDocument();
    expect(screen.getByText(/do not share passwords/i)).toBeInTheDocument();
    expect(screen.getByText('Live updates are on.')).toBeInTheDocument();
  });

  it('renders message text as plain text, never as HTML', async () => {
    getMessages.mockResolvedValue({ messages: [msg('m1', '<b>bold</b><img src=x onerror=alert(1)>')], hasMore: false, conversation: convo() });
    const { container } = chat();
    expect(await screen.findByText('<b>bold</b><img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('sends a message, shows it, and clears the box', async () => {
    getMessages.mockResolvedValue({ messages: [], hasMore: false, conversation: convo() });
    sendMessage.mockResolvedValue(msg('m9', 'On my way', { id: 'u1', name: 'Asha' }));
    chat();
    const box = await screen.findByLabelText('Message');
    fireEvent.change(box, { target: { value: '  On my way  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('c1', 'On my way'));
    expect(await screen.findByText('On my way')).toBeInTheDocument();
    expect(box).toHaveValue('');
  });

  it('does not send an empty message', async () => {
    getMessages.mockResolvedValue({ messages: [], hasMore: false, conversation: convo() });
    chat();
    const box = await screen.findByLabelText('Message');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    fireEvent.change(box, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('shows the server error when sending fails and keeps the text', async () => {
    getMessages.mockResolvedValue({ messages: [], hasMore: false, conversation: convo() });
    sendMessage.mockRejectedValue({ response: { status: 429, data: { message: 'You are sending messages too quickly. Please slow down.' } } });
    chat();
    const box = await screen.findByLabelText('Message');
    fireEvent.change(box, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/too quickly/i);
    expect(box).toHaveValue('Hello');
  });

  it('adds live messages for this conversation only, without duplicates', async () => {
    getMessages.mockResolvedValue({ messages: [msg('m1', 'First')], hasMore: false, conversation: convo() });
    chat();
    await screen.findByText('First');
    act(() => handlers['message:new'](msg('m2', 'Live one')));
    expect(await screen.findByText('Live one')).toBeInTheDocument();
    act(() => handlers['message:new'](msg('m2', 'Live one')));
    expect(screen.getAllByText('Live one')).toHaveLength(1);
    act(() => handlers['message:new']({ ...msg('m3', 'Other chat'), conversationId: 'zzz' }));
    expect(screen.queryByText('Other chat')).not.toBeInTheDocument();
    expect(rt.emit).toHaveBeenCalledWith('conversation:read', { conversationId: 'c1' });
  });

  it('says plainly when live updates are not connected', async () => {
    getMessages.mockResolvedValue({ messages: [], hasMore: false, conversation: convo() });
    chat({ connected: false });
    expect(await screen.findByText(/live updates are unavailable/i)).toBeInTheDocument();
  });

  it('is read-only when the claim is no longer active', async () => {
    getMessages.mockResolvedValue({ messages: [msg('m1', 'Old message')], hasMore: false, conversation: convo({ canSend: false }) });
    chat();
    expect(await screen.findByText('Old message')).toBeInTheDocument();
    expect(screen.getByText(/conversation is closed/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
  });

  it('loads earlier messages with a cursor', async () => {
    getMessages
      .mockResolvedValueOnce({ messages: [msg('m5', 'Newest')], hasMore: true, conversation: convo() })
      .mockResolvedValueOnce({ messages: [msg('m4', 'Older')], hasMore: false, conversation: convo() });
    chat();
    fireEvent.click(await screen.findByRole('button', { name: /load earlier messages/i }));
    expect(await screen.findByText('Older')).toBeInTheDocument();
    expect(getMessages).toHaveBeenLastCalledWith('c1', { before: 'm5' });
  });

  it('shows a clear message when the conversation is not accessible', async () => {
    getMessages.mockRejectedValue({ response: { status: 404, data: { message: 'Conversation not found' } } });
    chat();
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not have access/i);
  });
});

describe('Conversations list', () => {
  const list = () => renderWith('/conversations', <Route path="/conversations" element={<Conversations />} />);

  it('shows the other person, the item, the last message and unread count', async () => {
    listConversations.mockResolvedValue({
      conversations: [convo({ unread: 3, lastMessage: { text: 'See you at 5', at: '2026-10-12T10:00:00.000Z', mine: false } })],
      pagination: { page: 1, totalPages: 1 },
    });
    list();
    expect(await screen.findByText('Ravi')).toBeInTheDocument();
    expect(screen.getByText('See you at 5')).toBeInTheDocument();
    expect(screen.getByLabelText('3 unread messages')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ravi/i })).toHaveAttribute('href', '/conversations/c1');
  });

  it('has an empty state and a retry on error', async () => {
    listConversations.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ conversations: [], pagination: { page: 1, totalPages: 1 } });
    list();
    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('No conversations yet')).toBeInTheDocument();
  });
});

describe('Notifications', () => {
  const note = (over = {}) => ({ id: 'n1', type: 'NEW_CLAIM', title: 'New claim on your found item', body: 'Someone claimed "Brown wallet".', link: '/claims/cl1', read: false, updatedAt: '2026-10-12T10:00:00.000Z', ...over });
  const page = () => renderWith('/notifications', (
    <>
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/claims/:id" element={<h1>Claim page</h1>} />
    </>
  ));

  it('lists notifications, marks one read when opened, and goes to its page', async () => {
    listNotifications.mockResolvedValue({ notifications: [note()], unreadCount: 1, pagination: { page: 1, totalPages: 1 } });
    markNotificationRead.mockResolvedValue(note({ read: true }));
    page();
    fireEvent.click(await screen.findByRole('link', { name: /new claim on your found item/i }));
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith('n1'));
    expect(await screen.findByRole('heading', { name: 'Claim page' })).toBeInTheDocument();
    await waitFor(() => expect(rt.refreshUnread).toHaveBeenCalled());
  });

  it('marks everything read', async () => {
    listNotifications.mockResolvedValue({ notifications: [note()], unreadCount: 1, pagination: { page: 1, totalPages: 1 } });
    markAllNotificationsRead.mockResolvedValue(1);
    page();
    fireEvent.click(await screen.findByRole('button', { name: /mark all as read/i }));
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled());
  });

  it('asks the server for unread only when filtered, and shows an empty state', async () => {
    listNotifications.mockResolvedValue({ notifications: [], unreadCount: 0, pagination: { page: 1, totalPages: 1 } });
    page();
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark all as read/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Unread only'));
    await waitFor(() => expect(listNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ unread: 'true' })));
    expect(await screen.findByText('No unread notifications')).toBeInTheDocument();
  });

  it('reloads when a live notification arrives', async () => {
    listNotifications.mockResolvedValue({ notifications: [], unreadCount: 0, pagination: { page: 1, totalPages: 1 } });
    page();
    await screen.findByText('No notifications yet');
    const before = listNotifications.mock.calls.length;
    act(() => handlers['notification:new']({ id: 'n2' }));
    await waitFor(() => expect(listNotifications.mock.calls.length).toBeGreaterThan(before));
  });

  it('shows an error state', async () => {
    listNotifications.mockRejectedValue(new Error('x'));
    page();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
  });
});

describe('Navbar badge', () => {
  const nav = (unread) => renderWith('/', <Route path="/" element={<Navbar />} />, { unread });

  it('shows the unread count next to Notifications', async () => {
    nav(3);
    expect(await screen.findByRole('link', { name: /notifications/i })).toHaveTextContent('3');
    expect(screen.getByLabelText('3 unread')).toBeInTheDocument();
  });

  it('shows no badge when nothing is unread', async () => {
    nav(0);
    expect(await screen.findByRole('link', { name: /^notifications$/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/unread$/)).not.toBeInTheDocument();
  });
});

describe('opening a chat from a claim', () => {
  const claimView = (over = {}) => ({
    claim: { id: 'cl1', status: 'PENDING', explanation: 'Mine.', evidence: '', reviewNote: '', createdAt: '2026-10-12T00:00:00.000Z', item: { id: 'i1', title: 'Brown wallet' }, claimant: { id: 'u2', name: 'Ravi' }, answers: [] },
    viewAs: 'CLAIMANT', canHandover: true, handover: null, ...over,
  });
  const page = () => renderWith('/claims/cl1', (
    <>
      <Route path="/claims/:id" element={<ClaimDetails />} />
      <Route path="/conversations/:id" element={<h1>Chat page</h1>} />
    </>
  ));

  it('opens the conversation for the claim', async () => {
    getClaim.mockResolvedValue(claimView());
    getClaimConversation.mockResolvedValue({ id: 'c9' });
    page();
    fireEvent.click(await screen.findByRole('button', { name: /message the finder/i }));
    expect(await screen.findByRole('heading', { name: 'Chat page' })).toBeInTheDocument();
    expect(getClaimConversation).toHaveBeenCalledWith('cl1');
  });

  it('is not offered to people who are not part of the claim', async () => {
    getClaim.mockResolvedValue(claimView({ canHandover: false }));
    page();
    await screen.findByText('Mine.');
    expect(screen.queryByRole('button', { name: /message the/i })).not.toBeInTheDocument();
  });
});
