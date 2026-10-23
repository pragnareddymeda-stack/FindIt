import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import AppRoutes from '../src/routes/AppRoutes.jsx';
import AdminDashboard from '../src/pages/admin/AdminDashboard.jsx';
import AdminUsers from '../src/pages/admin/AdminUsers.jsx';
import AdminReports from '../src/pages/admin/AdminReports.jsx';
import AdminAbuseReports from '../src/pages/admin/AdminAbuseReports.jsx';
import AdminDisputes from '../src/pages/admin/AdminDisputes.jsx';
import AdminAuditLogs from '../src/pages/admin/AdminAuditLogs.jsx';
import ItemDetails from '../src/pages/ItemDetails.jsx';

vi.mock('../src/api/auth.js', () => ({
  fetchMe: vi.fn(), loginRequest: vi.fn(), registerRequest: vi.fn(), logoutRequest: vi.fn(), updateProfileRequest: vi.fn(),
}));
vi.mock('../src/api/health.js', () => ({ getHealth: vi.fn().mockResolvedValue({ status: 'ok', database: 'connected' }) }));
vi.mock('../src/api/admin.js', () => ({
  getDashboard: vi.fn(), listUsers: vi.fn(), setUserStatus: vi.fn(), listReports: vi.fn(), moderateReport: vi.fn(),
  listAbuseReports: vi.fn(), decideAbuseReport: vi.fn(), listDisputes: vi.fn(), resolveDispute: vi.fn(), listAuditLogs: vi.fn(),
}));
vi.mock('../src/api/items.js', () => ({
  listItems: vi.fn(), listMyItems: vi.fn(), getItem: vi.fn(), createItem: vi.fn(), updateItem: vi.fn(), withdrawItem: vi.fn(), getMatches: vi.fn(), reportListing: vi.fn(), uploadItemImage: vi.fn(), deleteItemImage: vi.fn(),
}));
import { fetchMe } from '../src/api/auth.js';
import { getDashboard, listUsers, setUserStatus, listReports, moderateReport, listAbuseReports, decideAbuseReport, listDisputes, resolveDispute, listAuditLogs } from '../src/api/admin.js';
import { getItem, reportListing } from '../src/api/items.js';

const admin = { id: 'a1', name: 'Boss', role: 'ADMIN' };
const pg = { page: 1, totalPages: 1 };

function renderAt(path, routes) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><ToastProvider><Routes>{routes}</Routes></ToastProvider></AuthProvider>
    </MemoryRouter>,
  );
}
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  fetchMe.mockResolvedValue(admin);
});

describe('admin route guard', () => {
  const app = (path) => render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><ToastProvider><AppRoutes /></ToastProvider></AuthProvider>
    </MemoryRouter>,
  );

  it('sends regular users away from /admin', async () => {
    fetchMe.mockResolvedValue({ id: 'u1', name: 'Asha', role: 'USER' });
    app('/admin/users');
    expect(await screen.findByRole('heading', { name: /lost something on campus/i })).toBeInTheDocument();
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('sends signed-out visitors to the login page', async () => {
    fetchMe.mockResolvedValue(null);
    app('/admin');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(getDashboard).not.toHaveBeenCalled();
  });

  it('lets administrators in, with the admin navigation', async () => {
    getDashboard.mockResolvedValue({ totals: {}, categories: [] });
    app('/admin');
    expect(await screen.findByRole('heading', { name: 'Admin dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Audit logs' })).toBeInTheDocument();
  });
});

describe('AdminDashboard', () => {
  const totals = { users: 12, suspendedUsers: 1, activeLost: 5, activeFound: 4, pendingClaims: 3, successfulReturns: 7, awaitingModeration: 2, openDisputes: 1, openAbuseReports: 6 };
  const categories = [
    { category: 'WALLETS_PURSES', lost: 3, found: 2, total: 5 },
    { category: 'KEYS', lost: 0, found: 0, total: 0 },
  ];
  const page = () => renderAt('/admin', <Route path="/admin" element={<AdminDashboard />} />);

  it('shows the numbers the API returned, with links to the queues', async () => {
    getDashboard.mockResolvedValue({ totals, categories });
    page();
    expect(await screen.findByText('Registered users')).toBeInTheDocument();
    const card = (label) => screen.getByText(label).closest('a, div');
    expect(within(card('Registered users')).getByText('12')).toBeInTheDocument();
    expect(within(card('Successful returns')).getByText('7')).toBeInTheDocument();
    expect(within(card('Pending claims')).getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open disputes/i })).toHaveAttribute('href', '/admin/disputes');
    expect(screen.getByRole('link', { name: /awaiting moderation/i })).toHaveAttribute('href', '/admin/reports?flagged=true');
    expect(screen.getByLabelText('3 lost, 2 found')).toBeInTheDocument();
    expect(screen.getByText(/1 account\(s\) currently suspended/i)).toBeInTheDocument();
  });

  it('shows an error and retries', async () => {
    getDashboard.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ totals, categories });
    page();
    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Registered users')).toBeInTheDocument();
  });
});

