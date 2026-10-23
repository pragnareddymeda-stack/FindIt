import { ShieldAlert } from 'lucide-react';

export default function SafetyNote({ children }) {
  return (
    <aside className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </aside>
  );
}
