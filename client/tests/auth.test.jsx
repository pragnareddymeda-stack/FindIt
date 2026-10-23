import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import Login from '../src/pages/Login.jsx';
import Register from '../src/pages/Register.jsx';
import ProtectedRoute from '../src/routes/ProtectedRoute.jsx';

vi.mock('../src/api/auth.js', () => ({
  fetchMe: vi.fn(),
  loginRequest: vi.fn(),
  registerRequest: vi.fn(),
  logoutRequest: vi.fn(),
  updateProfileRequest: vi.fn(),
}));
import { fetchMe, loginRequest, registerRequest } from '../src/api/auth.js';

const user = { id: '1', name: 'Asha', email: 'asha@example.com', role: 'USER' };

function renderApp(initial, extraRoutes = null) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
          <Route path="/" element={<h1>Home page</h1>} />
          {extraRoutes}
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  fetchMe.mockResolvedValue(null);
});

describe('Login form', () => {
  it('shows validation errors and does not call the API when empty', async () => {
    renderApp('/login');
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(loginRequest).not.toHaveBeenCalled();
  });

  it('submits credentials and moves to the profile page on success', async () => {
    loginRequest.mockResolvedValue(user);
    renderApp('/login');
    type('Email', 'asha@example.com');
    type('Password', 'Passw0rdOK');
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
    expect(loginRequest).toHaveBeenCalledWith({ email: 'asha@example.com', password: 'Passw0rdOK' });
  });

  it('shows the server error message when login fails', async () => {
    loginRequest.mockRejectedValue({ response: { status: 401, data: { message: 'Invalid email or password' } } });
    renderApp('/login');
    type('Email', 'asha@example.com');
    type('Password', 'wrongpass1');
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});

describe('Register form', () => {
  it('rejects mismatched passwords', async () => {
    renderApp('/register');
    type('Full name', 'Asha Verma');
    type('Email', 'asha@example.com');
    type('Password', 'Passw0rdOK');
    type('Confirm password', 'Different1');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(registerRequest).not.toHaveBeenCalled();
  });

  it('rejects a password without a number', async () => {
    renderApp('/register');
    type('Full name', 'Asha Verma');
    type('Email', 'asha@example.com');
    type('Password', 'onlyletters');
    type('Confirm password', 'onlyletters');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Password must include a number')).toBeInTheDocument();
  });

  it('sends only name, email and password (never a role)', async () => {
    registerRequest.mockResolvedValue(user);
    renderApp('/register');
    type('Full name', 'Asha Verma');
    type('Email', 'asha@example.com');
    type('Password', 'Passw0rdOK');
    type('Confirm password', 'Passw0rdOK');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(registerRequest).toHaveBeenCalled());
    expect(registerRequest).toHaveBeenCalledWith({ name: 'Asha Verma', email: 'asha@example.com', password: 'Passw0rdOK' });
  });
});

describe('ProtectedRoute', () => {
  const adminRoute = <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><h1>Admin area</h1></ProtectedRoute>} />;

  it('redirects signed-out visitors to the login page', async () => {
    renderApp('/admin', adminRoute);
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('redirects a regular USER away from an admin route', async () => {
    fetchMe.mockResolvedValue(user);
    renderApp('/admin', adminRoute);
    expect(await screen.findByRole('heading', { name: 'Home page' })).toBeInTheDocument();
  });

  it('lets an ADMIN in', async () => {
    fetchMe.mockResolvedValue({ ...user, role: 'ADMIN' });
    renderApp('/admin', adminRoute);
    expect(await screen.findByRole('heading', { name: 'Admin area' })).toBeInTheDocument();
  });

  it('shows a loading state while the session is being restored', () => {
    fetchMe.mockReturnValue(new Promise(() => {}));
    renderApp('/admin', adminRoute);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });
});
