import { useContext } from 'react';
import { RealtimeContext } from '../context/RealtimeContext.jsx';

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside <RealtimeProvider>');
  return ctx;
}
