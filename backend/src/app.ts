import express from 'express';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrismaClient } from './infrastructure/db/prisma';
import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { PrismaCharacterRepository } from './infrastructure/repositories/PrismaCharacterRepository';
import { BcryptPasswordHasher } from './infrastructure/auth/BcryptPasswordHasher';
import { JwtTokenService } from './infrastructure/auth/JwtTokenService';
import { MathRandomSource } from './infrastructure/random/MathRandomSource';
import { RandomSource } from './domain/ports/RandomSource';
import { RegisterUserUseCase } from './application/RegisterUserUseCase';
import { LoginUserUseCase } from './application/LoginUserUseCase';
import { GetCultivationStateUseCase } from './application/GetCultivationStateUseCase';
import { AttemptBreakthroughUseCase } from './application/AttemptBreakthroughUseCase';
import { createAuthRouter } from './presentation/routes/auth.routes';
import { createCultivationRouter } from './presentation/routes/cultivation.routes';
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
  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService(process.env.JWT_SECRET as string);

  const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
  const loginUserUseCase = new LoginUserUseCase(userRepository, passwordHasher, tokenService);
  const getCultivationStateUseCase = new GetCultivationStateUseCase(characterRepository);
  const attemptBreakthroughUseCase = new AttemptBreakthroughUseCase(characterRepository, randomSource);

  const requireAuth = createRequireAuth(tokenService);

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/auth', createAuthRouter({ registerUserUseCase, loginUserUseCase }));
  app.use(
    '/cultivation',
    createCultivationRouter({ getCultivationStateUseCase, attemptBreakthroughUseCase, requireAuth }),
  );

  app.use(errorHandler);

  return app;
}
