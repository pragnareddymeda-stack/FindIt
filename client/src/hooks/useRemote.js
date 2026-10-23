import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../utils/errors.js';

/** Runs `loader()` whenever `deps` change (or `reload()` is called) and tracks loading, data and error. */
export function useRemote(loader, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [key, setKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    loader()
      .then((data) => active && setState({ loading: false, data, error: '' }))
      .catch((err) => active && setState({ loading: false, data: null, error: getErrorMessage(err) }));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, key]);

  const reload = useCallback(() => setKey((k) => k + 1), []);
  return { ...state, reload };
}
