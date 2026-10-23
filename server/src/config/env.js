import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const REQUIRED = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL'];
const SAME_SITE = ['lax', 'strict', 'none'];
const CLOUDINARY_VARS = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

/** Returns names (never values) of missing required variables. */
export function findMissingEnv(env = process.env) {
  return REQUIRED.filter((name) => !env[name] || !String(env[name]).trim());
}

/** Fails fast at startup and reports only variable names. */
export function validateEnv(env = process.env) {
  const missing = findMissingEnv(env);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  // Cloudinary is optional, but a half-configured setup is almost certainly a mistake.
  const setCloud = CLOUDINARY_VARS.filter((n) => env[n] && String(env[n]).trim());
  if (setCloud.length > 0 && setCloud.length < CLOUDINARY_VARS.length) {
    throw new Error(`Set all of ${CLOUDINARY_VARS.join(', ')} or none of them. Missing: ${CLOUDINARY_VARS.filter((n) => !setCloud.includes(n)).join(', ')}`);
  }
  if (env.COOKIE_SAMESITE && !SAME_SITE.includes(env.COOKIE_SAMESITE.toLowerCase())) {
    throw new Error('COOKIE_SAMESITE must be one of: lax, strict, none');
  }
}

export const config = {
  get port() { return Number(process.env.PORT) || 5000; },
  get nodeEnv() { return process.env.NODE_ENV || 'development'; },
  get clientUrl() { return process.env.CLIENT_URL || 'http://localhost:5173'; },
  get isProduction() { return (process.env.NODE_ENV || 'development') === 'production'; },
  get jwtSecret() { return process.env.JWT_SECRET; },
  get cookieSameSite() { return (process.env.COOKIE_SAMESITE || 'lax').toLowerCase(); },
  get cookieDomain() { return process.env.COOKIE_DOMAIN || undefined; },
  get bcryptRounds() { return Number(process.env.BCRYPT_ROUNDS) || 12; },
  get authRateLimitMax() { return Number(process.env.AUTH_RATE_LIMIT_MAX) || 10; },
  get apiRateLimitMax() { return Number(process.env.API_RATE_LIMIT_MAX) || 600; },
  get cloudinaryEnabled() { return CLOUDINARY_VARS.every((n) => process.env[n] && String(process.env[n]).trim()); },
  get serveClient() { return process.env.SERVE_CLIENT === 'true'; },
  get clientDistPath() { return process.env.CLIENT_DIST_PATH || fileURLToPath(new URL('../../../client/dist', import.meta.url)); },
  get messageRateLimitMax() { return Number(process.env.MESSAGE_RATE_LIMIT_MAX) || 30; },
};
