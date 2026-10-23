import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

vi.mock('../src/api/health.js', () => ({ getHealth: vi.fn() }));
vi.mock('../src/api/auth.js', () => ({
  fetchMe: vi.fn(),
  loginRequest: vi.fn(),
  registerRequest: vi.fn(),
  logoutRequest: vi.fn(),
  updateProfileRequest: vi.fn(),
}));
import { getHealth } from '../src/api/health.js';
import { fetchMe } from '../src/api/auth.js';

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

beforeEach(() => {
  fetchMe.mockResolvedValue(null);
});

describe('App', () => {
  it('shows the connected state from the health endpoint', async () => {
    getHealth.mockResolvedValue({ status: 'ok', database: 'connected' });
    renderAt('/');
    expect(await screen.findByText(/API is running/i)).toBeInTheDocument();
    expect(screen.getByText('connected')).toBeInTheDocument();
  });

  it('shows an error when the API is unreachable', async () => {
    getHealth.mockRejectedValue(new Error('network'));
    renderAt('/');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Cannot reach the API/i);
  });

  it('renders the not-found page for unknown routes', async () => {
    getHealth.mockResolvedValue({ status: 'ok', database: 'connected' });
    renderAt('/does-not-exist');
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });

  it('shows Log in and Create account links to signed-out visitors', async () => {
    getHealth.mockResolvedValue({ status: 'ok', database: 'connected' });
    renderAt('/');
    expect((await screen.findAllByRole('link', { name: /log in/i })).length).toBeGreaterThan(0);
  });
});
