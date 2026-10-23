import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { RealtimeContext } from '../src/context/RealtimeContext.jsx';
import Dashboard from '../src/pages/Dashboard.jsx';
import Safety from '../src/pages/Safety.jsx';
import Footer from '../src/components/Footer.jsx';

vi.mock('../src/api/auth.js', () => ({
  fetchMe: vi.fn(), loginRequest: vi.fn(), registerRequest: vi.fn(), logoutRequest: vi.fn(), updateProfileRequest: vi.fn(),
}));
vi.mock('../src/api/items.js', () => ({ listMyItems: vi.fn() }));
vi.mock('../src/api/claims.js', () => ({ listMyClaims: vi.fn(), listIncomingClaims: vi.fn() }));
vi.mock('../src/api/handovers.js', () => ({ listMyHandovers: vi.fn() }));
import { fetchMe } from '../src/api/auth.js';
import { listMyItems } from '../src/api/items.js';
import { listMyClaims, listIncomingClaims } from '../src/api/claims.js';
import { listMyHandovers } from '../src/api/handovers.js';

const rt = { connected: true, unread: 4, subscribe: () => () => {}, emit: vi.fn(), refreshUnread: vi.fn() };
const page = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <AuthProvider>
      <RealtimeContext.Provider value={rt}>
        <Routes><Route path="/dashboard" element={<Dashboard />} /></Routes>
      </RealtimeContext.Provider>
    </AuthProvider>
  </MemoryRouter>,
);
const pg = (total) => ({ page: 1, limit: 5, total, totalPages: 1 });

beforeEach(() => {
  vi.clearAllMocks();
  fetchMe.mockResolvedValue({ id: 'u1', name: 'Asha', role: 'USER' });
});

describe('Dashboard', () => {
  it('greets the person and summarises their reports, claims, reviews and notifications', async () => {
    listMyItems.mockResolvedValue({ items: [{ id: 'i1', type: 'LOST', title: 'Black wallet', dateOccurred: '2026-10-10T00:00:00.000Z' }], pagination: pg(3) });
    listMyClaims.mockResolvedValue({ claims: [{ id: 'c1', status: 'PENDING', item: { title: 'Blue umbrella' } }], pagination: pg(2) });
    listIncomingClaims.mockResolvedValue({ claims: [{ id: 'c2', createdAt: '2026-10-12T00:00:00.000Z', claimant: { name: 'Ravi' }, item: { title: 'Brown wallet' } }], pagination: pg(1) });
    listMyHandovers.mockResolvedValue({ handovers: [{ id: 'h1', status: 'SCHEDULED', item: { title: 'Keys' } }], pagination: pg(1) });
    page();
    expect(await screen.findByRole('heading', { name: /welcome back, asha/i })).toBeInTheDocument();
    const stat = (label) => within(screen.getByText(label).closest('a'));
    expect(await screen.findByText('Active reports')).toBeInTheDocument();
    expect(stat('Active reports').getByText('3')).toBeInTheDocument();
    expect(stat('My claims').getByText('2')).toBeInTheDocument();
    expect(stat('Claims to review').getByText('1')).toBeInTheDocument();
    expect(stat('Unread notifications').getByText('4')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /black wallet/i })).toHaveAttribute('href', '/items/i1');
    expect(screen.getByRole('link', { name: /ravi claimed brown wallet/i })).toHaveAttribute('href', '/claims/c2');
    expect(screen.getByRole('link', { name: /blue umbrella/i })).toHaveAttribute('href', '/claims/c1');
    expect(screen.getByRole('link', { name: /keys/i })).toHaveAttribute('href', '/handovers/h1');
    expect(listIncomingClaims).toHaveBeenCalledWith({ status: 'PENDING', limit: 5 });
    expect(listMyItems).toHaveBeenCalledWith({ status: 'ACTIVE', limit: 5 });
  });

  it('shows helpful empty states for a new user', async () => {
    listMyItems.mockResolvedValue({ items: [], pagination: pg(0) });
    listMyClaims.mockResolvedValue({ claims: [], pagination: pg(0) });
    listIncomingClaims.mockResolvedValue({ claims: [], pagination: pg(0) });
    listMyHandovers.mockResolvedValue({ handovers: [], pagination: pg(0) });
    page();
    expect(await screen.findByText(/you have no active reports/i)).toBeInTheDocument();
    expect(screen.getByText(/nobody is waiting on you/i)).toBeInTheDocument();
    expect(screen.getByText(/you have not claimed anything yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no handovers yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report a lost item' })).toHaveAttribute('href', '/report/lost');
    expect(screen.getByRole('link', { name: 'Report a found item' })).toHaveAttribute('href', '/report/found');
  });

  it('shows an error with a retry', async () => {
    listMyItems.mockRejectedValueOnce(new Error('x')).mockResolvedValue({ items: [], pagination: pg(0) });
    listMyClaims.mockResolvedValue({ claims: [], pagination: pg(0) });
    listIncomingClaims.mockResolvedValue({ claims: [], pagination: pg(0) });
    listMyHandovers.mockResolvedValue({ handovers: [], pagination: pg(0) });
    page();
    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Active reports')).toBeInTheDocument();
  });
});

describe('Safety guidelines and footer', () => {
  it('covers meeting safely, finders, claimants, the limits of verification and reporting problems', () => {
    render(<MemoryRouter><Safety /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Safety guidelines' })).toBeInTheDocument();
    for (const h of [/meeting to hand something over/i, /if you found something/i, /if you are claiming/i, /what verification can and cannot do/i, /reporting problems/i]) {
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    }
    expect(screen.getByText(/cannot give absolute\s+proof/i)).toBeInTheDocument();
    expect(screen.getByText(/never pay money/i)).toBeInTheDocument();
  });

  it('is linked from the footer on every page', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Safety guidelines' })).toHaveAttribute('href', '/safety');
  });
});
