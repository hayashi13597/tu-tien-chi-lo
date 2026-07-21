import { Router, RequestHandler } from 'express';
import { RedeemCodeUseCase } from '../../application/RedeemCodeUseCase';
import { AuthedRequest } from '../middleware/auth';
import { redeemCodeSchema } from '../schemas/redeem.schemas';
import { DomainError } from '../../domain/errors';

export interface RedeemRouterDeps {
  redeemCodeUseCase: RedeemCodeUseCase;
  requireAuth: RequestHandler;
}

export function createRedeemRouter(deps: RedeemRouterDeps): Router {
  const router = Router();

  router.post('/', deps.requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const parsed = redeemCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_INPUT', 'code is required');
      }
      const result = await deps.redeemCodeUseCase.execute({
        userId: req.userId as string,
        code: parsed.data.code,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
