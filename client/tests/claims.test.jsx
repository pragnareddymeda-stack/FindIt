import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import ClaimForm from '../src/pages/ClaimForm.jsx';
import ClaimDetails from '../src/pages/ClaimDetails.jsx';
import MatchSuggestions from '../src/pages/MatchSuggestions.jsx';
import ItemDetails from '../src/pages/ItemDetails.jsx';

vi.mock('../src/api/auth.js', () => ({
  fetchMe: vi.fn(), loginRequest: vi.fn(), registerRequest: vi.fn(), logoutRequest: vi.fn(), updateProfileRequest: vi.fn(),
}));
vi.mock('../src/api/items.js', () => ({
  listItems: vi.fn(), listMyItems: vi.fn(), getItem: vi.fn(), createItem: vi.fn(), updateItem: vi.fn(), withdrawItem: vi.fn(), getMatches: vi.fn(), reportListing: vi.fn(), uploadItemImage: vi.fn(), deleteItemImage: vi.fn(),
}));
vi.mock('../src/api/claims.js', () => ({
  createClaim: vi.fn(), listMyClaims: vi.fn(), listIncomingClaims: vi.fn(), listItemClaims: vi.fn(), getClaim: vi.fn(), decideClaim: vi.fn(), withdrawClaim: vi.fn(),
}));
import { fetchMe } from '../src/api/auth.js';
import { getItem, getMatches } from '../src/api/items.js';
import { createClaim, getClaim, decideClaim, withdrawClaim } from '../src/api/claims.js';

const me = { id: 'u1', name: 'Asha', email: 'asha@example.com', role: 'USER' };

function renderAt(path, routes) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {routes}
            <Route path="/claims/:id" element={<h1>Claim page</h1>} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const foundItem = (over = {}) => ({
  id: 'i1', type: 'FOUND', title: 'Brown wallet', category: 'WALLETS_PURSES', description: 'Found at the cafeteria bench.',
  dateOccurred: '2026-10-11T00:00:00.000Z', location: 'Cafeteria', contactPreference: 'IN_APP', status: 'ACTIVE',
  owner: { id: 'u2', name: 'Ravi' }, isOwner: false, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchMe.mockResolvedValue(me);
});

describe('ItemDetails claim entry point', () => {
  const routes = <Route path="/items/:id" element={<ItemDetails />} />;

  it('offers a claim link to a signed-in non-owner of an active found item', async () => {
    getItem.mockResolvedValue(foundItem({ claimQuestions: [{ id: 'q1', question: 'Which card?' }], myActiveClaim: null }));
    renderAt('/items/i1', routes);
    expect(await screen.findByRole('link', { name: /claim this item/i })).toHaveAttribute('href', '/items/i1/claim');
  });

  it('shows the existing claim instead of a second claim button', async () => {
    getItem.mockResolvedValue(foundItem({ claimQuestions: [{ id: 'q1', question: 'Which card?' }], myActiveClaim: { id: 'c9', status: 'PENDING' } }));
    renderAt('/items/i1', routes);
    expect(await screen.findByRole('link', { name: /view your claim/i })).toHaveAttribute('href', '/claims/c9');
    expect(screen.queryByRole('link', { name: /claim this item/i })).not.toBeInTheDocument();
  });

  it('shows review links, not a claim button, to the owner', async () => {
    getItem.mockResolvedValue(foundItem({ isOwner: true, privateDetails: '', verificationQuestions: [], pendingClaimCount: 2 }));
    renderAt('/items/i1', routes);
    expect(await screen.findByRole('link', { name: /review claims \(2 pending\)/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /claim this item/i })).not.toBeInTheDocument();
  });

  it('asks signed-out visitors to log in', async () => {
    fetchMe.mockResolvedValue(null);
    getItem.mockResolvedValue(foundItem());
    renderAt('/items/i1', routes);
    expect(await screen.findByRole('link', { name: /log in to claim/i })).toBeInTheDocument();
  });
});

describe('ClaimForm', () => {
  const routes = <Route path="/items/:id/claim" element={<ClaimForm />} />;
  const item = foundItem({ claimQuestions: [{ id: 'q1', question: 'Which bank card is inside?' }, { id: 'q2', question: 'Lining colour?' }], myActiveClaim: null });

  it('requires an explanation and an answer to every question', async () => {
    getItem.mockResolvedValue(item);
    renderAt('/items/i1/claim', routes);
    fireEvent.click(await screen.findByRole('button', { name: /submit claim/i }));
    expect(await screen.findByText(/explain why this item is yours/i)).toBeInTheDocument();
    expect(screen.getAllByText('Answer this question')).toHaveLength(2);
    expect(createClaim).not.toHaveBeenCalled();
  });

  it('submits explanation, answers and evidence, then opens the claim', async () => {
    getItem.mockResolvedValue(item);
    createClaim.mockResolvedValue({ id: 'c1' });
    renderAt('/items/i1/claim', routes);
    await screen.findByText('Which bank card is inside?');
    fireEvent.change(screen.getByLabelText('Why does this item belong to you?'), { target: { value: 'I lost it on Friday evening.' } });
    fireEvent.change(screen.getByLabelText('Which bank card is inside?'), { target: { value: 'HDFC' } });
    fireEvent.change(screen.getByLabelText('Lining colour?'), { target: { value: 'Red' } });
    fireEvent.click(screen.getByRole('button', { name: /submit claim/i }));
    expect(await screen.findByRole('heading', { name: 'Claim page' })).toBeInTheDocument();
    expect(createClaim).toHaveBeenCalledWith('i1', {
      explanation: 'I lost it on Friday evening.',
      answers: [{ questionId: 'q1', answer: 'HDFC' }, { questionId: 'q2', answer: 'Red' }],
      evidence: '',
    });
  });

  it('explains when the item cannot be claimed', async () => {
    getItem.mockResolvedValue(foundItem({ isOwner: true }));
    renderAt('/items/i1/claim', routes);
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot be claimed/i);
  });
});