describe('AdminUsers', () => {
  const users = [
    { id: 'a1', name: 'Boss', email: 'boss@example.com', role: 'ADMIN', status: 'ACTIVE', createdAt: '2026-10-01T00:00:00.000Z' },
    { id: 'a2', name: 'Other Admin', email: 'oa@example.com', role: 'ADMIN', status: 'ACTIVE', createdAt: '2026-10-01T00:00:00.000Z' },
    { id: 'u1', name: 'Maria', email: 'maria@example.com', role: 'USER', status: 'ACTIVE', createdAt: '2026-10-02T00:00:00.000Z' },
    { id: 'u2', name: 'Omar', email: 'omar@example.com', role: 'USER', status: 'SUSPENDED', createdAt: '2026-10-03T00:00:00.000Z' },
  ];
  const page = () => renderAt('/admin/users', <Route path="/admin/users" element={<AdminUsers />} />);

  beforeEach(() => listUsers.mockResolvedValue({ users, pagination: pg }));

  it('offers suspend and reactivate only for regular users', async () => {
    page();
    await screen.findByText('Maria');
    expect(screen.getByRole('button', { name: 'Suspend Maria' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivate Omar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /boss|other admin/i })).not.toBeInTheDocument();
  });

  it('requires a reason to suspend, then calls the API and reloads', async () => {
    setUserStatus.mockResolvedValue({ ...users[2], status: 'SUSPENDED' });
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend Maria' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    expect(await within(dialog).findByText('Enter at least 5 characters')).toBeInTheDocument();
    expect(setUserStatus).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Reason for suspension'), { target: { value: 'Harassing other users' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    await waitFor(() => expect(setUserStatus).toHaveBeenCalledWith('u1', { status: 'SUSPENDED', reason: 'Harassing other users' }));
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(2));
  });

  it('reactivates without needing a reason', async () => {
    setUserStatus.mockResolvedValue({ ...users[3], status: 'ACTIVE' });
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Reactivate Omar' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reactivate' }));
    await waitFor(() => expect(setUserStatus).toHaveBeenCalledWith('u2', { status: 'ACTIVE' }));
  });

  it('does nothing when the dialog is cancelled', async () => {
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend Maria' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(setUserStatus).not.toHaveBeenCalled();
  });

  it('sends the search and filters to the API', async () => {
    page();
    await screen.findByText('Maria');
    type('Search name or email', 'mar');
    type('Status', 'ACTIVE');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'mar', status: 'ACTIVE', page: 1 })));
  });

  it('shows the server error if suspending fails', async () => {
    setUserStatus.mockRejectedValue({ response: { status: 403, data: { message: 'Administrator accounts cannot be suspended from here' } } });
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend Maria' }));
    fireEvent.change(screen.getByLabelText('Reason for suspension'), { target: { value: 'Because reasons' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Suspend' }));
    expect(await screen.findByText(/cannot be suspended from here/i)).toBeInTheDocument();
  });
});

describe('AdminReports', () => {
  const reports = [
    { id: 'r1', type: 'FOUND', status: 'ACTIVE', title: 'Blue umbrella', location: 'Bus stop', owner: { name: 'Ravi' }, createdAt: '2026-10-11T00:00:00.000Z', openAbuseReports: 2 },
    { id: 'r2', type: 'LOST', status: 'HIDDEN', title: 'Old keys', location: 'Gym', owner: { name: 'Asha' }, createdAt: '2026-10-09T00:00:00.000Z', openAbuseReports: 0 },
  ];
  const page = (path = '/admin/reports') => renderAt(path, <Route path="/admin/reports" element={<AdminReports />} />);

  beforeEach(() => listReports.mockResolvedValue({ reports, pagination: pg }));

  it('shows complaint counts and the right action for each status', async () => {
    page();
    expect(await screen.findByText('2 open complaints')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide Blue umbrella' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore Old keys' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore Blue umbrella' })).not.toBeInTheDocument();
  });

  it('requires a reason to hide a report', async () => {
    moderateReport.mockResolvedValue({ ...reports[0], status: 'HIDDEN' });
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Hide Blue umbrella' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide report' }));
    expect(await screen.findByText('Enter at least 5 characters')).toBeInTheDocument();
    expect(moderateReport).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/reason \(shown to the owner\)/i), { target: { value: 'Contains a phone number' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hide report' }));
    await waitFor(() => expect(moderateReport).toHaveBeenCalledWith('r1', { action: 'HIDE', reason: 'Contains a phone number' }));
  });

  it('restores a hidden report without a reason', async () => {
    moderateReport.mockResolvedValue({ ...reports[1], status: 'ACTIVE' });
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Restore Old keys' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore report' }));
    await waitFor(() => expect(moderateReport).toHaveBeenCalledWith('r2', { action: 'UNHIDE' }));
  });

  it('filters to flagged reports', async () => {
    page();
    await screen.findByText('Blue umbrella');
    fireEvent.click(screen.getByLabelText('Flagged only'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(listReports).toHaveBeenLastCalledWith(expect.objectContaining({ flagged: 'true' })));
  });

  it('reads filters from the URL, such as from a dashboard link', async () => {
    page('/admin/reports?flagged=true&type=FOUND');
    await waitFor(() => expect(listReports).toHaveBeenCalledWith(expect.objectContaining({ flagged: 'true', type: 'FOUND' })));
  });
});

