import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, MapPin } from 'lucide-react';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import SafetyNote from '../components/SafetyNote.jsx';
import FormField from '../components/FormField.jsx';
import { getHandover, updateHandoverStatus } from '../api/handovers.js';
import { getClaimConversation } from '../api/messages.js';
import { useToast } from '../hooks/useToast.js';
import { scheduleSchema, disputeSchema } from '../utils/validation.js';
import { formatDateTime, toLocalInputValue } from '../utils/format.js';
import { HANDOVER_STATUS_LABELS } from '../utils/constants.js';
import { getErrorMessage } from '../utils/errors.js';

function ScheduleForm({ handover, onSubmit }) {
  const {
    register, handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { meetingTime: toLocalInputValue(handover.meetingTime), meetingPlace: handover.meetingPlace || '', note: handover.note || '' },
  });
  const submit = (v) => onSubmit({ status: 'SCHEDULED', meetingTime: new Date(v.meetingTime).toISOString(), meetingPlace: v.meetingPlace, note: v.note || '' });

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold text-slate-900">{handover.status === 'SCHEDULED' ? 'Change meeting details' : 'Set meeting details'}</h2>
      <FormField id="meetingTime" label="Meeting date and time" type="datetime-local" error={errors.meetingTime?.message} {...register('meetingTime')} />
      <FormField
        id="meetingPlace" label="General meeting place"
        hint="A busy public spot, like the library main gate. Never a home address."
        error={errors.meetingPlace?.message} {...register('meetingPlace')}
      />
      <FormField
        id="note" label="Note (optional)" as="textarea" rows={2}
        hint="For example what you will be wearing. Do not put phone numbers here."
        error={errors.note?.message} {...register('note')}
      />
      <button type="submit" disabled={isSubmitting} className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60">
        {isSubmitting ? 'Saving…' : 'Save meeting details'}
      </button>
    </form>
  );
}

function DisputeForm({ onSubmit, onCancel }) {
  const {
    register, handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(disputeSchema), defaultValues: { reason: '' } });
  return (
    <form onSubmit={handleSubmit((v) => onSubmit({ status: 'DISPUTED', reason: v.reason }))} noValidate className="space-y-4 rounded-2xl border border-red-200 bg-red-50/50 p-6">
      <h2 className="font-semibold text-red-900">Report a problem</h2>
      <FormField id="reason" label="What went wrong?" as="textarea" rows={3} error={errors.reason?.message} {...register('reason')} />
      <div className="flex gap-3">
        <button type="submit" disabled={isSubmitting} className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-60">Submit report</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">Never mind</button>
      </div>
    </form>
  );
}

const CONFIRMS = {
  HANDED_OVER: { title: 'Record the handover?', message: 'Confirm that you have physically handed the item to the claimant. They will then be asked to confirm receipt.', label: 'Yes, I handed it over', success: 'Handover recorded.' },
  COMPLETED: { title: 'Confirm you received the item?', message: 'This closes the report as returned. Only confirm if the item is in your hands.', label: 'Yes, I received it', success: 'Receipt confirmed. The item is marked as returned.' },
  CANCELLED: { title: 'Cancel this handover?', message: 'The claim will be released and the item can be claimed again.', label: 'Cancel handover', success: 'Handover cancelled.' },
};

