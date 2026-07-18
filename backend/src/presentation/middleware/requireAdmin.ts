import { Response, NextFunction } from 'express';
import { AuthedRequest } from './auth';
import { DomainError } from '../../domain/errors';

// Authorization guard — must run AFTER requireAuth (which sets req.role from the
// access token). Non-admins are rejected via next(err) so the central
// errorHandler maps FORBIDDEN → 403, keeping HTTP-status decisions in one place.
export function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction) {
  if (req.role !== 'admin') {
    next(new DomainError('FORBIDDEN', 'Admin privileges required'));
    return;
  }
  next();
}
