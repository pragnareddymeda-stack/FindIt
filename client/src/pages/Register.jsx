import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { registerSchema } from '../utils/validation.js';
import { getErrorMessage } from '../utils/errors.js';

export default function Register() {
  const { user, register: registerUser } = useAuth();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema) });

  if (user) return <Navigate to="/profile" replace />;

  const onSubmit = async ({ name, email, password }) => {
    setServerError('');
    try {
      await registerUser({ name, email, password });
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        {serverError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{serverError}</div>
        )}
        <FormField id="name" label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <FormField id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <FormField id="password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters, with a letter and a number." error={errors.password?.message} {...register('password')} />
        <FormField id="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already registered? <Link to="/login" className="font-medium text-brand-700 hover:underline">Log in</Link>
      </p>
    </main>
  );
}
