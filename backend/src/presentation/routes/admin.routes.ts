import { Router, RequestHandler } from 'express';
import { updateRealmsSchema } from '../schemas/admin.schemas';
import { UpdateRealmConfigUseCase } from '../../application/UpdateRealmConfigUseCase';
import { RealmConfigProvider } from '../../infrastructure/config/RealmConfigProvider';
import { requireAdmin } from '../middleware/requireAdmin';
import { DomainError } from '../../domain/errors';

export interface AdminRouterDeps {
  updateRealmConfigUseCase: UpdateRealmConfigUseCase;
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

  return router;
}
