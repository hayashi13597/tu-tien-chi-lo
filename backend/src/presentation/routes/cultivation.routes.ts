import { Router, RequestHandler } from 'express';
import { GetCultivationStateUseCase } from '../../application/GetCultivationStateUseCase';
import { AttemptBreakthroughUseCase } from '../../application/AttemptBreakthroughUseCase';
import { AuthedRequest } from '../middleware/auth';

export interface CultivationRouterDeps {
  getCultivationStateUseCase: GetCultivationStateUseCase;
  attemptBreakthroughUseCase: AttemptBreakthroughUseCase;
  requireAuth: RequestHandler;
}

export function createCultivationRouter(deps: CultivationRouterDeps): Router {
  const router = Router();

  router.get('/state', deps.requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const state = await deps.getCultivationStateUseCase.execute(req.userId as string);
      res.status(200).json(state);
    } catch (err) {
      next(err);
    }
  });

  router.post('/breakthrough', deps.requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const result = await deps.attemptBreakthroughUseCase.execute(req.userId as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
