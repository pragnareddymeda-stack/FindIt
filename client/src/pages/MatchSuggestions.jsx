import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ItemCard from '../components/ItemCard.jsx';
import SafetyNote from '../components/SafetyNote.jsx';
import { getMatches } from '../api/items.js';
import { getErrorMessage } from '../utils/errors.js';

const PARTS = [['category', 'Category'], ['keywords', 'Keywords'], ['date', 'Date'], ['location', 'Location']];

function Breakdown({ match, weights }) {
  return (
    <div>
      <p className="text-sm font-semibold text-brand-700">{match.percent}% match</p>
      <dl className="mt-2 space-y-1">
        {PARTS.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 text-xs text-slate-600">
            <dt className="w-16">{label}</dt>
            <dd className="flex-1">
              <div className="h-1.5 rounded-full bg-slate-100" role="presentation">
                <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${Math.round(match.breakdown[key] * 100)}%` }} />
              </div>
            </dd>
            <dd className="w-20 text-right">{Math.round(match.breakdown[key] * 100)}% × {Math.round(weights[key] * 100)}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function MatchSuggestions() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    let active = true;
    getMatches(id)
      .then((data) => active && setState({ loading: false, data, error: '' }))
      .catch((err) => active && setState({ loading: false, data: null, error: getErrorMessage(err) }));
    return () => { active = false; };
  }, [id]);

  if (state.loading) return <main className="mx-auto max-w-5xl px-4 py-10"><div role="status" className="h-40 animate-pulse rounded-2xl bg-slate-200" aria-label="Finding matches" /></main>;
  if (state.error) return <main className="mx-auto max-w-5xl px-4 py-10"><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{state.error}</div></main>;

  const { source, matches, weights, notice } = state.data;
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Suggested matches</h1>
      <p className="mt-1 text-slate-600">
        For your {source.type === 'LOST' ? 'lost' : 'found'} report <Link to={`/items/${source.id}`} className="font-medium text-brand-700 hover:underline">{source.title}</Link>
      </p>
      <div className="mt-4"><SafetyNote>{notice}</SafetyNote></div>

      {matches.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-slate-900">No likely matches yet</h2>
          <p className="mt-1 text-sm text-slate-600">New reports are checked every time you open this page.</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {matches.map((m) => <ItemCard key={m.item.id} item={m.item} footer={<Breakdown match={m} weights={weights} />} />)}
        </ul>
      )}
    </main>
  );
}
