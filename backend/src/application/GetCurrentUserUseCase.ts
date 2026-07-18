import { UserRepository } from '../domain/ports/UserRepository';
import { DomainError } from '../domain/errors';

export interface CurrentUserOutput {
  id: string;
  username: string;
  role: string;
}

export class GetCurrentUserUseCase {
  constructor(private readonly users: UserRepository) {}

  // The role is taken from the verified access token, NOT re-read from the DB:
  // the UI should mirror what requireAdmin will actually enforce for this
  // session. A freshly promoted user only becomes "admin" here once their
  // token carries the claim (next refresh/login) — otherwise the UI would show
  // admin links whose API calls still 403.
  async execute(input: { userId: string; role: string }): Promise<CurrentUserOutput> {
    const user = await this.users.findById(input.userId);
    if (!user) {
      // Token outlived the account (user deleted): treat as unauthenticated.
      throw new DomainError('USER_NOT_FOUND', 'User no longer exists');
    }
    return { id: user.id, username: user.username, role: input.role };
  }
}
