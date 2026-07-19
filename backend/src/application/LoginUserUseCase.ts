import { UserRepository } from '../domain/ports/UserRepository';
import { PasswordHasher } from '../domain/ports/PasswordHasher';
import { TokenService } from '../domain/ports/TokenService';
import { DomainError } from '../domain/errors';

export interface LoginUserInput {
  username: string;
  password: string;
}

export interface LoginUserOutput {
  token: string;
  refreshToken: string;
}

export class LoginUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserOutput> {
    const user = await this.users.findByUsername(input.username);
    if (!user) {
      throw new DomainError('INVALID_CREDENTIALS', 'Invalid username or password');
    }

    const valid = await this.passwordHasher.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new DomainError('INVALID_CREDENTIALS', 'Invalid username or password');
    }

    const token = this.tokenService.signAccessToken(user.id, user.role);
    const refreshToken = this.tokenService.signRefreshToken(user.id);
    return { token, refreshToken };
  }
}
