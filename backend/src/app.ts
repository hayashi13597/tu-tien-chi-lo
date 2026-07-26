import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrismaClient } from './infrastructure/db/prisma';
import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { PrismaCharacterRepository } from './infrastructure/repositories/PrismaCharacterRepository';
import { PrismaPillRepository } from './infrastructure/repositories/PrismaPillRepository';
import { PrismaRealmConfigRepository } from './infrastructure/repositories/PrismaRealmConfigRepository';
import { PrismaStatsRepository } from './infrastructure/repositories/PrismaStatsRepository';
import { PrismaRedeemCodeRepository } from './infrastructure/repositories/PrismaRedeemCodeRepository';
import { PrismaCongPhapRepository } from './infrastructure/repositories/PrismaCongPhapRepository';
import { PrismaOwnedCongPhapRepository } from './infrastructure/repositories/PrismaOwnedCongPhapRepository';
import { PrismaMaterialRepository } from './infrastructure/repositories/PrismaMaterialRepository';
import { PrismaAlchemyRepository } from './infrastructure/repositories/PrismaAlchemyRepository';
import { PrismaProgressionRepository } from './infrastructure/repositories/PrismaProgressionRepository';
import { PrismaExpeditionConfigRepository } from './infrastructure/repositories/PrismaExpeditionConfigRepository';
import { PrismaExpeditionRepository } from './infrastructure/repositories/PrismaExpeditionRepository';
import { PrismaMaterialCatalogAdminRepository } from './infrastructure/repositories/PrismaMaterialCatalogAdminRepository';
import { PrismaAlchemyCatalogAdminRepository } from './infrastructure/repositories/PrismaAlchemyCatalogAdminRepository';
import { PrismaExpeditionCatalogAdminRepository } from './infrastructure/repositories/PrismaExpeditionCatalogAdminRepository';
import { PrismaAdminUserRepository } from './infrastructure/repositories/PrismaAdminUserRepository';
import { RealmConfigProvider } from './infrastructure/config/RealmConfigProvider';
import { BcryptPasswordHasher } from './infrastructure/auth/BcryptPasswordHasher';
import { JwtTokenService } from './infrastructure/auth/JwtTokenService';
import { MathRandomSource } from './infrastructure/random/MathRandomSource';
import { RandomSource } from './domain/ports/RandomSource';
import { RegisterUserUseCase } from './application/RegisterUserUseCase';
import { LoginUserUseCase } from './application/LoginUserUseCase';
import { RefreshAccessTokenUseCase } from './application/RefreshAccessTokenUseCase';
import { LogoutUseCase } from './application/LogoutUseCase';
import { GetCultivationStateUseCase } from './application/GetCultivationStateUseCase';
import { AttemptBreakthroughUseCase } from './application/AttemptBreakthroughUseCase';
import { GetInventoryUseCase } from './application/GetInventoryUseCase';
import { ConsumePillUseCase } from './application/ConsumePillUseCase';
import { UpdateRealmConfigUseCase } from './application/UpdateRealmConfigUseCase';
import { ListPillsAdminUseCase } from './application/ListPillsAdminUseCase';
import { CreatePillUseCase } from './application/CreatePillUseCase';
import { UpdatePillUseCase } from './application/UpdatePillUseCase';
import { GetCurrentUserUseCase } from './application/GetCurrentUserUseCase';
import { GetAdminStatsUseCase } from './application/GetAdminStatsUseCase';
import { RedeemCodeUseCase } from './application/RedeemCodeUseCase';
import { ListRedeemCodesUseCase } from './application/ListRedeemCodesUseCase';
import { CreateRedeemCodeUseCase } from './application/CreateRedeemCodeUseCase';
import { UpdateRedeemCodeUseCase } from './application/UpdateRedeemCodeUseCase';
import { ListCongPhapUseCase } from './application/ListCongPhapUseCase';
import { EquipCongPhapUseCase } from './application/EquipCongPhapUseCase';
import { UnequipCongPhapUseCase } from './application/UnequipCongPhapUseCase';
import { LevelUpCongPhapUseCase } from './application/LevelUpCongPhapUseCase';
import { ListCongPhapAdminUseCase } from './application/ListCongPhapAdminUseCase';
import { CreateCongPhapUseCase } from './application/CreateCongPhapUseCase';
import { UpdateCongPhapUseCase } from './application/UpdateCongPhapUseCase';
import { GrantUseCase } from './application/GrantUseCase';
import { SearchUsersUseCase } from './application/SearchUsersUseCase';
import { GetMaterialInventoryUseCase } from './application/GetMaterialInventoryUseCase';
import { ListAlchemyRecipesUseCase } from './application/ListAlchemyRecipesUseCase';
import { GetAlchemyQueueUseCase } from './application/GetAlchemyQueueUseCase';
import { QueueAlchemyUseCase } from './application/QueueAlchemyUseCase';
import { ListExpeditionBranchesUseCase } from './application/ListExpeditionBranchesUseCase';
import { GetCurrentExpeditionUseCase } from './application/GetCurrentExpeditionUseCase';
import { StartExpeditionUseCase } from './application/StartExpeditionUseCase';
import { ClaimExpeditionUseCase } from './application/ClaimExpeditionUseCase';
import { ListMaterialAdminUseCase } from './application/ListMaterialAdminUseCase';
import { UpdateMaterialAdminUseCase } from './application/UpdateMaterialAdminUseCase';
import { ListAlchemyRecipeAdminUseCase } from './application/ListAlchemyRecipeAdminUseCase';
import { UpdateAlchemyRecipeAdminUseCase } from './application/UpdateAlchemyRecipeAdminUseCase';
import { ListExpeditionConfigAdminUseCase } from './application/ListExpeditionConfigAdminUseCase';
import { UpdateExpeditionConfigAdminUseCase } from './application/UpdateExpeditionConfigAdminUseCase';
import { createAuthRouter } from './presentation/routes/auth.routes';
import { createCultivationRouter } from './presentation/routes/cultivation.routes';
import { createPillsRouter } from './presentation/routes/pills.routes';
import { createAdminRouter } from './presentation/routes/admin.routes';
import { createRedeemRouter } from './presentation/routes/redeem.routes';
import { createCongPhapRouter } from './presentation/routes/congphap.routes';
import { createMaterialsRouter } from './presentation/routes/materials.routes';
import { createAlchemyRouter } from './presentation/routes/alchemy.routes';
import { createExpeditionsRouter } from './presentation/routes/expeditions.routes';
import { createRequireAuth } from './presentation/middleware/auth';
import { errorHandler } from './presentation/middleware/errorHandler';

