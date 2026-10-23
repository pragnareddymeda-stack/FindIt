import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { loginSchema } from '../utils/validation.js';
import { getErrorMessage } from '../utils/errors.js';

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  if (user) return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;

  const onSubmit = async (values) => {
    setServerError('');
    try {
      await login(values);
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Log in</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        {serverError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{serverError}</div>
        )}
        <FormField id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <FormField id="password" label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        New to FindIt? <Link to="/register" className="font-medium text-brand-700 hover:underline">Create an account</Link>
      </p>
    </main>
  );
}
