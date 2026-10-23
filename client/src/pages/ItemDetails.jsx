import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Lock } from 'lucide-react';
import StatusBadge, { TypeBadge } from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import SafetyNote from '../components/SafetyNote.jsx';
import ReportListingDialog from '../components/ReportListingDialog.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { getItem, withdrawItem } from '../api/items.js';
import { useToast } from '../hooks/useToast.js';
import { categoryLabel, contactLabel } from '../utils/constants.js';
import { formatDate } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';

export default function ItemDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, item: null, error: '' });
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setState({ loading: true, item: null, error: '' });
    getItem(id)
      .then((item) => active && setState({ loading: false, item, error: '' }))
      .catch((err) => active && setState({ loading: false, item: null, error: err.response?.status === 404 ? 'This report does not exist or is no longer available.' : getErrorMessage(err) }));
    return () => { active = false; };
  }, [id]);

  const withdraw = async () => {
    setBusy(true);
    try {
      await withdrawItem(id);
      toast.success('Report withdrawn.');
      navigate('/my-reports');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) return <main className="mx-auto max-w-3xl px-4 py-10"><div role="status" className="h-56 animate-pulse rounded-2xl bg-slate-200" aria-label="Loading report" /></main>;
  if (state.error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{state.error}</div>
        <Link to="/items" className="mt-4 inline-block font-medium text-brand-700 hover:underline">Browse all items</Link>
      </main>
    );
  }

  const { item } = state;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={item.type} />
        <StatusBadge status={item.status} />
      </div>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{item.title}</h1>
      <p className="text-slate-500">{categoryLabel(item.category)}</p>
      {item.imageUrl && <img src={item.imageUrl} alt={`Photo of ${item.title}`} className="mt-4 max-h-96 w-full rounded-2xl object-cover" />}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <p className="whitespace-pre-line text-slate-800">{item.description}</p>
        <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden="true" /><dt className="sr-only">Location</dt><dd>{item.location}</dd></div>
          <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden="true" /><dt className="sr-only">Date</dt><dd>{formatDate(item.dateOccurred)}</dd></div>
          {item.approxTime && <div className="flex items-center gap-2"><Clock className="h-4 w-4" aria-hidden="true" /><dt className="sr-only">Approximate time</dt><dd>Around {item.approxTime}</dd></div>}
          <div><dt className="inline font-medium">Posted by </dt><dd className="inline">{item.owner?.name || 'a FindIt user'}</dd></div>
          <div><dt className="inline font-medium">Preferred contact </dt><dd className="inline">{contactLabel(item.contactPreference)}</dd></div>
        </dl>
      </section>

      {item.isOwner && item.type === 'FOUND' && (
        <section className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/40 p-6">
          <h2 className="flex items-center gap-2 font-semibold text-brand-900"><Lock className="h-4 w-4" aria-hidden="true" />Private to you</h2>
          {item.privateDetails && <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{item.privateDetails}</p>}
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            {item.verificationQuestions.map((q) => (
              <li key={q.id}>{q.question}{q.expectedAnswer && <span className="block text-slate-500">Expected answer: {q.expectedAnswer}</span>}</li>
            ))}
          </ol>
        </section>
      )}

      {!item.isOwner && item.type === 'FOUND' && item.status === 'ACTIVE' && (
        <section className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">Is this yours?</h2>
          {!user && (
            <Link to="/login" state={{ from: { pathname: `/items/${item.id}/claim` } }} className="inline-block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
              Log in to claim this item
            </Link>
          )}
          {user && item.myActiveClaim && (
            <p className="text-sm text-slate-700">
              You already have a claim on this item.{' '}
              <Link to={`/claims/${item.myActiveClaim.id}`} className="font-medium text-brand-700 hover:underline">View your claim</Link>
            </p>
          )}
          {user && !item.myActiveClaim && item.claimQuestions && (
            <Link to={`/items/${item.id}/claim`} className="inline-block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
              Claim this item
            </Link>
          )}
          <SafetyNote>The finder decides whether your answers are convincing. Never share passwords, OTPs or payment details.</SafetyNote>
        </section>
      )}

      {item.isOwner && item.status === 'ACTIVE' && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={`/items/${item.id}/matches`} className="rounded-lg border border-brand-600 px-4 py-2 font-medium text-brand-700 hover:bg-brand-50">Suggested matches</Link>
          {item.type === 'FOUND' && (
            <Link to={`/incoming-claims?item=${item.id}`} className="rounded-lg border border-brand-600 px-4 py-2 font-medium text-brand-700 hover:bg-brand-50">
              Review claims{item.pendingClaimCount ? ` (${item.pendingClaimCount} pending)` : ''}
            </Link>
          )}
        </div>
      )}

      {item.isOwner && item.status === 'ACTIVE' && (
        <div className="mt-3 flex flex-wrap gap-3">
          <Link to={`/items/${item.id}/edit`} className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">Edit report</Link>
          <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50">Withdraw report</button>
        </div>
      )}

      {user && !item.isOwner && (
        <div className="mt-8 text-sm">
          <button type="button" onClick={() => setReporting(true)} className="text-slate-500 underline hover:text-slate-700">Report this listing</button>
        </div>
      )}
      <ReportListingDialog open={reporting} itemId={item.id} onClose={() => setReporting(false)} />

      <ConfirmDialog
        open={confirming} busy={busy} title="Withdraw this report?"
        message="It will no longer appear in search results. You cannot undo this."
        confirmLabel="Withdraw" onConfirm={withdraw} onCancel={() => setConfirming(false)}
      />
    </main>
  );
}
