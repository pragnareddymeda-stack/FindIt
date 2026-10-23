import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import Browse from '../src/pages/Browse.jsx';
import CreateReport from '../src/pages/CreateReport.jsx';

vi.mock('../src/api/items.js', () => ({
  listItems: vi.fn(),
  listMyItems: vi.fn(),
  getItem: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  withdrawItem: vi.fn(), reportListing: vi.fn(), uploadItemImage: vi.fn(), deleteItemImage: vi.fn(),
}));
vi.mock('../src/api/config.js', () => ({ getConfig: vi.fn().mockResolvedValue({ uploadsEnabled: false }) }));
import { listItems, createItem } from '../src/api/items.js';

const sample = (over = {}) => ({
  id: '1', type: 'LOST', title: 'Black wallet', category: 'WALLETS_PURSES', description: 'Lost near the library.',
  dateOccurred: '2026-10-10T00:00:00.000Z', location: 'Central library', status: 'ACTIVE', isOwner: false, ...over,
});
const page = (items, extra = {}) => ({ items, pagination: { page: 1, limit: 12, total: items.length, totalPages: 1, ...extra } });

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('Browse', () => {
  beforeEach(() => vi.clearAllMocks());
  const renderBrowse = (path = '/items') => render(<MemoryRouter initialEntries={[path]}><Browse /></MemoryRouter>);

  it('shows a loading skeleton, then the reports', async () => {
    listItems.mockResolvedValue(page([sample()]));
    renderBrowse();
    expect(screen.getByLabelText('Loading reports')).toBeInTheDocument();
    expect(await screen.findByText('Black wallet')).toBeInTheDocument();
    expect(screen.getByText('1 report')).toBeInTheDocument();
  });

  it('sends the chosen filters to the API when applied', async () => {
    listItems.mockResolvedValue(page([sample()]));
    renderBrowse();
    await screen.findByText('Black wallet');
    type('Keyword', 'wallet');
    type('Type', 'FOUND');
    type('Category', 'KEYS');
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));
    await waitFor(() =>
      expect(listItems).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'wallet', type: 'FOUND', category: 'KEYS', page: 1 })),
    );
  });

  it('reads filters from the URL', async () => {
    listItems.mockResolvedValue(page([sample()]));
    renderBrowse('/items?q=keys&location=hostel&page=2');
    await waitFor(() =>
      expect(listItems).toHaveBeenCalledWith(expect.objectContaining({ q: 'keys', location: 'hostel', page: 2 })),
    );
  });

  it('shows an empty state with a clear-filters action', async () => {
    listItems.mockResolvedValue(page([]));
    renderBrowse('/items?q=nothing');
    expect(await screen.findByText('No reports match your filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });

  it('shows an error and retries', async () => {
    listItems.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(page([sample()]));
    renderBrowse();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Black wallet')).toBeInTheDocument();
  });

  it('paginates', async () => {
    listItems.mockResolvedValue(page([sample()], { totalPages: 3 }));
    renderBrowse();
    await screen.findByText('Black wallet');
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(listItems).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });
});

describe('Report form', () => {
  beforeEach(() => vi.clearAllMocks());
  const renderForm = (reportType) =>
    render(
      <MemoryRouter initialEntries={['/report']}>
        <ToastProvider>
          <Routes>
            <Route path="/report" element={<CreateReport type={reportType} />} />
            <Route path="/items/:id" element={<h1>Details page</h1>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>,
    );

  it('shows validation errors for an empty submission and does not call the API', async () => {
    renderForm('LOST');
    fireEvent.click(screen.getByRole('button', { name: /publish report/i }));
    expect(await screen.findByText('Title must be at least 3 characters')).toBeInTheDocument();
    expect(screen.getByText('Choose a category')).toBeInTheDocument();
    expect(screen.getByText('Enter the date')).toBeInTheDocument();
    expect(createItem).not.toHaveBeenCalled();
  });

  it('does not show private verification fields on a lost report', () => {
    renderForm('LOST');
    expect(screen.queryByText(/private verification/i)).not.toBeInTheDocument();
  });

  it('requires a verification question for a found report', async () => {
    renderForm('FOUND');
    expect(screen.getByText(/private verification/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /publish report/i }));
    expect(await screen.findByText('Question must be at least 5 characters')).toBeInTheDocument();
  });

  it('submits a valid found report and opens its page', async () => {
    createItem.mockResolvedValue({ id: 'abc' });
    renderForm('FOUND');
    type('Title', 'Black wallet');
    type('Category', 'WALLETS_PURSES');
    type('Description', 'Found on a bench near the cafeteria.');
    type('Date', '2026-10-10');
    type('General location', 'Cafeteria');
    type('Verification question 1', 'What card is inside?');
    fireEvent.click(screen.getByRole('button', { name: /publish report/i }));
    expect(await screen.findByRole('heading', { name: 'Details page' })).toBeInTheDocument();
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FOUND', title: 'Black wallet', category: 'WALLETS_PURSES', location: 'Cafeteria',
        verificationQuestions: [{ question: 'What card is inside?', expectedAnswer: '' }],
      }),
    );
  });

  it('shows the server error when saving fails', async () => {
    createItem.mockRejectedValue({ response: { status: 400, data: { message: 'Validation failed' } } });
    renderForm('LOST');
    type('Title', 'Black wallet');
    type('Category', 'WALLETS_PURSES');
    type('Description', 'Lost near the library entrance.');
    type('Date', '2026-10-10');
    type('General location', 'Library');
    fireEvent.click(screen.getByRole('button', { name: /publish report/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Validation failed');
  });
});
