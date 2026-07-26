import { RequestHandler, Router } from 'express';
import { DomainError } from '../../domain/errors';
import { GetAlchemyQueueUseCase } from '../../application/GetAlchemyQueueUseCase';
import { ListAlchemyRecipesUseCase } from '../../application/ListAlchemyRecipesUseCase';
import { QueueAlchemyUseCase } from '../../application/QueueAlchemyUseCase';
import { AuthedRequest } from '../middleware/auth';
import { queueAlchemySchema } from '../schemas/alchemy.schemas';

export interface AlchemyRouterDeps {
  listAlchemyRecipesUseCase: ListAlchemyRecipesUseCase;
  getAlchemyQueueUseCase: GetAlchemyQueueUseCase;
  queueAlchemyUseCase: QueueAlchemyUseCase;
  requireAuth: RequestHandler;
}

export function createAlchemyRouter(deps: AlchemyRouterDeps): Router {
  const router = Router();
  router.use(deps.requireAuth);

  router.get('/recipes', async (_req, res, next) => {
    try {
      res.status(200).json(await deps.listAlchemyRecipesUseCase.execute());
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
