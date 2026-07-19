import { Router, RequestHandler } from 'express';
import { registerSchema, loginSchema } from '../schemas/auth.schemas';
import { RegisterUserUseCase } from '../../application/RegisterUserUseCase';
import { LoginUserUseCase } from '../../application/LoginUserUseCase';
import { RefreshAccessTokenUseCase } from '../../application/RefreshAccessTokenUseCase';
import { GetCurrentUserUseCase } from '../../application/GetCurrentUserUseCase';
import { DomainError } from '../../domain/errors';
import { setAuthCookies, clearAuthCookies } from '../cookies';
import { AuthedRequest } from '../middleware/auth';

export interface AuthRouterDeps {
  registerUserUseCase: RegisterUserUseCase;
  loginUserUseCase: LoginUserUseCase;
  refreshAccessTokenUseCase: RefreshAccessTokenUseCase;
  getCurrentUserUseCase: GetCurrentUserUseCase;
  requireAuth: RequestHandler;
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  router.post('/register', async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_INPUT', parsed.error.issues[0].message);
      }
      const result = await deps.registerUserUseCase.execute(parsed.data);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      // Explicit field selection — never res.json(result) — so accessToken/
      // refreshToken never leak into the JSON body; they travel only via
      // the httpOnly cookies just set above.
      res.status(201).json({ id: result.id, username: result.username });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_INPUT', parsed.error.issues[0].message);
      }
      const result = await deps.loginUserUseCase.execute(parsed.data);
      setAuthCookies(res, result.token, result.refreshToken);
      // Response body keeps its Phase 1 shape ({ token }) for header-based
      // callers; refreshToken is cookie-only, never in the JSON body.
      res.status(200).json({ token: result.token });
    } catch (err) {
      next(err);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      // Cookie only, no header fallback: the whole point of this endpoint is
      // to work once the access token has already expired.
      const refreshToken = req.cookies?.refresh_token as string | undefined;
      if (!refreshToken) {
        throw new DomainError('INVALID_REFRESH_TOKEN', 'Missing refresh token');
      }
      const result = await deps.refreshAccessTokenUseCase.execute(refreshToken);
      setAuthCookies(res, result.token, result.refreshToken);
      res.status(200).json({ token: result.token });
    } catch (err) {
      next(err);
    }
  });

  // No use case, no auth, no DB read: logout has zero business logic (it's
  // idempotent and always succeeds, whether or not the caller had a session),
  // so it's handled directly here rather than through an application-layer
  // indirection with nothing to orchestrate.
  router.post('/logout', (_req, res) => {
    clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out' });
  });

  // Who am I? Used by the frontend to gate /admin and show admin-only menu
  // items. requireAuth is applied per-route: the other /auth endpoints must
  // stay reachable without a session.
  router.get('/me', deps.requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const result = await deps.getCurrentUserUseCase.execute({
        userId: req.userId as string,
        role: req.role ?? 'user',
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
