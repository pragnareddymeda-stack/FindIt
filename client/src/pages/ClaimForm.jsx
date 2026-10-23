import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import FormField from '../components/FormField.jsx';
import SafetyNote from '../components/SafetyNote.jsx';
import { getItem } from '../api/items.js';
import { createClaim } from '../api/claims.js';
import { useToast } from '../hooks/useToast.js';
import { claimSchema } from '../utils/validation.js';
import { getErrorMessage } from '../utils/errors.js';

function ClaimFormInner({ item }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [serverError, setServerError] = useState('');
  const {
    register, handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      explanation: '', evidence: '',
      answers: item.claimQuestions.map((q) => ({ questionId: q.id, answer: '' })),
    },
  });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const claim = await createClaim(item.id, { ...values, evidence: values.evidence || '' });
      toast.success('Claim submitted. The finder will review it.');
      navigate(`/claims/${claim.id}`);
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      {serverError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{serverError}</div>}
      <FormField
        id="explanation" label="Why does this item belong to you?" as="textarea" rows={4}
        hint="Describe where and when you lost it and anything that identifies it."
        error={errors.explanation?.message} {...register('explanation')}
      />
      {item.claimQuestions.map((q, i) => (
        <div key={q.id}>
          <input type="hidden" {...register(`answers.${i}.questionId`)} />
          <FormField id={`answer-${i}`} label={q.question} error={errors.answers?.[i]?.answer?.message} {...register(`answers.${i}.answer`)} />
        </div>
      ))}
      <FormField
        id="evidence" label="Supporting evidence (optional)" as="textarea" rows={3}
        hint="For example: a receipt, a serial number, or a distinctive mark you can describe."
        error={errors.evidence?.message} {...register('evidence')}
      />
      <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60">
        {isSubmitting ? 'Submitting…' : 'Submit claim'}
      </button>
    </form>
  );
}

export default function ClaimForm() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, item: null, error: '' });

  useEffect(() => {
    let active = true;
    getItem(id)
      .then((item) => active && setState({ loading: false, item, error: '' }))
      .catch((err) => active && setState({ loading: false, item: null, error: getErrorMessage(err) }));
    return () => { active = false; };
  }, [id]);

  if (state.loading) return <main className="mx-auto max-w-2xl px-4 py-10"><div role="status" className="h-48 animate-pulse rounded-2xl bg-slate-200" aria-label="Loading item" /></main>;
  if (state.error) return <main className="mx-auto max-w-2xl px-4 py-10"><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{state.error}</div></main>;

  const { item } = state;
  if (!item.claimQuestions) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          This item cannot be claimed. It may be your own report, or no longer active.{' '}
          <Link to={`/items/${id}`} className="font-medium underline">Back to the report</Link>
        </div>
      </main>
    );
  }
  if (item.myActiveClaim) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div role="status" className="rounded-xl border border-slate-200 bg-white p-4">
          You already have a claim on this item.{' '}
          <Link to={`/claims/${item.myActiveClaim.id}`} className="font-medium text-brand-700 underline">View your claim</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Claim: {item.title}</h1>
      <p className="mt-1 mb-4 text-sm text-slate-600">Answer from memory. Guessing wrong answers makes a claim less convincing.</p>
      <SafetyNote>
        Answering questions cannot prove ownership on its own. The finder may ask for more evidence, and should hand items over
        only in a public, well-lit place.
      </SafetyNote>
      <ClaimFormInner item={item} />
    </main>
  );
}