describe('ClaimDetails', () => {
  const routes = <Route path="/claims/:id" element={<ClaimDetails />} />;
  const claim = (over = {}) => ({
    id: 'c1', status: 'PENDING', explanation: 'It is mine.', evidence: '', reviewNote: '', createdAt: '2026-10-12T00:00:00.000Z',
    item: { id: 'i1', title: 'Brown wallet' }, claimant: { id: 'u1', name: 'Asha' },
    answers: [{ questionId: 'q1', question: 'Which bank card?', answer: 'HDFC', expectedAnswer: 'HDFC' }], ...over,
  });

  const renderClaim = () => render(
    <MemoryRouter initialEntries={['/claims/c1']}>
      <AuthProvider><ToastProvider><Routes>{routes}</Routes></ToastProvider></AuthProvider>
    </MemoryRouter>,
  );

  it('lets the finder compare answers and approve after confirming', async () => {
    getClaim.mockResolvedValue({ claim: claim(), viewAs: 'FINDER' });
    decideClaim.mockResolvedValue({ claim: claim({ status: 'APPROVED', reviewNote: 'Looks right.' }), viewAs: 'FINDER' });
    renderClaim();
    expect(await screen.findByText(/your expected answer: hdfc/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/note to the claimant/i), { target: { value: 'Looks right.' } });
    fireEvent.click(screen.getByRole('button', { name: /approve claim/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^approve$/i }));
    await waitFor(() => expect(decideClaim).toHaveBeenCalledWith('c1', { decision: 'APPROVED', reviewNote: 'Looks right.' }));
    expect(await screen.findByText('Approved')).toBeInTheDocument();
  });

  it('does not decide anything if the finder cancels the confirmation', async () => {
    getClaim.mockResolvedValue({ claim: claim(), viewAs: 'FINDER' });
    renderClaim();
    fireEvent.click(await screen.findByRole('button', { name: /reject claim/i }));
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }));
    expect(decideClaim).not.toHaveBeenCalled();
  });

  it('shows the claimant no expected answers and no decision buttons, but a withdraw button', async () => {
    getClaim.mockResolvedValue({ claim: claim({ answers: [{ questionId: 'q1', question: 'Which bank card?', answer: 'HDFC' }] }), viewAs: 'CLAIMANT' });
    withdrawClaim.mockResolvedValue({ claim: claim({ status: 'WITHDRAWN' }), viewAs: 'CLAIMANT' });
    renderClaim();
    await screen.findByText(/answer: hdfc/i);
    expect(screen.queryByText(/expected answer/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve claim/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /withdraw claim/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^withdraw$/i }));
    await waitFor(() => expect(withdrawClaim).toHaveBeenCalledWith('c1'));
  });

  it('hides decision controls once a claim is decided', async () => {
    getClaim.mockResolvedValue({ claim: claim({ status: 'REJECTED' }), viewAs: 'FINDER' });
    renderClaim();
    await screen.findByText('Rejected');
    expect(screen.queryByRole('button', { name: /approve claim/i })).not.toBeInTheDocument();
  });

  it('shows a clear message when the claim is not accessible', async () => {
    getClaim.mockRejectedValue({ response: { status: 404, data: { message: 'Claim not found' } } });
    renderClaim();
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not have access/i);
  });
});

describe('MatchSuggestions', () => {
  const routes = <Route path="/items/:id/matches" element={<MatchSuggestions />} />;
  const weights = { category: 0.35, keywords: 0.35, date: 0.15, location: 0.15 };

  it('shows the score, its breakdown and the not-proof notice', async () => {
    getMatches.mockResolvedValue({
      source: { id: 'l1', type: 'LOST', title: 'My wallet' },
      weights, notice: 'A match score is a hint, not proof of ownership.',
      matches: [{ item: foundItem(), score: 0.87, percent: 87, breakdown: { category: 1, keywords: 0.67, date: 0.93, location: 1 } }],
    });
    renderAt('/items/l1/matches', routes);
    expect(await screen.findByText('87% match')).toBeInTheDocument();
    expect(screen.getByText(/not proof of ownership/i)).toBeInTheDocument();
    expect(screen.getByText('Brown wallet')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    getMatches.mockResolvedValue({ source: { id: 'l1', type: 'LOST', title: 'My wallet' }, weights, notice: 'n', matches: [] });
    renderAt('/items/l1/matches', routes);
    expect(await screen.findByText('No likely matches yet')).toBeInTheDocument();
  });

  it('shows the server error', async () => {
    getMatches.mockRejectedValue({ response: { status: 403, data: { message: 'Only the report owner can view suggestions' } } });
    renderAt('/items/l1/matches', routes);
    expect(await screen.findByRole('alert')).toHaveTextContent(/only the report owner/i);
  });
});
