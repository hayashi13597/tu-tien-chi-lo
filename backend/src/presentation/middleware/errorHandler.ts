import { Request, Response, NextFunction } from 'express';
import { DomainError } from '../../domain/errors';

// The only place DomainError.code is mapped to an HTTP status — keeps that
// mapping decision out of domain/ and application/ entirely.
const STATUS_BY_CODE: Record<string, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_REFRESH_TOKEN: 401,
  USERNAME_TAKEN: 409,
  CONCURRENT_MODIFICATION: 409,
  CHARACTER_NOT_FOUND: 404,
  INSUFFICIENT_LINH_KHI: 400,
  PUNISHED: 400,
  MAX_STAGE_REACHED: 400,
  PILL_NOT_FOUND: 404,
  PILL_OUT_OF_STOCK: 409,
  PILL_NOT_APPLICABLE: 400,
  FORBIDDEN: 403,
  INVALID_REALM_CONFIG: 400,
};

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof DomainError) {
    const status = STATUS_BY_CODE[err.code] ?? 500;
    res.status(status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
