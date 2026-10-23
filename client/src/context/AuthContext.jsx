import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMe, loginRequest, registerRequest, logoutRequest, updateProfileRequest } from '../api/auth.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Session restoration after a page refresh: ask the server who the cookie belongs to.
  useEffect(() => {
    let active = true;
    fetchMe()
      .then((u) => active && setUser(u))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const login = useCallback(async (values) => setUser(await loginRequest(values)), []);
  const register = useCallback(async (values) => setUser(await registerRequest(values)), []);
  const logout = useCallback(async () => {
    try { await logoutRequest(); } finally { setUser(null); }
  }, []);
  const updateProfile = useCallback(async (values) => setUser(await updateProfileRequest(values)), []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, updateProfile }),
    [user, loading, login, register, logout, updateProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
