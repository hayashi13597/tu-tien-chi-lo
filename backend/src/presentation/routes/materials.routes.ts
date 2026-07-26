import { RequestHandler, Router } from 'express';
import { GetMaterialInventoryUseCase } from '../../application/GetMaterialInventoryUseCase';
import { AuthedRequest } from '../middleware/auth';

export interface MaterialsRouterDeps {
  getMaterialInventoryUseCase: GetMaterialInventoryUseCase;
  requireAuth: RequestHandler;
}

export function createMaterialsRouter(deps: MaterialsRouterDeps): Router {
  const router = Router();

  router.get('/inventory', deps.requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      res.status(200).json(await deps.getMaterialInventoryUseCase.execute(req.userId as string));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
