import { Router, RequestHandler } from 'express';
import { updateRealmsSchema, createPillSchema, updatePillSchema } from '../schemas/admin.schemas';
import { createRedeemCodeSchema, updateRedeemCodeSchema } from '../schemas/redeem.schemas';
import { UpdateRealmConfigUseCase } from '../../application/UpdateRealmConfigUseCase';
import { GetAdminStatsUseCase } from '../../application/GetAdminStatsUseCase';
import { ListPillsAdminUseCase } from '../../application/ListPillsAdminUseCase';
import { CreatePillUseCase } from '../../application/CreatePillUseCase';
import { UpdatePillUseCase } from '../../application/UpdatePillUseCase';
import { ListRedeemCodesUseCase } from '../../application/ListRedeemCodesUseCase';
import { CreateRedeemCodeUseCase } from '../../application/CreateRedeemCodeUseCase';
import { UpdateRedeemCodeUseCase } from '../../application/UpdateRedeemCodeUseCase';
import { RealmConfigSource } from '../../domain/ports/RealmConfigSource';
import { RealmConfigReloader } from '../../domain/ports/RealmConfigReloader';
import { requireAdmin } from '../middleware/requireAdmin';
import { DomainError } from '../../domain/errors';

export interface AdminRouterDeps {
  updateRealmConfigUseCase: UpdateRealmConfigUseCase;
  getAdminStatsUseCase: GetAdminStatsUseCase;
  listPillsAdminUseCase: ListPillsAdminUseCase;
  createPillUseCase: CreatePillUseCase;
  updatePillUseCase: UpdatePillUseCase;
  listRedeemCodesUseCase: ListRedeemCodesUseCase;
  createRedeemCodeUseCase: CreateRedeemCodeUseCase;
  updateRedeemCodeUseCase: UpdateRedeemCodeUseCase;
  // Domain ports, not the concrete provider: reads the current config to serve
  // GET /realms, and invalidates the cache after PUT /realms.
  realmConfigSource: RealmConfigSource;
  realmConfigReloader: RealmConfigReloader;
  requireAuth: RequestHandler;
}

export function createAdminRouter(deps: AdminRouterDeps): Router {
  const router = Router();

  // Every /admin route requires a valid session (requireAuth) AND admin role.
  router.use(deps.requireAuth, requireAdmin);

  router.get('/realms', (_req, res) => {
    // Serve the nested config from the in-memory provider (already loaded).
    res.status(200).json({ realms: deps.realmConfigSource.get().toRealms() });
  });

  router.put('/realms', async (req, res, next) => {
    try {
      const parsed = updateRealmsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_REALM_CONFIG', parsed.error.issues[0].message);
      }
      const saved = await deps.updateRealmConfigUseCase.execute(parsed.data.realms);
      // Reload the cache so the new config is live for every subsequent request.
      await deps.realmConfigReloader.reload();
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

  router.get('/codes', async (_req, res, next) => {
    try {
      res.status(200).json({ codes: await deps.listRedeemCodesUseCase.execute() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/codes', async (req, res, next) => {
    try {
      const parsed = createRedeemCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_REDEEM_CODE', parsed.error.issues[0].message);
      }
      const saved = await deps.createRedeemCodeUseCase.execute({
        ...parsed.data,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      });
      res.status(201).json(saved);
    } catch (err) {
      next(err);
    }
  });

  router.put('/codes/:id', async (req, res, next) => {
    try {
      const parsed = updateRedeemCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_REDEEM_CODE', parsed.error.issues[0].message);
      }
      // id and code are immutable: fetch the existing record and merge edits so
      // redeemedCount and the code string are preserved from the stored row.
      const existing = await deps.listRedeemCodesUseCase.execute();
      const current = existing.find((c) => c.id === req.params.id);
      if (!current) {
        throw new DomainError('REDEEM_CODE_NOT_FOUND', `id "${req.params.id}" not found`);
      }
      const saved = await deps.updateRedeemCodeUseCase.execute({
        ...current,
        active: parsed.data.active,
        maxRedemptions: parsed.data.maxRedemptions,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        rewards: parsed.data.rewards,
      });
      res.status(200).json(saved);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
