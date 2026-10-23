import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReportForm from '../components/ReportForm.jsx';
import { getItem, updateItem, uploadItemImage, deleteItemImage } from '../api/items.js';
import { useToast } from '../hooks/useToast.js';
import { toDateInputValue } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';

export default function EditReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [state, setState] = useState({ loading: true, item: null, error: '' });

  useEffect(() => {
    let active = true;
    getItem(id)
      .then((item) => active && setState({ loading: false, item, error: '' }))
      .catch((err) => active && setState({ loading: false, item: null, error: getErrorMessage(err) }));
    return () => { active = false; };
  }, [id]);

  if (state.loading) return <main className="mx-auto max-w-2xl px-4 py-10"><div role="status" className="h-40 animate-pulse rounded-2xl bg-slate-200" aria-label="Loading report" /></main>;
  if (state.error) return <main className="mx-auto max-w-2xl px-4 py-10"><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{state.error}</div></main>;

  const { item } = state;
  if (!item.isOwner || item.status !== 'ACTIVE') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          Only the owner can edit a report, and only while it is active.{' '}
          <Link to={`/items/${id}`} className="font-medium underline">Back to the report</Link>
        </div>
      </main>
    );
  }

  const defaultValues = {
    title: item.title, category: item.category, description: item.description,
    dateOccurred: toDateInputValue(item.dateOccurred), approxTime: item.approxTime || '',
    location: item.location, contactPreference: item.contactPreference,
    privateDetails: item.privateDetails || '',
    verificationQuestions: item.verificationQuestions?.length
      ? item.verificationQuestions.map((q) => ({ question: q.question, expectedAnswer: q.expectedAnswer || '' }))
      : undefined,
  };

  const onSubmit = async (values, image) => {
    await updateItem(id, values);
    toast.success('Report updated.');
    try {
      if (image?.file) await uploadItemImage(id, image.file);
      else if (image?.remove) await deleteItemImage(id);
    } catch (err) {
      toast.error(`Your changes are saved, but the photo could not be updated: ${getErrorMessage(err)}`);
    }
    navigate(`/items/${id}`);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Edit report</h1>
      <ReportForm type={item.type} defaultValues={defaultValues} existingImageUrl={item.imageUrl} submitLabel="Save changes" onSubmit={onSubmit} />
    </main>
  );
}