describe('AdminAbuseReports', () => {
  const rows = [{
    id: 'ab1', status: 'OPEN', reason: 'SCAM', details: 'Asks for money first', createdAt: '2026-10-12T10:00:00.000Z',
    reporter: { id: 'u3', name: 'Priya' }, item: { id: 'r1', title: 'Blue umbrella', status: 'ACTIVE' },
  }];
  const page = () => renderAt('/admin/abuse-reports', <Route path="/admin/abuse-reports" element={<AdminAbuseReports />} />);

  it('lists complaints with the reason, details and reporter', async () => {
    listAbuseReports.mockResolvedValue({ abuseReports: rows, pagination: pg });
    page();
    expect(await screen.findByText('Scam or fraud')).toBeInTheDocument();
    expect(screen.getByText('Asks for money first')).toBeInTheDocument();
    expect(screen.getByText(/reported by priya/i)).toBeInTheDocument();
  });

  it('dismisses with an optional note and resolves with a note', async () => {
    listAbuseReports.mockResolvedValue({ abuseReports: rows, pagination: pg });
    decideAbuseReport.mockResolvedValue({});
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(decideAbuseReport).toHaveBeenCalledWith('ab1', { status: 'DISMISSED' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Mark resolved' }));
    fireEvent.change(screen.getByLabelText(/note/i), { target: { value: 'Listing hidden' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark resolved' }));
    await waitFor(() => expect(decideAbuseReport).toHaveBeenLastCalledWith('ab1', { status: 'RESOLVED', note: 'Listing hidden' }));
  });

  it('shows an all-clear state', async () => {
    listAbuseReports.mockResolvedValue({ abuseReports: [], pagination: pg });
    page();
    expect(await screen.findByText(/no open abuse reports/i)).toBeInTheDocument();
  });
});

describe('AdminDisputes', () => {
  const dispute = {
    id: 'h1', status: 'DISPUTED', item: { id: 'i1', title: 'Brown wallet' }, finder: { id: 'u1', name: 'Ravi' }, claimant: { id: 'u2', name: 'Asha' },
    disputeReason: 'The finder never turned up.', resolutionNote: '',
    history: [{ status: 'ARRANGING', role: 'FINDER', at: '2026-10-12T10:00:00.000Z' }, { status: 'DISPUTED', role: 'CLAIMANT', at: '2026-10-13T10:00:00.000Z' }],
  };
  const page = () => renderAt('/admin/disputes', <Route path="/admin/disputes" element={<AdminDisputes />} />);

  it('shows both parties, the reason and the history', async () => {
    listDisputes.mockResolvedValue({ disputes: [dispute], pagination: pg });
    page();
    expect(await screen.findByText('Brown wallet')).toBeInTheDocument();
    expect(screen.getByText(/finder: ravi · claimant: asha/i)).toBeInTheDocument();
    expect(screen.getByText(/the finder never turned up/i)).toBeInTheDocument();
    expect(screen.getByText(/private messages are not visible/i)).toBeInTheDocument();
  });

  it('needs a written decision before resolving', async () => {
    listDisputes.mockResolvedValue({ disputes: [dispute], pagination: pg });
    resolveDispute.mockResolvedValue({});
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as returned' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark as returned' }));
    expect(await within(dialog).findByText('Enter at least 5 characters')).toBeInTheDocument();
    expect(resolveDispute).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/explain your decision/i), { target: { value: 'Both confirmed by email' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark as returned' }));
    await waitFor(() => expect(resolveDispute).toHaveBeenCalledWith('h1', { resolution: 'COMPLETE', note: 'Both confirmed by email' }));
  });

  it('can cancel the handover instead', async () => {
    listDisputes.mockResolvedValue({ disputes: [dispute], pagination: pg });
    resolveDispute.mockResolvedValue({});
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel handover' }));
    fireEvent.change(screen.getByLabelText(/explain your decision/i), { target: { value: 'Nobody responded' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel handover' }));
    await waitFor(() => expect(resolveDispute).toHaveBeenCalledWith('h1', { resolution: 'CANCEL', note: 'Nobody responded' }));
  });

  it('shows resolved disputes without action buttons', async () => {
    listDisputes.mockResolvedValue({ disputes: [{ ...dispute, status: 'COMPLETED', resolutionNote: 'Confirmed by email' }], pagination: pg });
    page();
    expect(await screen.findByText(/decision: confirmed by email/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as returned' })).not.toBeInTheDocument();
  });
});

describe('AdminAuditLogs', () => {
  const logs = [{ id: 'l1', action: 'USER_SUSPENDED', summary: 'Suspended Maria: Harassing other users', actor: { id: 'a1', name: 'Boss' }, createdAt: '2026-10-12T10:00:00.000Z' }];
  const page = () => renderAt('/admin/audit-logs', <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />);

  it('lists entries and says they are read-only', async () => {
    listAuditLogs.mockResolvedValue({ logs, pagination: pg });
    page();
    expect(await screen.findByText('Suspended Maria: Harassing other users')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'User suspended' })).toBeInTheDocument();
    expect(screen.getByText(/cannot be edited or deleted/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete|edit/i })).not.toBeInTheDocument();
  });

  it('filters by action', async () => {
    listAuditLogs.mockResolvedValue({ logs, pagination: pg });
    page();
    await screen.findByText(/suspended maria/i);
    type('Action', 'REPORT_HIDDEN');
    await waitFor(() => expect(listAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'REPORT_HIDDEN', page: 1 })));
  });
});

describe('reporting a listing', () => {
  const item = (over = {}) => ({
    id: 'i1', type: 'FOUND', title: 'Blue umbrella', category: 'ACCESSORIES', description: 'Found at the bus stop.',
    dateOccurred: '2026-10-11T00:00:00.000Z', location: 'Bus stop', contactPreference: 'IN_APP', status: 'ACTIVE',
    owner: { id: 'u9', name: 'Ravi' }, isOwner: false, claimQuestions: [{ id: 'q', question: 'Colour?' }], myActiveClaim: null, ...over,
  });
  const page = () => renderAt('/items/i1', <Route path="/items/:id" element={<ItemDetails />} />);

  beforeEach(() => fetchMe.mockResolvedValue({ id: 'u1', name: 'Asha', role: 'USER' }));

  it('lets a signed-in visitor send a report with a reason', async () => {
    getItem.mockResolvedValue(item());
    reportListing.mockResolvedValue({ id: 'ab1' });
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Report this listing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Choose a reason')).toBeInTheDocument();
    expect(reportListing).not.toHaveBeenCalled();
    type('What is wrong with it?', 'SCAM');
    type('More details (optional)', 'Asks for money');
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(reportListing).toHaveBeenCalledWith('i1', { reason: 'SCAM', details: 'Asks for money' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the server message, for example when already reported', async () => {
    getItem.mockResolvedValue(item());
    reportListing.mockRejectedValue({ response: { status: 409, data: { message: 'You have already reported this listing. A moderator will review it.' } } });
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Report this listing' }));
    type('What is wrong with it?', 'SPAM');
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already reported/i);
  });

  it('is not offered to the owner or to signed-out visitors', async () => {
    getItem.mockResolvedValue(item({ isOwner: true, privateDetails: '', verificationQuestions: [] }));
    const first = page();
    await screen.findByText('Blue umbrella');
    expect(screen.queryByRole('button', { name: 'Report this listing' })).not.toBeInTheDocument();
    first.unmount();

    fetchMe.mockResolvedValue(null);
    getItem.mockResolvedValue(item({ claimQuestions: undefined }));
    page();
    await screen.findByText('Blue umbrella');
    expect(screen.queryByRole('button', { name: 'Report this listing' })).not.toBeInTheDocument();
  });
});
