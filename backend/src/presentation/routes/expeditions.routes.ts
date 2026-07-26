import { RequestHandler, Router } from 'express';
import { DomainError } from '../../domain/errors';
import { ListExpeditionBranchesUseCase } from '../../application/ListExpeditionBranchesUseCase';
import { GetCurrentExpeditionUseCase } from '../../application/GetCurrentExpeditionUseCase';
import { StartExpeditionUseCase } from '../../application/StartExpeditionUseCase';
import { ClaimExpeditionUseCase } from '../../application/ClaimExpeditionUseCase';
import { AuthedRequest } from '../middleware/auth';
import { startExpeditionSchema } from '../schemas/expedition.schemas';

export interface ExpeditionsRouterDeps {
  listExpeditionBranchesUseCase: ListExpeditionBranchesUseCase;
  getCurrentExpeditionUseCase: GetCurrentExpeditionUseCase;
  startExpeditionUseCase: StartExpeditionUseCase;
  claimExpeditionUseCase: ClaimExpeditionUseCase;
  requireAuth: RequestHandler;
}

export function createExpeditionsRouter(deps: ExpeditionsRouterDeps): Router {
  const router = Router();
  router.use(deps.requireAuth);

  router.get('/branches', async (_req, res, next) => {
    try {
      res.status(200).json(await deps.listExpeditionBranchesUseCase.execute());
    } catch (error) {
      next(error);
    }
  });

  router.get('/current', async (req: AuthedRequest, res, next) => {
    try {
      res.status(200).json(await deps.getCurrentExpeditionUseCase.execute(req.userId as string));
    } catch (error) {
      next(error);
    }
  });

  router.post('/start', async (req: AuthedRequest, res, next) => {
    try {
      const parsed = startExpeditionSchema.safeParse(req.body);
      if (!parsed.success) throw new DomainError('INVALID_EXPEDITION_CONFIG', parsed.error.issues[0]?.message ?? 'invalid expedition input');
      res.status(200).json(await deps.startExpeditionUseCase.execute(req.userId as string, parsed.data));
    } catch (error) {
      next(error);
    }
  });

  router.post('/claim', async (req: AuthedRequest, res, next) => {
    try {
      res.status(200).json(await deps.claimExpeditionUseCase.execute(req.userId as string));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
