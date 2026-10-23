import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { profileSchema } from '../utils/validation.js';
import { getErrorMessage } from '../utils/errors.js';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [message, setMessage] = useState({ type: '', text: '' });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, phone: user.phone || '' },
  });

  const onSubmit = async (values) => {
    setMessage({ type: '', text: '' });
    try {
      await updateProfile(values);
      setMessage({ type: 'success', text: 'Profile saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err) });
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Your profile</h1>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-slate-600">
        <dt className="font-medium">Email</dt>
        <dd>{user.email}</dd>
        <dt className="font-medium">Role</dt>
        <dd>{user.role}</dd>
      </dl>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        {message.text && (
          <div
            role={message.type === 'error' ? 'alert' : 'status'}
            className={`rounded-lg border p-3 text-sm ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}
          >
            {message.text}
          </div>
        )}
        <FormField id="name" label="Full name" error={errors.name?.message} {...register('name')} />
        <FormField id="phone" label="Phone (optional)" type="tel" hint="Kept private. Not shown on your reports." error={errors.phone?.message} {...register('phone')} />
        <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </main>
  );
}
