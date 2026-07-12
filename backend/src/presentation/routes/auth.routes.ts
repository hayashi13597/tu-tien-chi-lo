import { Router } from 'express';
import { registerSchema, loginSchema } from '../schemas/auth.schemas';
import { RegisterUserUseCase } from '../../application/RegisterUserUseCase';
import { LoginUserUseCase } from '../../application/LoginUserUseCase';
import { DomainError } from '../../domain/errors';

export interface AuthRouterDeps {
  registerUserUseCase: RegisterUserUseCase;
  loginUserUseCase: LoginUserUseCase;
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
      res.status(201).json(result);
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
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
