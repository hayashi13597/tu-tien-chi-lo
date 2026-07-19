import { Router, RequestHandler } from 'express';
import { updateRealmsSchema, createPillSchema, updatePillSchema } from '../schemas/admin.schemas';
import { UpdateRealmConfigUseCase } from '../../application/UpdateRealmConfigUseCase';
import { GetAdminStatsUseCase } from '../../application/GetAdminStatsUseCase';
import { ListPillsAdminUseCase } from '../../application/ListPillsAdminUseCase';
import { CreatePillUseCase } from '../../application/CreatePillUseCase';
import { UpdatePillUseCase } from '../../application/UpdatePillUseCase';
import { RealmConfigProvider } from '../../infrastructure/config/RealmConfigProvider';
import { requireAdmin } from '../middleware/requireAdmin';
import { DomainError } from '../../domain/errors';

export interface AdminRouterDeps {
  updateRealmConfigUseCase: UpdateRealmConfigUseCase;
  getAdminStatsUseCase: GetAdminStatsUseCase;
  listPillsAdminUseCase: ListPillsAdminUseCase;
  createPillUseCase: CreatePillUseCase;
  updatePillUseCase: UpdatePillUseCase;
  realmConfigProvider: RealmConfigProvider;
  requireAuth: RequestHandler;
}

export function createAdminRouter(deps: AdminRouterDeps): Router {
  const router = Router();

  // Every /admin route requires a valid session (requireAuth) AND admin role.
  router.use(deps.requireAuth, requireAdmin);

  router.get('/realms', (_req, res) => {
    // Serve the nested config from the in-memory provider (already loaded).
    res.status(200).json({ realms: deps.realmConfigProvider.get().toRealms() });
  });

  router.put('/realms', async (req, res, next) => {
    try {
      const parsed = updateRealmsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_REALM_CONFIG', parsed.error.issues[0].message);
      }
      const saved = await deps.updateRealmConfigUseCase.execute(parsed.data.realms);
      // Reload the cache so the new config is live for every subsequent request.
      await deps.realmConfigProvider.reload();
      res.status(200).json({ realms: saved });
    } catch (err) {
      next(err);
    }
  });

  router.get('/stats', async (_req, res, next) => {
    try {
      res.status(200).json(await deps.getAdminStatsUseCase.execute());
    } catch (err) {
      next(err);
    }
  });

  router.get('/pills', async (_req, res, next) => {
    try {
      res.status(200).json({ pills: await deps.listPillsAdminUseCase.execute() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/pills', async (req, res, next) => {
    try {
      const parsed = createPillSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_PILL_CONFIG', parsed.error.issues[0].message);
      }
      const saved = await deps.createPillUseCase.execute(parsed.data);
      res.status(201).json(saved);
    } catch (err) {
      next(err);
    }
  });

  router.put('/pills/:id', async (req, res, next) => {
    try {
      const parsed = updatePillSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_PILL_CONFIG', parsed.error.issues[0].message);
      }
      // id comes from the URL only — it is immutable (inventory FK key), so the
      // body schema has no id field a client could try to change.
      const saved = await deps.updatePillUseCase.execute({ ...parsed.data, id: req.params.id });
      res.status(200).json(saved);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
