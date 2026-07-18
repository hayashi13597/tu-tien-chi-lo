import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrismaClient } from './infrastructure/db/prisma';
import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { PrismaCharacterRepository } from './infrastructure/repositories/PrismaCharacterRepository';
import { PrismaPillRepository } from './infrastructure/repositories/PrismaPillRepository';
import { PrismaRealmConfigRepository } from './infrastructure/repositories/PrismaRealmConfigRepository';
import { RealmConfigProvider } from './infrastructure/config/RealmConfigProvider';
import { BcryptPasswordHasher } from './infrastructure/auth/BcryptPasswordHasher';
import { JwtTokenService } from './infrastructure/auth/JwtTokenService';
import { MathRandomSource } from './infrastructure/random/MathRandomSource';
import { RandomSource } from './domain/ports/RandomSource';
import { RegisterUserUseCase } from './application/RegisterUserUseCase';
import { LoginUserUseCase } from './application/LoginUserUseCase';
import { RefreshAccessTokenUseCase } from './application/RefreshAccessTokenUseCase';
import { GetCultivationStateUseCase } from './application/GetCultivationStateUseCase';
import { AttemptBreakthroughUseCase } from './application/AttemptBreakthroughUseCase';
import { GetInventoryUseCase } from './application/GetInventoryUseCase';
import { ConsumePillUseCase } from './application/ConsumePillUseCase';
import { createAuthRouter } from './presentation/routes/auth.routes';
import { createCultivationRouter } from './presentation/routes/cultivation.routes';
import { createPillsRouter } from './presentation/routes/pills.routes';
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
  const passwordHasher = new BcryptPasswordHasher();

  const jwtSecret = process.env.JWT_SECRET as string;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET as string;
  // JwtTokenService's access/refresh isolation is only cryptographically real
  // if these two secrets actually differ (see JwtTokenService's typ-claim
  // backstop for the same concern at the token level) — fail fast at startup
  // rather than silently degrading into a security bug discovered later.
  if (jwtSecret === jwtRefreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set to different values');
  }
  const tokenService = new JwtTokenService(jwtSecret, jwtRefreshSecret);

  const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher, tokenService, pillRepository);
  const loginUserUseCase = new LoginUserUseCase(userRepository, passwordHasher, tokenService);
  const refreshAccessTokenUseCase = new RefreshAccessTokenUseCase(tokenService, userRepository);
  const getCultivationStateUseCase = new GetCultivationStateUseCase(characterRepository, realmConfigProvider);
  const attemptBreakthroughUseCase = new AttemptBreakthroughUseCase(characterRepository, randomSource, realmConfigProvider);
  const getInventoryUseCase = new GetInventoryUseCase(pillRepository);
  const consumePillUseCase = new ConsumePillUseCase(characterRepository, pillRepository, realmConfigProvider);

  const requireAuth = createRequireAuth(tokenService);

  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
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
    createAuthRouter({ registerUserUseCase, loginUserUseCase, refreshAccessTokenUseCase }),
  );
  app.use(
    '/cultivation',
    createCultivationRouter({ getCultivationStateUseCase, attemptBreakthroughUseCase, requireAuth }),
  );
  app.use(
    '/pills',
    createPillsRouter({ getInventoryUseCase, consumePillUseCase, requireAuth }),
  );

  app.use(errorHandler);

  return app;
}
