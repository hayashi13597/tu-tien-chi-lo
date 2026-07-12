import { UserRepository } from '../domain/ports/UserRepository';
import { PasswordHasher } from '../domain/ports/PasswordHasher';
import { DomainError } from '../domain/errors';

export interface RegisterUserInput {
  username: string;
  password: string;
}

export interface RegisterUserOutput {
  id: string;
  username: string;
}

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const existing = await this.users.findByUsername(input.username);
    if (existing) {
      throw new DomainError('USERNAME_TAKEN', 'Username already exists');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.users.create({ username: input.username, passwordHash });

    return { id: user.id, username: user.username };
  }
}
