import { useEffect, useState } from 'react';
import { getHealth } from '../api/health.js';

export default function ApiStatus() {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let active = true;
    getHealth()
      .then((data) => active && setState({ loading: false, data, error: null }))
      .catch(() => active && setState({ loading: false, data: null, error: 'Cannot reach the API server.' }));
    return () => { active = false; };
  }, []);

  if (state.loading) {
    return <div role="status" className="h-16 animate-pulse rounded-xl bg-slate-200" aria-label="Checking API status" />;
  }
  if (state.error) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {state.error} Start it with <code>npm run dev:server</code>.
      </div>
    );
  }
  const ok = state.data.database === 'connected';
  return (
    <div
      role="status"
      className={`rounded-xl border p-4 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
    >
      API is running. Database: <strong>{state.data.database}</strong>.
    </div>
  );
}
