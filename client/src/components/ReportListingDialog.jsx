import { useEffect, useState } from 'react';
import FormField from './FormField.jsx';
import { reportListing } from '../api/items.js';
import { useToast } from '../hooks/useToast.js';
import { ABUSE_REASON_OPTIONS } from '../utils/constants.js';
import { getErrorMessage } from '../utils/errors.js';

/** Lets a signed-in user flag a listing for the moderators. */
export default function ReportListingDialog({ open, itemId, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setReason('');
    setDetails('');
    setError('');
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!reason) {
      setError('Choose a reason');
      return;
    }
    setBusy(true);
    try {
      await reportListing(itemId, { reason, details: details.trim() });
      toast.success('Thank you. A moderator will review this listing.');
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <form role="dialog" aria-modal="true" aria-labelledby="report-title" onSubmit={submit} noValidate className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="report-title" className="text-lg font-semibold text-slate-900">Report this listing</h2>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        <FormField id="abuse-reason" label="What is wrong with it?" as="select" value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }}>
          <option value="">Choose a reason</option>
          {ABUSE_REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </FormField>
        <FormField id="abuse-details" label="More details (optional)" as="textarea" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">{busy ? 'Sending…' : 'Send report'}</button>
        </div>
      </form>
    </div>
  );
}
