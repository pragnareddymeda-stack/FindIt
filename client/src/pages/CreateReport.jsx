import { useNavigate } from 'react-router-dom';
import ReportForm from '../components/ReportForm.jsx';
import { createItem, uploadItemImage } from '../api/items.js';
import { useToast } from '../hooks/useToast.js';
import { getErrorMessage } from '../utils/errors.js';

export default function CreateReport({ type }) {
  const navigate = useNavigate();
  const toast = useToast();
  const isFound = type === 'FOUND';

  const onSubmit = async (values, image) => {
    const item = await createItem({ type, ...values });
    toast.success(isFound ? 'Found report published.' : 'Lost report published.');
    if (image?.file) {
      // The report already exists, so a failed upload must not undo it.
      try {
        await uploadItemImage(item.id, image.file);
      } catch (err) {
        toast.error(`Your report is published, but the photo could not be uploaded: ${getErrorMessage(err)}`);
      }
    }
    navigate(`/items/${item.id}`);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{isFound ? 'Report a found item' : 'Report a lost item'}</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        {isFound
          ? 'Thank you for helping. Add private questions so only the real owner can claim it.'
          : 'The more specific you are, the easier it is for a finder to recognise your item.'}
      </p>
      <ReportForm type={type} submitLabel="Publish report" onSubmit={onSubmit} />
    </main>
  );
}
