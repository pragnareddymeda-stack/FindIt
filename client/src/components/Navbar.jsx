import { Link, NavLink, useNavigate } from 'react-router-dom';
import { SearchCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { useRealtime } from '../hooks/useRealtime.js';

const linkClass = 'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100';
const activeClass = ({ isActive }) => `${linkClass} ${isActive ? 'bg-slate-100 text-brand-700' : ''}`;

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const { unread } = useRealtime();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3" aria-label="Main">
        <Link to="/" className="flex items-center gap-2 font-semibold text-brand-700">
          <SearchCheck className="h-6 w-6" aria-hidden="true" />
          FindIt
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          <NavLink to="/items" className={activeClass}>Browse</NavLink>
          {!loading && user && (
            <>
              <NavLink to="/report/lost" className={activeClass}>Report lost</NavLink>
              <NavLink to="/report/found" className={activeClass}>Report found</NavLink>
              <NavLink to="/profile" className={activeClass}>{user.name}</NavLink>
              <button type="button" onClick={handleLogout} className={linkClass}>Log out</button>
            </>
          )}
          {!loading && !user && (
            <>
              <Link to="/login" className={linkClass}>Log in</Link>
              <Link to="/register" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Create account</Link>
            </>
          )}
        </div>
      </nav>
      {!loading && user && (
        <nav className="border-t border-slate-100 bg-slate-50" aria-label="Your activity">
          <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-1.5">
            <NavLink to="/dashboard" className={activeClass}>Dashboard</NavLink>
            <NavLink to="/my-reports" className={activeClass}>My reports</NavLink>
            <NavLink to="/my-claims" className={activeClass}>My claims</NavLink>
            <NavLink to="/incoming-claims" className={activeClass}>Incoming claims</NavLink>
            <NavLink to="/handovers" className={activeClass}>Handovers</NavLink>
            <NavLink to="/conversations" className={activeClass}>Messages</NavLink>
            {user.role === 'ADMIN' && <NavLink to="/admin" className={activeClass}>Admin</NavLink>}
            <NavLink to="/notifications" className={activeClass}>
              Notifications
              {unread > 0 && (
                <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-xs font-semibold text-white" aria-label={`${unread} unread`}>{unread}</span>
              )}
            </NavLink>
          </div>
        </nav>
      )}
    </header>
  );
}
