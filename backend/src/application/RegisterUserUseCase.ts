import { UserRepository } from '../domain/ports/UserRepository';
import { PasswordHasher } from '../domain/ports/PasswordHasher';
import { TokenService } from '../domain/ports/TokenService';
import { DomainError } from '../domain/errors';

export interface RegisterUserInput {
  username: string;
  password: string;
}

export interface RegisterUserOutput {
  id: string;
  username: string;
  accessToken: string;
  refreshToken: string;
}

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const existing = await this.users.findByUsername(input.username);
    if (existing) {
      throw new DomainError('USERNAME_TAKEN', 'Username already exists');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.users.create({ username: input.username, passwordHash });

    // Register also logs the user in immediately (per the design spec), so
    // the route can set the same cookie pair login does without a second
    // round trip. The route decides what to expose in the JSON body — see
    // the Global Constraints note on never echoing the raw result object.
    const accessToken = this.tokenService.signAccessToken(user.id);
    const refreshToken = this.tokenService.signRefreshToken(user.id);

    return { id: user.id, username: user.username, accessToken, refreshToken };
  }
}
