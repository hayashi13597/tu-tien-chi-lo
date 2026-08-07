import { RequestHandler, Router } from 'express';
import { DomainError } from '../../domain/errors';
import { GetAlchemyProfileUseCase } from '../../application/GetAlchemyProfileUseCase';
import { GetAlchemyQueueUseCase } from '../../application/GetAlchemyQueueUseCase';
import { ListAlchemyRecipesUseCase } from '../../application/ListAlchemyRecipesUseCase';
import { QueueAlchemyUseCase } from '../../application/QueueAlchemyUseCase';
import { RankUpAlchemyUseCase } from '../../application/RankUpAlchemyUseCase';
import { UpgradeFurnaceUseCase } from '../../application/UpgradeFurnaceUseCase';
import { AuthedRequest } from '../middleware/auth';
import { queueAlchemySchema } from '../schemas/alchemy.schemas';

export interface AlchemyRouterDeps {
  listAlchemyRecipesUseCase: ListAlchemyRecipesUseCase;
  getAlchemyQueueUseCase: GetAlchemyQueueUseCase;
  queueAlchemyUseCase: QueueAlchemyUseCase;
  getAlchemyProfileUseCase: GetAlchemyProfileUseCase;
  rankUpAlchemyUseCase: RankUpAlchemyUseCase;
  upgradeFurnaceUseCase: UpgradeFurnaceUseCase;
  requireAuth: RequestHandler;
}

export function createAlchemyRouter(deps: AlchemyRouterDeps): Router {
  const router = Router();
  router.use(deps.requireAuth);

  router.get('/recipes', async (req: AuthedRequest, res, next) => {
    try {
      res.status(200).json(await deps.listAlchemyRecipesUseCase.executeForUser(req.userId as string));
    } catch (error) {
      next(error);
    }
  });

  router.get('/profile', async (req: AuthedRequest, res, next) => {
    try {
      res.status(200).json(await deps.getAlchemyProfileUseCase.execute(req.userId as string));
    } catch (error) {
      next(error);
    }
  });

  router.post('/rank-up', async (req: AuthedRequest, res, next) => {
    try {
      res.status(200).json(await deps.rankUpAlchemyUseCase.execute(req.userId as string));
    } catch (error) {
      next(error);
    }
  });

  router.post('/furnace/upgrade', async (req: AuthedRequest, res, next) => {
    try {
      res.status(200).json(await deps.upgradeFurnaceUseCase.execute(req.userId as string));
    } catch (error) {
      next(error);
    }
  });

  router.get('/queue', async (req: AuthedRequest, res, next) => {
    try {
      res.status(200).json(await deps.getAlchemyQueueUseCase.execute(req.userId as string));
    } catch (error) {
      next(error);
    }
  });

  router.post('/queue', async (req: AuthedRequest, res, next) => {
    try {
      const parsed = queueAlchemySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('ALCHEMY_QUEUE_INVALID', parsed.error.issues[0]?.message ?? 'invalid alchemy queue input');
      }
      res.status(200).json(await deps.queueAlchemyUseCase.execute(req.userId as string, parsed.data.recipeId, parsed.data.quantity));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