export default function HandoverDetails() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, handover: null, error: '' });
  const [pending, setPending] = useState(null);
  const [disputing, setDisputing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getHandover(id)
      .then((handover) => active && setState({ loading: false, handover, error: '' }))
      .catch((err) => active && setState({ loading: false, handover: null, error: err.response?.status === 404 ? 'This handover does not exist or you do not have access to it.' : getErrorMessage(err) }));
    return () => { active = false; };
  }, [id]);

  const openChat = async (claimId) => {
    try {
      const conversation = await getClaimConversation(claimId);
      navigate(`/conversations/${conversation.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const apply = async (payload, successMessage) => {
    setBusy(true);
    try {
      const handover = await updateHandoverStatus(id, payload);
      setState({ loading: false, handover, error: '' });
      toast.success(successMessage);
      setDisputing(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  if (state.loading) return <main className="mx-auto max-w-3xl px-4 py-10"><div role="status" className="h-48 animate-pulse rounded-2xl bg-slate-200" aria-label="Loading handover" /></main>;
  if (state.error) return <main className="mx-auto max-w-3xl px-4 py-10"><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{state.error}</div></main>;

  const { handover } = state;
  const can = (s) => handover.nextActions.includes(s);
  const other = handover.viewAs === 'FINDER' ? handover.claimant : handover.finder;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={handover.status} />
          <span className="text-sm text-slate-500">You are the {handover.viewAs === 'FINDER' ? 'finder' : handover.viewAs === 'CLAIMANT' ? 'claimant' : 'administrator'}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Handover of {handover.item?.id ? <Link to={`/items/${handover.item.id}`} className="text-brand-700 hover:underline">{handover.item.title}</Link> : 'an item'}
        </h1>
        {other && <p className="text-slate-600">With {other.name}</p>}
        {handover.viewAs !== 'ADMIN' && (
          <button type="button" onClick={() => openChat(handover.claimId)} className="mt-2 rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50">
            Message {other?.name || 'them'}
          </button>
        )}
      </header>

      <SafetyNote>
        Meet in a busy, well-lit public place and tell a friend where you are going. Keep your phone number and address private.
        Never pay money or share passwords or OTPs to get an item back.
      </SafetyNote>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Meeting</h2>
        {handover.meetingTime ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden="true" />{formatDateTime(handover.meetingTime)}</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />{handover.meetingPlace}</li>
            {handover.note && <li className="text-slate-600">{handover.note}</li>}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No meeting time has been set yet.</p>
        )}
      </section>

      {handover.status === 'COMPLETED' && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          The item has been returned. Thank you for using FindIt.
          {handover.resolutionNote && <span className="mt-1 block text-sm">Administrator's decision: {handover.resolutionNote}</span>}
        </div>
      )}
      {handover.status === 'DISPUTED' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="font-medium">This handover is disputed.</p>
          {handover.disputeReason && <p className="mt-1 text-sm">{handover.disputeReason}</p>}
          {handover.resolutionNote && <p className="mt-1 text-sm">Administrator's decision: {handover.resolutionNote}</p>}
        </div>
      )}
      {handover.status === 'CANCELLED' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
          This handover was cancelled.
          {handover.resolutionNote && <span className="mt-1 block text-sm">Administrator's decision: {handover.resolutionNote}</span>}
        </div>
      )}

      {can('SCHEDULED') && <ScheduleForm key={handover.updatedAt} handover={handover} onSubmit={(p) => apply(p, 'Meeting details saved.')} />}

      {(can('HANDED_OVER') || can('COMPLETED') || can('CANCELLED') || (can('DISPUTED') && !disputing)) && (
        <div className="flex flex-wrap gap-3">
          {can('HANDED_OVER') && <button type="button" onClick={() => setPending('HANDED_OVER')} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">I handed the item over</button>}
          {can('COMPLETED') && <button type="button" onClick={() => setPending('COMPLETED')} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">I received my item</button>}
          {can('CANCELLED') && <button type="button" onClick={() => setPending('CANCELLED')} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">Cancel handover</button>}
          {can('DISPUTED') && !disputing && <button type="button" onClick={() => setDisputing(true)} className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50">Report a problem</button>}
        </div>
      )}
      {can('DISPUTED') && disputing && <DisputeForm onSubmit={(p) => apply(p, 'Problem reported.')} onCancel={() => setDisputing(false)} />}

      <section aria-label="History" className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">History</h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          {handover.history.map((e, i) => (
            <li key={`${e.status}-${i}`}>
              <span className="font-medium">{HANDOVER_STATUS_LABELS[e.status] || e.status}</span>
              {' · '}{e.role === 'FINDER' ? 'finder' : e.role === 'ADMIN' ? 'administrator' : 'claimant'}{' · '}{formatDateTime(e.at)}
              {e.note && <span className="block text-slate-500">{e.note}</span>}
            </li>
          ))}
        </ol>
      </section>

      <ConfirmDialog
        open={Boolean(pending)} busy={busy}
        title={pending ? CONFIRMS[pending].title : ''} message={pending ? CONFIRMS[pending].message : ''}
        confirmLabel={pending ? CONFIRMS[pending].label : ''}
        onConfirm={() => apply({ status: pending }, CONFIRMS[pending].success)} onCancel={() => setPending(null)}
      />
    </main>
  );
}
