import { NavLink, Outlet } from 'react-router-dom';

const link = ({ isActive }) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`;

export default function AdminLayout() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav aria-label="Admin" className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
        <NavLink to="/admin" end className={link}>Dashboard</NavLink>
        <NavLink to="/admin/reports" className={link}>Reports</NavLink>
        <NavLink to="/admin/users" className={link}>Users</NavLink>
        <NavLink to="/admin/abuse-reports" className={link}>Abuse reports</NavLink>
        <NavLink to="/admin/disputes" className={link}>Disputes</NavLink>
        <NavLink to="/admin/audit-logs" className={link}>Audit logs</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
