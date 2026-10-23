import { ApiError } from '../utils/ApiError.js';

/** Validates req.body with a zod schema. Unknown keys are stripped (mass-assignment protection). */
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(new ApiError(400, 'Validation failed', details));
  }
  req.body = result.data;
  next();
};

/** Validates req.query; the parsed result is available as req.validatedQuery. */
export const validateQuery = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.query ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(new ApiError(400, 'Invalid query parameters', details));
  }
  req.validatedQuery = result.data;
  next();
};
