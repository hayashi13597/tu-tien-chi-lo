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
    // Only the token *validation* is best-effort: a missing/invalid/expired
    // token has nothing to revoke, so a failure here is a legitimate no-op.
    // The DB write stays OUTSIDE this catch — an infrastructure failure
    // (DB down, etc.) must propagate to the caller, not be silently swallowed
    // as if logout-everywhere had succeeded.
    let userId: string;
    try {
      ({ userId } = this.tokenService.verifyRefreshToken(refreshToken));
    } catch {
      return;
    }
    await this.users.incrementTokenVersion(userId);
  }
}
