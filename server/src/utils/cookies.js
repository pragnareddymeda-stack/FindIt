import { config } from '../config/env.js';

export const AUTH_COOKIE = 'findit_token';
export const CSRF_COOKIE = 'findit_csrf';
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function cookieOptions(extra = {}) {
  const sameSite = config.cookieSameSite;
  return {
    httpOnly: true,
    secure: config.isProduction || sameSite === 'none',
    sameSite,
    domain: config.cookieDomain,
    path: '/',
    ...extra,
  };
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, cookieOptions({ maxAge: AUTH_COOKIE_MAX_AGE_MS }));
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
}
