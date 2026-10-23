import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import SafetyNote from '../components/SafetyNote.jsx';
import FormField from '../components/FormField.jsx';
import { getClaim, decideClaim, withdrawClaim } from '../api/claims.js';
import { createHandover } from '../api/handovers.js';
import { getClaimConversation } from '../api/messages.js';
import { useToast } from '../hooks/useToast.js';
import { formatDate } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';

export default function ClaimDetails() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, claim: null, viewAs: null, canHandover: false, handover: null, error: '' });
  const [reviewNote, setReviewNote] = useState('');
  const [pending, setPending] = useState(null); // 'APPROVED' | 'REJECTED' | 'WITHDRAW'
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getClaim(id)
      .then(({ claim, viewAs, canHandover, handover }) => active && setState({ loading: false, claim, viewAs, canHandover: Boolean(canHandover), handover: handover ?? null, error: '' }))
      .catch((err) => active && setState({ loading: false, claim: null, viewAs: null, error: err.response?.status === 404 ? 'This claim does not exist or you do not have access to it.' : getErrorMessage(err) }));
    return () => { active = false; };
  }, [id]);

  const confirm = async () => {
    setBusy(true);
    try {
      const result = pending === 'WITHDRAW' ? await withdrawClaim(id) : await decideClaim(id, { decision: pending, reviewNote });
      setState({ loading: false, claim: result.claim, viewAs: result.viewAs, canHandover: Boolean(result.canHandover), handover: result.handover ?? null, error: '' });
      toast.success(pending === 'APPROVED' ? 'Claim approved.' : pending === 'REJECTED' ? 'Claim rejected.' : 'Claim withdrawn.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const openChat = async () => {
    setBusy(true);
    try {
      const conversation = await getClaimConversation(id);
      navigate(`/conversations/${conversation.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBusy(false);
    }
  };

  const startHandover = async () => {
    setBusy(true);
    try {
      const created = await createHandover(id);
      navigate(`/handovers/${created.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBusy(false);
    }
  };

  if (state.loading) return <main className="mx-auto max-w-3xl px-4 py-10"><div role="status" className="h-48 animate-pulse rounded-2xl bg-slate-200" aria-label="Loading claim" /></main>;
  if (state.error) return <main className="mx-auto max-w-3xl px-4 py-10"><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{state.error}</div></main>;

  const { claim, viewAs, canHandover, handover } = state;
  const isFinder = viewAs === 'FINDER';
  const dialog = {
    APPROVED: { title: 'Approve this claim?', message: 'You are saying the answers convince you this person owns the item. Meet in a public place for the handover.', label: 'Approve' },
    REJECTED: { title: 'Reject this claim?', message: 'The claimant will see your note and the claim will be closed.', label: 'Reject' },
    WITHDRAW: { title: 'Withdraw your claim?', message: 'The finder will no longer see this claim as pending.', label: 'Withdraw' },
  }[pending] || {};

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={claim.status} />
        <span className="text-sm text-slate-500">Submitted {formatDate(claim.createdAt)}</span>
      </div>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        {isFinder ? 'Claim on' : 'Your claim on'}{' '}
        {claim.item?.title ? <Link to={`/items/${claim.item.id}`} className="text-brand-700 hover:underline">{claim.item.title}</Link> : 'an item'}
      </h1>
      {isFinder && claim.claimant && <p className="text-slate-600">Claimed by {claim.claimant.name}</p>}

      <section className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-500">Explanation</h2>
          <p className="mt-1 whitespace-pre-line text-slate-800">{claim.explanation}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-500">Answers to verification questions</h2>
          <ul className="mt-2 space-y-3">
            {claim.answers.map((a) => (
              <li key={a.questionId} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-800">{a.question}</p>
                <p className="text-slate-700">Answer: {a.answer}</p>
                {isFinder && <p className="text-slate-500">Your expected answer: {a.expectedAnswer || 'not set'}</p>}
              </li>
            ))}
          </ul>
        </div>
        {claim.evidence && (
          <div>
            <h2 className="text-sm font-semibold text-slate-500">Supporting evidence</h2>
            <p className="mt-1 whitespace-pre-line text-slate-800">{claim.evidence}</p>
          </div>
        )}
        {claim.reviewNote && (
          <div>
            <h2 className="text-sm font-semibold text-slate-500">Finder's note</h2>
            <p className="mt-1 whitespace-pre-line text-slate-800">{claim.reviewNote}</p>
          </div>
        )}
      </section>

      {canHandover && (
        <div className="mt-6">
          <button type="button" disabled={busy} onClick={openChat} className="rounded-lg border border-brand-600 px-4 py-2 font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60">
            {isFinder ? 'Message the claimant' : 'Message the finder'}
          </button>
        </div>
      )}

      {isFinder && claim.status === 'PENDING' && (
        <section className="mt-6 space-y-4">
          <SafetyNote>
            Matching answers are a strong hint, not proof. Use more than one piece of evidence, keep your phone number private,
            and hand items over in a public place.
          </SafetyNote>
          <FormField id="reviewNote" label="Note to the claimant (optional)" as="textarea" rows={3} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setPending('APPROVED')} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">Approve claim</button>
            <button type="button" onClick={() => setPending('REJECTED')} className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50">Reject claim</button>
          </div>
        </section>
      )}

      {!isFinder && claim.status === 'PENDING' && (
        <div className="mt-6">
          <button type="button" onClick={() => setPending('WITHDRAW')} className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50">Withdraw claim</button>
        </div>
      )}

      {claim.status === 'APPROVED' && (
        <div className="mt-6 space-y-4">
          <SafetyNote>This claim was approved. Arrange the handover in a public, well-lit place and keep personal contact details private until you are comfortable.</SafetyNote>
          {handover && (
            <Link to={`/handovers/${handover.id}`} className="inline-block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">Open handover</Link>
          )}
          {!handover && canHandover && (
            <button type="button" disabled={busy} onClick={startHandover} className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? 'Starting…' : 'Start handover'}
            </button>
          )}
        </div>
      )}

      <ConfirmDialog open={Boolean(pending)} busy={busy} title={dialog.title} message={dialog.message} confirmLabel={dialog.label} onConfirm={confirm} onCancel={() => setPending(null)} />
    </main>
  );
}
