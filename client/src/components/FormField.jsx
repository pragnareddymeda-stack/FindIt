import { forwardRef } from 'react';

/** Accessible label + control + hint/error. `as` can be 'input' (default), 'textarea' or 'select'. */
const FormField = forwardRef(function FormField({ label, id, error, hint, as: Tag = 'input', type = 'text', children, ...props }, ref) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  const extra = Tag === 'input' ? { type } : {};
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <Tag
        id={id}
        ref={ref}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 ${error ? 'border-red-400' : 'border-slate-300'}`}
        {...extra}
        {...props}
      >
        {children}
      </Tag>
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
});

export default FormField;
