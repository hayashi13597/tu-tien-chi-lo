import { Router, RequestHandler } from 'express';
import { ListCongPhapUseCase } from '../../application/ListCongPhapUseCase';
import { EquipCongPhapUseCase } from '../../application/EquipCongPhapUseCase';
import { UnequipCongPhapUseCase } from '../../application/UnequipCongPhapUseCase';
import { LevelUpCongPhapUseCase } from '../../application/LevelUpCongPhapUseCase';
import { LearnCongPhapUseCase } from '../../application/LearnCongPhapUseCase';
import { AuthedRequest } from '../middleware/auth';
import { equipSchema, unequipSchema, levelUpSchema } from '../schemas/congphap.schemas';
import { DomainError } from '../../domain/errors';

export interface CongPhapRouterDeps {
  listCongPhapUseCase: ListCongPhapUseCase;
  equipCongPhapUseCase: EquipCongPhapUseCase;
  unequipCongPhapUseCase: UnequipCongPhapUseCase;
  levelUpCongPhapUseCase: LevelUpCongPhapUseCase;
  learnCongPhapUseCase: LearnCongPhapUseCase;
  requireAuth: RequestHandler;
}

export function createCongPhapRouter(deps: CongPhapRouterDeps): Router {
  const router = Router();
  router.use(deps.requireAuth);

  router.get('/', async (req: AuthedRequest, res, next) => {
    try {
      res.status(200).json(await deps.listCongPhapUseCase.execute(req.userId as string));
    } catch (err) {
      next(err);
    }
  });

  router.post('/equip', async (req: AuthedRequest, res, next) => {
    try {
      const parsed = equipSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_INPUT', 'congPhapId and slot are required');
      }
      await deps.equipCongPhapUseCase.execute(req.userId as string, parsed.data.congPhapId, parsed.data.slot);
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/unequip', async (req: AuthedRequest, res, next) => {
    try {
      const parsed = unequipSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_INPUT', 'congPhapId is required');
      }
      await deps.unequipCongPhapUseCase.execute(req.userId as string, parsed.data.congPhapId);
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/levelup', async (req: AuthedRequest, res, next) => {
    try {
      const parsed = levelUpSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_INPUT', 'congPhapId is required');
      }
      res.status(200).json(await deps.levelUpCongPhapUseCase.execute(req.userId as string, parsed.data.congPhapId));
    } catch (err) {
      next(err);
    }
  });

  // Phase 2: học môn bằng Bí Tịch + Linh Thạch. id nằm trên path; body rỗng.
  router.post('/:id/learn', async (req: AuthedRequest, res, next) => {
    try {
      const id = req.params.id;
      if (!/^[a-z0-9-]+$/.test(id)) {
        throw new DomainError('INVALID_INPUT', 'invalid cong phap id');
      }
      res.status(200).json(await deps.learnCongPhapUseCase.execute(req.userId as string, id));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
