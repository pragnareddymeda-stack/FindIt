import { Link } from 'react-router-dom';
import ApiStatus from '../components/ApiStatus.jsx';
import { useAuth } from '../hooks/useAuth.js';

const primary = 'rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700';
const secondary = 'rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50';

export default function Landing() {
  const { user, loading } = useAuth();
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        Lost something on campus? Let the community help you find it.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-slate-600">
        Report a lost or found item, check suggested matches, and arrange a safe handover.
      </p>
      {!loading && (
        <div className="mt-8 flex flex-wrap gap-3">
          {user ? (
            <>
              <Link to="/dashboard" className={primary}>Go to your dashboard</Link>
              <Link to="/report/lost" className={secondary}>Report a lost item</Link>
              <Link to="/report/found" className={secondary}>Report a found item</Link>
            </>
          ) : (
            <>
              <Link to="/register" className={primary}>Create account</Link>
              <Link to="/login" className={secondary}>Log in</Link>
            </>
          )}
          <Link to="/items" className={secondary}>Browse reports</Link>
        </div>
      )}
      <div className="mt-10 max-w-md">
        <h2 className="mb-2 text-sm font-medium text-slate-500">Server connection</h2>
        <ApiStatus />
      </div>
    </main>
  );
}
