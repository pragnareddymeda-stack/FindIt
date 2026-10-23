import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/env.js';

export function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// Centralized handler. Never leaks stack traces or internals to the client.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message;
  let details = err.details;

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  } else if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'The image is too large (maximum 3 MB)' : 'Invalid upload';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid identifier';
  }

  if (status >= 500) {
    if (config.nodeEnv !== 'test') console.error(err);
    message = 'Internal server error';
    details = undefined;
  }

  const body = { success: false, message };
  if (details) body.details = details;
  if (err.code && typeof err.code === 'string' && status < 500) body.code = err.code;
  res.status(status).json(body);
}
