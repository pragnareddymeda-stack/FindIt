import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500">
        <span>FindIt helps lost belongings find their way home.</span>
        <nav aria-label="Footer" className="flex gap-4">
          <Link to="/safety" className="font-medium text-slate-700 hover:underline">Safety guidelines</Link>
          <Link to="/items" className="font-medium text-slate-700 hover:underline">Browse reports</Link>
        </nav>
      </div>
    </footer>
  );
}
