import { Link } from 'react-router-dom';
import { CalendarDays, MapPin } from 'lucide-react';
import StatusBadge, { TypeBadge } from './StatusBadge.jsx';
import { categoryLabel } from '../utils/constants.js';
import { formatDate } from '../utils/format.js';

export default function ItemCard({ item, footer }) {
  return (
    <li className="flex flex-col rounded-2xl border border-slate-200 bg-white transition hover:border-brand-500 hover:shadow-sm">
      <Link to={`/items/${item.id}`} className="block flex-1">
        {item.imageUrl && <img src={item.imageUrl} alt={`Photo of ${item.title}`} loading="lazy" className="h-36 w-full rounded-t-2xl object-cover" />}
        <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={item.type} />
          {item.status !== 'ACTIVE' && <StatusBadge status={item.status} />}
          {item.isOwner && <span className="text-xs font-medium text-brand-700">Your report</span>}
        </div>
        <h3 className="mt-2 font-semibold text-slate-900">{item.title}</h3>
        <p className="text-sm text-slate-500">{categoryLabel(item.category)}</p>
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.description}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{item.location}</span>
          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{formatDate(item.dateOccurred)}</span>
        </div>
        </div>
      </Link>
      {footer && <div className="border-t border-slate-100 px-4 py-3">{footer}</div>}
    </li>
  );
}