export interface AppOverrides {
  prismaClient?: PrismaClient;
  // Overridable so integration tests can force breakthrough success/failure
  // deterministically instead of depending on real Math.random() outcomes.
  randomSource?: RandomSource;
}

export function createApp(overrides: AppOverrides = {}) {
  const client = overrides.prismaClient ?? defaultPrismaClient;
  const randomSource = overrides.randomSource ?? new MathRandomSource();

  const userRepository = new PrismaUserRepository(client);
  const characterRepository = new PrismaCharacterRepository(client);
  const pillRepository = new PrismaPillRepository(client);
  const realmConfigRepository = new PrismaRealmConfigRepository(client);
  const realmConfigProvider = new RealmConfigProvider(realmConfigRepository);
  const statsRepository = new PrismaStatsRepository(client);
  const redeemCodeRepository = new PrismaRedeemCodeRepository(client);
  const congPhapRepository = new PrismaCongPhapRepository(client);
  const ownedCongPhapRepository = new PrismaOwnedCongPhapRepository(client);
  const materialRepository = new PrismaMaterialRepository(client);
  const alchemyRepository = new PrismaAlchemyRepository(client);
  const progressionRepository = new PrismaProgressionRepository(client);
  const expeditionConfigRepository = new PrismaExpeditionConfigRepository(client);
  const expeditionRepository = new PrismaExpeditionRepository(client);
  const materialCatalogAdminRepository = new PrismaMaterialCatalogAdminRepository(client);
  const alchemyCatalogAdminRepository = new PrismaAlchemyCatalogAdminRepository(client);
  const expeditionCatalogAdminRepository = new PrismaExpeditionCatalogAdminRepository(client);
  const adminUserRepository = new PrismaAdminUserRepository(client);
  const passwordHasher = new BcryptPasswordHasher();

  const jwtSecret = process.env.JWT_SECRET as string;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET as string;
  // A missing/empty secret would let JwtTokenService sign tokens with an
  // undefined key. The equality check below only catches the both-missing case
  // (undefined === undefined); a single missing secret slips through it because
  // the two values then differ. Reject either being unset before that check.
  if (!jwtSecret || !jwtRefreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must both be set');
  }
  // JwtTokenService's access/refresh isolation is only cryptographically real
  // if these two secrets actually differ (see JwtTokenService's typ-claim
  // backstop for the same concern at the token level) — fail fast at startup
  // rather than silently degrading into a security bug discovered later.
  if (jwtSecret === jwtRefreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set to different values');
  }
  // In production, refuse to boot with the committed dev placeholder secrets:
  // they're public (in .env.example / docker-compose.yml), so a deploy that
  // forgot to override them would sign forgeable tokens. Only enforced in
  // production so the local/dev/test workflow keeps working with the defaults.
  if (process.env.NODE_ENV === 'production') {
    const WEAK_SECRETS = new Set(['dev-secret-change-me', 'dev-refresh-secret-change-me']);
    if (WEAK_SECRETS.has(jwtSecret) || WEAK_SECRETS.has(jwtRefreshSecret)) {
      throw new Error('Refusing to start in production with default dev JWT secrets — set real JWT_SECRET/JWT_REFRESH_SECRET');
    }
  }
  const tokenService = new JwtTokenService(jwtSecret, jwtRefreshSecret);

  // A missing CORS_ORIGIN would make cors() reflect the request's Origin back
  // with credentials:true — i.e. ANY site could call this API with the user's
  // cookies. Fail fast at startup rather than silently allowing that.
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin) {
    throw new Error('CORS_ORIGIN must be set (an explicit allowed origin, not empty)');
  }

  const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher, tokenService, pillRepository);
  const loginUserUseCase = new LoginUserUseCase(userRepository, passwordHasher, tokenService);
  const refreshAccessTokenUseCase = new RefreshAccessTokenUseCase(tokenService, userRepository);
  const logoutUseCase = new LogoutUseCase(tokenService, userRepository);
  const getCultivationStateUseCase = new GetCultivationStateUseCase(characterRepository, realmConfigProvider, ownedCongPhapRepository);
  const attemptBreakthroughUseCase = new AttemptBreakthroughUseCase(characterRepository, randomSource, realmConfigProvider);
  const getInventoryUseCase = new GetInventoryUseCase(pillRepository);
  const consumePillUseCase = new ConsumePillUseCase(characterRepository, pillRepository, realmConfigProvider, ownedCongPhapRepository);
  const updateRealmConfigUseCase = new UpdateRealmConfigUseCase(realmConfigRepository);
  const listPillsAdminUseCase = new ListPillsAdminUseCase(pillRepository);
  const createPillUseCase = new CreatePillUseCase(pillRepository);
  const updatePillUseCase = new UpdatePillUseCase(pillRepository);
  const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepository);
  const getAdminStatsUseCase = new GetAdminStatsUseCase(statsRepository, realmConfigProvider);
  const redeemCodeUseCase = new RedeemCodeUseCase(redeemCodeRepository, pillRepository, congPhapRepository, ownedCongPhapRepository, characterRepository);
  const listRedeemCodesUseCase = new ListRedeemCodesUseCase(redeemCodeRepository);
  const createRedeemCodeUseCase = new CreateRedeemCodeUseCase(redeemCodeRepository);
  const updateRedeemCodeUseCase = new UpdateRedeemCodeUseCase(redeemCodeRepository);
  const listCongPhapUseCase = new ListCongPhapUseCase(ownedCongPhapRepository, congPhapRepository);
  const equipCongPhapUseCase = new EquipCongPhapUseCase(ownedCongPhapRepository, congPhapRepository);
  const unequipCongPhapUseCase = new UnequipCongPhapUseCase(ownedCongPhapRepository);
  const levelUpCongPhapUseCase = new LevelUpCongPhapUseCase(ownedCongPhapRepository, congPhapRepository, characterRepository, progressionRepository);
  const listCongPhapAdminUseCase = new ListCongPhapAdminUseCase(congPhapRepository);
  const createCongPhapUseCase = new CreateCongPhapUseCase(congPhapRepository);
  const updateCongPhapUseCase = new UpdateCongPhapUseCase(congPhapRepository);
  const grantUseCase = new GrantUseCase(ownedCongPhapRepository, characterRepository);
  const searchUsersUseCase = new SearchUsersUseCase(adminUserRepository);
  const getMaterialInventoryUseCase = new GetMaterialInventoryUseCase(materialRepository);
  const listAlchemyRecipesUseCase = new ListAlchemyRecipesUseCase(alchemyRepository);
  const getAlchemyQueueUseCase = new GetAlchemyQueueUseCase(alchemyRepository);
  const queueAlchemyUseCase = new QueueAlchemyUseCase(alchemyRepository, materialRepository, characterRepository);
  const listExpeditionBranchesUseCase = new ListExpeditionBranchesUseCase(expeditionConfigRepository);
  const getCurrentExpeditionUseCase = new GetCurrentExpeditionUseCase(expeditionRepository);
  const startExpeditionUseCase = new StartExpeditionUseCase(expeditionConfigRepository, expeditionRepository, getCultivationStateUseCase, ownedCongPhapRepository, randomSource);
  const claimExpeditionUseCase = new ClaimExpeditionUseCase(expeditionRepository);
  const listMaterialAdminUseCase = new ListMaterialAdminUseCase(materialCatalogAdminRepository);
  const updateMaterialAdminUseCase = new UpdateMaterialAdminUseCase(materialCatalogAdminRepository);
  const listAlchemyRecipeAdminUseCase = new ListAlchemyRecipeAdminUseCase(alchemyCatalogAdminRepository);
  const updateAlchemyRecipeAdminUseCase = new UpdateAlchemyRecipeAdminUseCase(alchemyCatalogAdminRepository);
  const listExpeditionConfigAdminUseCase = new ListExpeditionConfigAdminUseCase(expeditionCatalogAdminRepository);
  const updateExpeditionConfigAdminUseCase = new UpdateExpeditionConfigAdminUseCase(expeditionCatalogAdminRepository);

  const requireAuth = createRequireAuth(tokenService);

  const app = express();
  // Deployed behind a single reverse proxy (Caddy), so trust exactly one hop of
  // X-Forwarded-* headers. Without this, express-rate-limit sees the proxy's IP
  // for every client (rate-limiting the whole world as one key) and errors on
  // the spoofable X-Forwarded-For. "1" (not `true`) avoids trusting arbitrary
  // forwarded chains a client could spoof.
  app.set('trust proxy', 1);
  // Security headers first, before any route. Defaults are fine for a JSON API
  // (nsniff, frameguard, HSTS, etc.); CSP is left on but inert since we never
  // serve HTML/scripts — the header just costs a few bytes on JSON responses.
  app.use(helmet());
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Ensure the realm config is loaded (once) before handling a request. First
  // request pays the one-time DB read; subsequent ones are a no-op. Kept out of
  // /health above so a health check never blocks on the DB.
  app.use((_req, _res, next) => {
    realmConfigProvider.ensureLoaded().then(() => next()).catch(next);
  });

  app.use(
    '/auth',
    createAuthRouter({ registerUserUseCase, loginUserUseCase, refreshAccessTokenUseCase, getCurrentUserUseCase, logoutUseCase, requireAuth }),
  );
  app.use(
    '/cultivation',
    createCultivationRouter({ getCultivationStateUseCase, attemptBreakthroughUseCase, requireAuth }),
  );
  app.use(
    '/pills',
    createPillsRouter({ getInventoryUseCase, consumePillUseCase, requireAuth }),
  );
  app.use('/redeem', createRedeemRouter({ redeemCodeUseCase, requireAuth }));
  app.use('/materials', createMaterialsRouter({ getMaterialInventoryUseCase, requireAuth }));
  app.use('/alchemy', createAlchemyRouter({ listAlchemyRecipesUseCase, getAlchemyQueueUseCase, queueAlchemyUseCase, requireAuth }));
  app.use('/expeditions', createExpeditionsRouter({ listExpeditionBranchesUseCase, getCurrentExpeditionUseCase, startExpeditionUseCase, claimExpeditionUseCase, requireAuth }));
  app.use(
    '/congphap',
    createCongPhapRouter({ listCongPhapUseCase, equipCongPhapUseCase, unequipCongPhapUseCase, levelUpCongPhapUseCase, requireAuth }),
  );
  app.use(
    '/admin',
    createAdminRouter({ updateRealmConfigUseCase, getAdminStatsUseCase, listPillsAdminUseCase, createPillUseCase, updatePillUseCase, realmConfigSource: realmConfigProvider, realmConfigReloader: realmConfigProvider, listRedeemCodesUseCase, createRedeemCodeUseCase, updateRedeemCodeUseCase, listCongPhapAdminUseCase, createCongPhapUseCase, updateCongPhapUseCase, grantUseCase, searchUsersUseCase, requireAuth, listMaterialAdminUseCase, updateMaterialAdminUseCase, listAlchemyRecipeAdminUseCase, updateAlchemyRecipeAdminUseCase, listExpeditionConfigAdminUseCase, updateExpeditionConfigAdminUseCase }),
  );

  app.use(errorHandler);

  return app;
}
