import { TokenService } from '../domain/ports/TokenService';
import { UserRepository } from '../domain/ports/UserRepository';

export class LogoutUseCase {
  constructor(
    private readonly tokenService: TokenService,
    private readonly users: UserRepository,
  ) {}

  // Logout stays idempotent and always "succeeds" from the caller's view (the
  // route clears cookies + returns 200 regardless). Its one side effect, when a
  // valid refresh token is presented, is to bump the user's tokenVersion so
  // EVERY outstanding refresh token for that user stops validating
  // (logout-everywhere). A missing/invalid/expired token is a no-op — there is
  // nothing to revoke and no user to identify — so we swallow errors rather than
  // surfacing them.
  async execute(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const { userId } = this.tokenService.verifyRefreshToken(refreshToken);
      await this.users.incrementTokenVersion(userId);
    } catch {
      // Invalid/expired token, or a user that no longer exists — nothing to do.
    }
  }
}
