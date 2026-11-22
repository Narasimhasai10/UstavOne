import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const code = err.code || (status === 404 ? 'NOT_FOUND' : status === 400 ? 'BAD_REQUEST' : status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_SERVER_ERROR');
  const message = err.message || 'An unexpected error occurred.';

  logger.error({
    requestId: req.id,
    url: req.originalUrl,
    method: req.method,
    status,
    code,
    message,
    err
  });

  const response = {
    error: {
      code,
      message
    }
  };

  if (err.fields) {
    response.error.fields = err.fields;
  }

  res.status(status).json(response);
}
