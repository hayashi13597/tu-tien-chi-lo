import { TokenService } from '../domain/ports/TokenService';
import { UserRepository } from '../domain/ports/UserRepository';
import { DomainError } from '../domain/errors';

export interface RefreshAccessTokenOutput {
  token: string;
  refreshToken: string;
}

export class RefreshAccessTokenUseCase {
  constructor(
    private readonly tokenService: TokenService,
    private readonly users: UserRepository,
  ) {}

  // Sliding renewal: every successful refresh issues a BRAND NEW refresh
  // token (not the same one re-signed), extending the session another 7
  // days from this moment. There is no server-side session/revocation
  // store — a refresh token's only route to invalidation is expiring naturally.
  async execute(refreshToken: string): Promise<RefreshAccessTokenOutput> {
    let userId: string;
    let tokenVersion: number;
    try {
      ({ userId, tokenVersion } = this.tokenService.verifyRefreshToken(refreshToken));
    } catch {
      throw new DomainError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }

    // Re-read the user so the refreshed access token reflects the current role
    // (e.g. a just-granted admin role) rather than a stale claim.
    const user = await this.users.findById(userId);
    if (!user) {
      throw new DomainError('INVALID_REFRESH_TOKEN', 'User no longer exists');
    }

    // Revocation check: a logout bumps user.tokenVersion, so any refresh token
    // signed before that (carrying an older version) is now rejected — this is
    // what makes logout-everywhere actually invalidate stolen/old tokens.
    if (tokenVersion !== user.tokenVersion) {
      throw new DomainError('INVALID_REFRESH_TOKEN', 'Refresh token has been revoked');
    }

    const token = this.tokenService.signAccessToken(user.id, user.role);
    const newRefreshToken = this.tokenService.signRefreshToken(user.id, user.tokenVersion);
    return { token, refreshToken: newRefreshToken };
  }
}
