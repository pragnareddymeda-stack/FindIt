import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import HandoverDetails from '../src/pages/HandoverDetails.jsx';
import MyHandovers from '../src/pages/MyHandovers.jsx';
import ClaimDetails from '../src/pages/ClaimDetails.jsx';

vi.mock('../src/api/auth.js', () => ({
  fetchMe: vi.fn(), loginRequest: vi.fn(), registerRequest: vi.fn(), logoutRequest: vi.fn(), updateProfileRequest: vi.fn(),
}));
vi.mock('../src/api/handovers.js', () => ({
  createHandover: vi.fn(), listMyHandovers: vi.fn(), getHandover: vi.fn(), updateHandoverStatus: vi.fn(),
}));
vi.mock('../src/api/claims.js', () => ({
  createClaim: vi.fn(), listMyClaims: vi.fn(), listIncomingClaims: vi.fn(), listItemClaims: vi.fn(), getClaim: vi.fn(), decideClaim: vi.fn(), withdrawClaim: vi.fn(),
}));
import { fetchMe } from '../src/api/auth.js';
import { createHandover, listMyHandovers, getHandover, updateHandoverStatus } from '../src/api/handovers.js';
import { getClaim } from '../src/api/claims.js';

const handover = (over = {}) => ({
  id: 'h1', claimId: 'c1', status: 'ARRANGING', viewAs: 'FINDER',
  item: { id: 'i1', title: 'Brown wallet' }, finder: { id: 'u1', name: 'Ravi' }, claimant: { id: 'u2', name: 'Asha' },
  meetingTime: null, meetingPlace: '', note: '', disputeReason: '',
  history: [{ status: 'ARRANGING', role: 'FINDER', at: '2026-10-12T10:00:00.000Z', note: '' }],
  nextActions: ['SCHEDULED', 'HANDED_OVER', 'DISPUTED', 'CANCELLED'], updatedAt: '2026-10-12T10:00:00.000Z', ...over,
});

const wrap = (path, routes) => render(
  <MemoryRouter initialEntries={[path]}>
    <AuthProvider><ToastProvider><Routes>{routes}</Routes></ToastProvider></AuthProvider>
  </MemoryRouter>,
);
const details = () => wrap('/handovers/h1', <Route path="/handovers/:id" element={<HandoverDetails />} />);

beforeEach(() => {
  vi.clearAllMocks();
  fetchMe.mockResolvedValue({ id: 'u1', name: 'Ravi', role: 'USER' });
});

