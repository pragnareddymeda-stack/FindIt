import { useEffect, useState } from 'react';
import { MAX_IMAGE_BYTES } from '../hooks/useConfig.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** Optional photo field. Checks type and size in the browser for quick feedback; the server checks again. */
export default function ImagePicker({ existingUrl, file, onFileChange, removeExisting, onRemoveExistingChange, maxBytes = MAX_IMAGE_BYTES }) {
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== 'function') {
      setPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL?.(url);
  }, [file]);

  const pick = (e) => {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    if (!ALLOWED.includes(chosen.type)) {
      setError('Choose a JPEG, PNG or WebP image');
    } else if (chosen.size > maxBytes) {
      setError(`The image is too large (maximum ${Math.round(maxBytes / 1024 / 1024)} MB)`);
    } else {
      setError('');
      onFileChange(chosen);
    }
  };

  const showExisting = existingUrl && !file && !removeExisting;
  return (
    <div>
      <label htmlFor="photo" className="mb-1 block text-sm font-medium text-slate-700">Photo (optional)</label>
      {showExisting && (
        <div className="mb-2">
          <img src={existingUrl} alt="Current photo of the item" className="h-32 rounded-lg object-cover" />
          <button type="button" onClick={() => onRemoveExistingChange(true)} className="mt-1 text-sm font-medium text-red-700 hover:underline">Remove photo</button>
        </div>
      )}
      {existingUrl && removeExisting && !file && (
        <p className="mb-2 text-sm text-slate-600">
          The photo will be removed when you save.{' '}
          <button type="button" onClick={() => onRemoveExistingChange(false)} className="font-medium text-brand-700 hover:underline">Keep photo</button>
        </p>
      )}
      {file && (
        <div className="mb-2">
          {preview && <img src={preview} alt="Preview of the chosen photo" className="h-32 rounded-lg object-cover" />}
          <p className="text-sm text-slate-600">{file.name}</p>
          <button type="button" onClick={() => { onFileChange(null); setError(''); }} className="mt-1 text-sm font-medium text-red-700 hover:underline">Remove chosen photo</button>
        </div>
      )}
      <input
        id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={pick}
        aria-describedby="photo-hint" aria-invalid={error ? 'true' : 'false'}
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-medium file:text-brand-700"
      />
      <p id="photo-hint" className="mt-1 text-xs text-slate-500">JPEG, PNG or WebP, up to {Math.round(maxBytes / 1024 / 1024)} MB. Avoid photos that show serial numbers, card numbers or faces.</p>
      {error && <p role="alert" className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
