import express from 'express';
import { prisma } from './infrastructure/db/prisma';
import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { BcryptPasswordHasher } from './infrastructure/auth/BcryptPasswordHasher';
import { JwtTokenService } from './infrastructure/auth/JwtTokenService';
import { RegisterUserUseCase } from './application/RegisterUserUseCase';
import { LoginUserUseCase } from './application/LoginUserUseCase';
import { createAuthRouter } from './presentation/routes/auth.routes';
import { errorHandler } from './presentation/middleware/errorHandler';

export function createApp() {
  const userRepository = new PrismaUserRepository(prisma);
  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService(process.env.JWT_SECRET as string);

  const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
  const loginUserUseCase = new LoginUserUseCase(userRepository, passwordHasher, tokenService);

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/auth', createAuthRouter({ registerUserUseCase, loginUserUseCase }));

  app.use(errorHandler);

  return app;
}
