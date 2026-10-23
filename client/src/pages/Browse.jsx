import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import FormField from '../components/FormField.jsx';
import ItemCard from '../components/ItemCard.jsx';
import Pagination from '../components/Pagination.jsx';
import { listItems } from '../api/items.js';
import { CATEGORY_OPTIONS } from '../utils/constants.js';
import { getErrorMessage } from '../utils/errors.js';

const FILTER_KEYS = ['q', 'type', 'category', 'location', 'from', 'to', 'status'];
const LIMIT = 12;

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const urlFilters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const page = Number(params.get('page')) || 1;
  const queryString = params.toString();

  const [draft, setDraft] = useState(urlFilters);
  const [state, setState] = useState({ loading: true, items: [], pagination: null, error: '' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const query = { page, limit: LIMIT };
    FILTER_KEYS.forEach((k) => { if (urlFilters[k]) query[k] = urlFilters[k]; });
    setState((s) => ({ ...s, loading: true, error: '' }));
    listItems(query)
      .then(({ items, pagination }) => active && setState({ loading: false, items, pagination, error: '' }))
      .catch((err) => active && setState({ loading: false, items: [], pagination: null, error: getErrorMessage(err) }));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString, reloadKey]);

  const apply = (e) => {
    e.preventDefault();
    const next = new URLSearchParams();
    FILTER_KEYS.forEach((k) => { if (draft[k]) next.set(k, draft[k]); });
    setParams(next);
  };
  const clear = () => {
    setDraft(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])));
    setParams(new URLSearchParams());
  };
  const goToPage = (p) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next);
  };
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const hasFilters = FILTER_KEYS.some((k) => urlFilters[k]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Browse reports</h1>

      <form onSubmit={apply} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Filters">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField id="f-q" label="Keyword" placeholder="wallet, keys, bottle…" value={draft.q} onChange={set('q')} />
          <FormField id="f-type" label="Type" as="select" value={draft.type} onChange={set('type')}>
            <option value="">Lost and found</option>
            <option value="LOST">Lost</option>
            <option value="FOUND">Found</option>
          </FormField>
          <FormField id="f-category" label="Category" as="select" value={draft.category} onChange={set('category')}>
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </FormField>
          <FormField id="f-location" label="Location" placeholder="e.g. library" value={draft.location} onChange={set('location')} />
          <FormField id="f-from" label="From date" type="date" value={draft.from} onChange={set('from')} />
          <FormField id="f-to" label="To date" type="date" value={draft.to} onChange={set('to')} />
          <FormField id="f-status" label="Status" as="select" value={draft.status} onChange={set('status')}>
            <option value="">Active</option>
            <option value="RETURNED">Returned</option>
            <option value="CLOSED">Closed</option>
          </FormField>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
            <Search className="h-4 w-4" aria-hidden="true" /> Apply filters
          </button>
          <button type="button" onClick={clear} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">Clear</button>
        </div>
      </form>

      <section className="mt-6" aria-live="polite">
        {state.loading && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading reports">
            {[0, 1, 2, 3, 4, 5].map((i) => <li key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200" />)}
          </ul>
        )}

        {!state.loading && state.error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {state.error}{' '}
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-medium underline">Try again</button>
          </div>
        )}

        {!state.loading && !state.error && state.items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="font-semibold text-slate-900">{hasFilters ? 'No reports match your filters' : 'No reports yet'}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {hasFilters ? 'Try a broader keyword or remove a filter.' : 'Be the first to help: report a lost or found item.'}
            </p>
            <div className="mt-4 flex justify-center gap-3 text-sm font-medium">
              {hasFilters && <button type="button" onClick={clear} className="text-brand-700 hover:underline">Clear filters</button>}
              <Link to="/report/lost" className="text-brand-700 hover:underline">Report lost</Link>
              <Link to="/report/found" className="text-brand-700 hover:underline">Report found</Link>
            </div>
          </div>
        )}

        {!state.loading && !state.error && state.items.length > 0 && (
          <>
            <p className="mb-3 text-sm text-slate-500">{state.pagination.total} report{state.pagination.total === 1 ? '' : 's'}</p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {state.items.map((item) => <ItemCard key={item.id} item={item} />)}
            </ul>
            <Pagination page={state.pagination.page} totalPages={state.pagination.totalPages} onChange={goToPage} />
          </>
        )}
      </section>
    </main>
  );
}
