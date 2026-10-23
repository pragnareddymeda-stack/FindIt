import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import FormField from './FormField.jsx';
import ImagePicker from './ImagePicker.jsx';
import { useConfig } from '../hooks/useConfig.js';
import { buildReportSchema } from '../utils/validation.js';
import { CATEGORY_OPTIONS, CONTACT_OPTIONS } from '../utils/constants.js';
import { todayISO } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';

const EMPTY = {
  title: '', category: '', description: '', dateOccurred: '', approxTime: '', location: '',
  contactPreference: 'IN_APP', privateDetails: '', verificationQuestions: [{ question: '', expectedAnswer: '' }],
};

/** Shared by the create and edit pages. onSubmit(payload) must throw on failure. */
export default function ReportForm({ type, defaultValues, submitLabel, onSubmit, existingImageUrl = '' }) {
  const { uploadsEnabled } = useConfig();
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const isFound = type === 'FOUND';
  const [serverError, setServerError] = useState('');
  const {
    register, control, handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(buildReportSchema(type)), defaultValues: { ...EMPTY, ...defaultValues } });
  const { fields, append, remove } = useFieldArray({ control, name: 'verificationQuestions' });

  const submit = async (values) => {
    setServerError('');
    const payload = { ...values };
    if (isFound) {
      payload.verificationQuestions = values.verificationQuestions.map((q) => ({ question: q.question, expectedAnswer: q.expectedAnswer || '' }));
    } else {
      delete payload.privateDetails;
      delete payload.verificationQuestions;
    }
    try {
      await onSubmit(payload, { file: imageFile, remove: removeImage });
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  const questionsError = errors.verificationQuestions?.message ?? errors.verificationQuestions?.root?.message;

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      {serverError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{serverError}</div>}

      <FormField id="title" label="Title" error={errors.title?.message} {...register('title')} />
      <FormField id="category" label="Category" as="select" error={errors.category?.message} {...register('category')}>
        <option value="">Choose a category</option>
        {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </FormField>
      <FormField
        id="description" label="Description" as="textarea" rows={4}
        hint={isFound ? 'Describe it in general terms. Keep unique identifying details for the private section below.' : 'Colour, brand, size, distinguishing marks.'}
        error={errors.description?.message} {...register('description')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="dateOccurred" label="Date" type="date" max={todayISO()} error={errors.dateOccurred?.message} {...register('dateOccurred')} />
        <FormField id="approxTime" label="Approximate time (optional)" type="time" error={errors.approxTime?.message} {...register('approxTime')} />
      </div>
      <FormField id="location" label="General location" hint="For example: Central library, Hostel B canteen. Do not give a home address." error={errors.location?.message} {...register('location')} />
      <FormField
        id="contactPreference" label="Contact preference" as="select"
        hint="Your email and phone are never shown on the report."
        error={errors.contactPreference?.message} {...register('contactPreference')}
      >
        {CONTACT_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </FormField>

      {uploadsEnabled && (
        <ImagePicker
          existingUrl={existingImageUrl} file={imageFile} onFileChange={setImageFile}
          removeExisting={removeImage} onRemoveExistingChange={setRemoveImage}
        />
      )}

      {isFound && (
        <fieldset className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
          <legend className="px-1 text-sm font-semibold text-brand-900">Private verification (never shown publicly)</legend>
          <FormField
            id="privateDetails" label="Private identifying details (optional)" as="textarea" rows={3}
            hint="Details only the true owner would know, kept for your own reference."
            error={errors.privateDetails?.message} {...register('privateDetails')}
          />
          {fields.map((field, i) => (
            <div key={field.id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
              <FormField
                id={`vq-${i}`} label={`Verification question ${i + 1}`}
                error={errors.verificationQuestions?.[i]?.question?.message}
                {...register(`verificationQuestions.${i}.question`)}
              />
              <FormField
                id={`va-${i}`} label={`Expected answer ${i + 1} (optional)`}
                hint="Only you can see this. Claimants never do."
                error={errors.verificationQuestions?.[i]?.expectedAnswer?.message}
                {...register(`verificationQuestions.${i}.expectedAnswer`)}
              />
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(i)} className="flex items-center gap-1 text-sm font-medium text-red-700 hover:underline">
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove question {i + 1}
                </button>
              )}
            </div>
          ))}
          {questionsError && <p className="text-sm text-red-600">{questionsError}</p>}
          <button
            type="button" disabled={fields.length >= 5}
            onClick={() => append({ question: '', expectedAnswer: '' })}
            className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add another question
          </button>
        </fieldset>
      )}

      <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60">
        {isSubmitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
