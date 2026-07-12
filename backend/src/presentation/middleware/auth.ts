import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../../domain/ports/TokenService';

export interface AuthedRequest extends Request {
  userId?: string;
}

// Factory, not a bare middleware: depends on the TokenService port (Task 6)
// rather than importing jsonwebtoken directly, so presentation/ stays decoupled
// from which token implementation the composition root wires in.
export function createRequireAuth(tokenService: TokenService) {
  return function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } });
      return;
    }

    const token = header.slice('Bearer '.length);
    try {
      // Writes its own 401 response directly (not via next(err)/DomainError):
      // this middleware runs before a route handler's try/catch exists.
      const payload = tokenService.verifyAccessToken(token);
      req.userId = payload.userId;
      next();
    } catch {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    }
  };
}
