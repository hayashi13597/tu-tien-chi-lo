import { Router, RequestHandler } from 'express';
import { GetInventoryUseCase } from '../../application/GetInventoryUseCase';
import { ConsumePillUseCase } from '../../application/ConsumePillUseCase';
import { AuthedRequest } from '../middleware/auth';
import { consumePillSchema } from '../schemas/pills.schemas';
import { DomainError } from '../../domain/errors';

export interface PillsRouterDeps {
  getInventoryUseCase: GetInventoryUseCase;
  consumePillUseCase: ConsumePillUseCase;
  requireAuth: RequestHandler;
}

export function createPillsRouter(deps: PillsRouterDeps): Router {
  const router = Router();

  router.get('/inventory', deps.requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const inventory = await deps.getInventoryUseCase.execute(req.userId as string);
      res.status(200).json(inventory);
    } catch (err) {
      next(err);
    }
  });

  router.post('/consume', deps.requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const parsed = consumePillSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_INPUT', 'pillId is required');
      }
      const state = await deps.consumePillUseCase.execute(req.userId as string, parsed.data.pillId);
      res.status(200).json(state);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
