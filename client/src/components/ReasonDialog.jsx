import { useEffect, useRef, useState } from 'react';

/** A confirmation dialog that also collects a written reason or note. */
export default function ReasonDialog({
  open, title, message, confirmLabel = 'Confirm', reasonLabel = 'Reason', required = false, minLength = 5,
  danger = false, busy = false, onConfirm, onCancel,
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setReason('');
    setError('');
    inputRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (required && trimmed.length < minLength) {
      setError(`Enter at least ${minLength} characters`);
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <form role="dialog" aria-modal="true" aria-labelledby="reason-title" onSubmit={submit} noValidate className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="reason-title" className="text-lg font-semibold text-slate-900">{title}</h2>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
        <label htmlFor="reason-input" className="mt-4 block text-sm font-medium text-slate-700">{reasonLabel}{required ? '' : ' (optional)'}</label>
        <textarea
          id="reason-input" ref={inputRef} rows={3} value={reason} maxLength={300}
          onChange={(e) => { setReason(e.target.value); setError(''); }}
          aria-invalid={error ? 'true' : 'false'} aria-describedby={error ? 'reason-error' : undefined}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        {error && <p id="reason-error" className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={busy} className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
