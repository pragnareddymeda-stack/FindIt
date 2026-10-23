import { useEffect, useState } from 'react';
import { getConfig } from '../api/config.js';

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // keep in sync with the server limit

export function useConfig() {
  const [config, setConfig] = useState({ uploadsEnabled: false, loaded: false });
  useEffect(() => {
    let active = true;
    getConfig().then((c) => active && setConfig({ ...c, loaded: true }));
    return () => { active = false; };
  }, []);
  return config;
}
