import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../../domain/ports/TokenService';

export interface AuthedRequest extends Request {
  userId?: string;
}

// Factory, not a bare middleware: depends on the TokenService port rather
// than importing jsonwebtoken directly, so presentation/ stays decoupled
// from which token implementation the composition root wires in.
export function createRequireAuth(tokenService: TokenService) {
  return function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    // Cookie takes precedence over the header: browser callers (the
    // intended Phase 2 audience) always send the cookie once logged in, so
    // checking it first means a stale/manually-set header can never shadow
    // the session the browser's cookie jar actually holds.
    const cookieToken = req.cookies?.access_token as string | undefined;
    const header = req.headers.authorization;
    const headerToken =
      header && header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    const token = cookieToken ?? headerToken;
    if (!token) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing bearer token or access_token cookie' } });
      return;
    }

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
