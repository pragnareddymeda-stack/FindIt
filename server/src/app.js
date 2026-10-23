import path from 'node:path';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { createRoutes } from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { csrfProtection } from './middleware/csrf.js';
import { ApiError } from './utils/ApiError.js';
import { config } from './config/env.js';

export function createApp(options = {}) {
  const app = express();

  if (config.isProduction) app.set('trust proxy', 1); // correct client IPs behind a hosting proxy
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Photos come from Cloudinary; blob: is for previewing a chosen file before upload.
          'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
          'upgrade-insecure-requests': config.isProduction ? [] : null,
        },
      },
    }),
  );
  // Credentialed CORS with one explicit origin (required for cookie auth)
  app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (config.nodeEnv !== 'test') app.use(morgan('dev'));

  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: options.apiRateLimitMax ?? config.apiRateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, _res, next) => next(new ApiError(429, 'Too many requests. Please slow down and try again shortly.')),
    }),
  );

  const routes = createRoutes({
    rateLimitMax: options.authRateLimitMax ?? config.authRateLimitMax,
    messageRateLimitMax: options.messageRateLimitMax ?? config.messageRateLimitMax,
  });
  app.use('/api/v1', csrfProtection, routes);

  // Optional single-origin deployment: serve the built React app from this server. API paths never fall through to it.
  const clientDist = options.clientDist ?? (config.serveClient ? config.clientDistPath : null);
  if (clientDist) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res, next) => {
      res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next(err));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
