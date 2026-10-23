/** Shared loading / error / empty states for list pages. */
export default function AsyncBoundary({ loading, error, onRetry, isEmpty, empty, label = 'Loading', children }) {
  if (loading) return <div role="status" className="h-28 animate-pulse rounded-2xl bg-slate-200" aria-label={label} />;
  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        {error} <button type="button" onClick={onRetry} className="font-medium underline">Try again</button>
      </div>
    );
  }
  if (isEmpty) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">{empty}</div>;
  }
  return children;
}