describe('HandoverDetails', () => {
  it('shows the safety advice, the parties and the history', async () => {
    getHandover.mockResolvedValue(handover());
    details();
    expect(await screen.findByText(/busy, well-lit public place/i)).toBeInTheDocument();
    expect(screen.getByText('With Asha')).toBeInTheDocument();
    expect(screen.getByText('No meeting time has been set yet.')).toBeInTheDocument();
  });

  it('validates and submits meeting details', async () => {
    getHandover.mockResolvedValue(handover());
    updateHandoverStatus.mockResolvedValue(handover({ status: 'SCHEDULED', meetingPlace: 'Library main gate' }));
    details();
    fireEvent.click(await screen.findByRole('button', { name: /save meeting details/i }));
    expect(await screen.findByText('Choose a date and time')).toBeInTheDocument();
    expect(screen.getByText('Enter a general meeting place')).toBeInTheDocument();
    expect(updateHandoverStatus).not.toHaveBeenCalled();

    const when = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const local = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T10:00`;
    fireEvent.change(screen.getByLabelText('Meeting date and time'), { target: { value: local } });
    fireEvent.change(screen.getByLabelText('General meeting place'), { target: { value: 'Library main gate' } });
    fireEvent.click(screen.getByRole('button', { name: /save meeting details/i }));
    await waitFor(() => expect(updateHandoverStatus).toHaveBeenCalledWith('h1', {
      status: 'SCHEDULED', meetingTime: new Date(local).toISOString(), meetingPlace: 'Library main gate', note: '',
    }));
  });

  it('rejects a meeting time in the past', async () => {
    getHandover.mockResolvedValue(handover());
    details();
    await screen.findByLabelText('Meeting date and time');
    fireEvent.change(screen.getByLabelText('Meeting date and time'), { target: { value: '2020-01-01T10:00' } });
    fireEvent.change(screen.getByLabelText('General meeting place'), { target: { value: 'Library' } });
    fireEvent.click(screen.getByRole('button', { name: /save meeting details/i }));
    expect(await screen.findByText('Meeting time must be in the future')).toBeInTheDocument();
  });

  it('lets the finder record the handover after confirming', async () => {
    getHandover.mockResolvedValue(handover());
    updateHandoverStatus.mockResolvedValue(handover({ status: 'HANDED_OVER', nextActions: ['DISPUTED'] }));
    details();
    fireEvent.click(await screen.findByRole('button', { name: /i handed the item over/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, i handed it over/i }));
    await waitFor(() => expect(updateHandoverStatus).toHaveBeenCalledWith('h1', { status: 'HANDED_OVER' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /i handed the item over/i })).not.toBeInTheDocument());
  });

  it('only offers the claimant the receipt confirmation once the finder recorded it', async () => {
    getHandover.mockResolvedValue(handover({ viewAs: 'CLAIMANT', status: 'HANDED_OVER', nextActions: ['COMPLETED', 'DISPUTED'] }));
    updateHandoverStatus.mockResolvedValue(handover({ viewAs: 'CLAIMANT', status: 'COMPLETED', nextActions: [] }));
    details();
    expect(screen.queryByRole('button', { name: /i handed the item over/i })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /i received my item/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, i received it/i }));
    await waitFor(() => expect(updateHandoverStatus).toHaveBeenCalledWith('h1', { status: 'COMPLETED' }));
    expect(await screen.findByText(/the item has been returned/i)).toBeInTheDocument();
  });

  it('does not change anything when a confirmation is cancelled', async () => {
    getHandover.mockResolvedValue(handover());
    details();
    fireEvent.click(await screen.findByRole('button', { name: /cancel handover/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^cancel$/i }));
    expect(updateHandoverStatus).not.toHaveBeenCalled();
  });

  it('requires a reason to report a problem', async () => {
    getHandover.mockResolvedValue(handover({ nextActions: ['DISPUTED'] }));
    updateHandoverStatus.mockResolvedValue(handover({ status: 'DISPUTED', disputeReason: 'They never showed up.', nextActions: [] }));
    details();
    fireEvent.click(await screen.findByRole('button', { name: /report a problem/i }));
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));
    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument();
    expect(updateHandoverStatus).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('What went wrong?'), { target: { value: 'They never showed up.' } });
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));
    await waitFor(() => expect(updateHandoverStatus).toHaveBeenCalledWith('h1', { status: 'DISPUTED', reason: 'They never showed up.' }));
    expect(await screen.findByText('This handover is disputed.')).toBeInTheDocument();
  });

  it('shows no action buttons to a read-only viewer', async () => {
    getHandover.mockResolvedValue(handover({ viewAs: 'ADMIN', nextActions: [] }));
    details();
    await screen.findByText(/you are the administrator/i);
    expect(screen.queryByRole('button', { name: /handed|received|cancel|problem|save meeting/i })).not.toBeInTheDocument();
  });

  it('shows a clear message when the handover is not accessible', async () => {
    getHandover.mockRejectedValue({ response: { status: 404, data: { message: 'Handover not found' } } });
    details();
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not have access/i);
  });
});

describe('MyHandovers', () => {
  const list = () => wrap('/handovers', <Route path="/handovers" element={<MyHandovers />} />);

  it('lists handovers with my role', async () => {
    listMyHandovers.mockResolvedValue({ handovers: [handover({ viewAs: 'CLAIMANT' })], pagination: { page: 1, totalPages: 1 } });
    list();
    expect(await screen.findByText('Brown wallet')).toBeInTheDocument();
    expect(screen.getByText(/you are the claimant/i)).toBeInTheDocument();
  });

  it('shows an empty state and an error with retry', async () => {
    listMyHandovers.mockResolvedValueOnce({ handovers: [], pagination: { page: 1, totalPages: 1 } });
    list();
    expect(await screen.findByText('No handovers yet')).toBeInTheDocument();
  });

  it('retries after an error', async () => {
    listMyHandovers.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ handovers: [handover()], pagination: { page: 1, totalPages: 1 } });
    list();
    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Brown wallet')).toBeInTheDocument();
  });
});

describe('starting a handover from an approved claim', () => {
  const claimView = (over = {}) => ({
    claim: {
      id: 'c1', status: 'APPROVED', explanation: 'Mine.', evidence: '', reviewNote: '', createdAt: '2026-10-12T00:00:00.000Z',
      item: { id: 'i1', title: 'Brown wallet' }, claimant: { id: 'u2', name: 'Asha' }, answers: [],
    },
    viewAs: 'FINDER', canHandover: true, handover: null, ...over,
  });
  const page = () => wrap('/claims/c1', (
    <>
      <Route path="/claims/:id" element={<ClaimDetails />} />
      <Route path="/handovers/:id" element={<h1>Handover page</h1>} />
    </>
  ));

  it('offers Start handover and opens the new handover', async () => {
    getClaim.mockResolvedValue(claimView());
    createHandover.mockResolvedValue({ id: 'h1' });
    page();
    fireEvent.click(await screen.findByRole('button', { name: /start handover/i }));
    expect(await screen.findByRole('heading', { name: 'Handover page' })).toBeInTheDocument();
    expect(createHandover).toHaveBeenCalledWith('c1');
  });

  it('links to an existing handover instead', async () => {
    getClaim.mockResolvedValue(claimView({ handover: { id: 'h9', status: 'SCHEDULED' } }));
    page();
    expect(await screen.findByRole('link', { name: /open handover/i })).toHaveAttribute('href', '/handovers/h9');
    expect(screen.queryByRole('button', { name: /start handover/i })).not.toBeInTheDocument();
  });

  it('does not offer it to someone who is not a party (e.g. an administrator)', async () => {
    getClaim.mockResolvedValue(claimView({ canHandover: false }));
    page();
    await screen.findByText(/this claim was approved/i);
    expect(screen.queryByRole('button', { name: /start handover/i })).not.toBeInTheDocument();
  });
});
