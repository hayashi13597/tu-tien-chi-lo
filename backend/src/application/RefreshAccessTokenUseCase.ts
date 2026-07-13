import { TokenService } from '../domain/ports/TokenService';
import { DomainError } from '../domain/errors';

export interface RefreshAccessTokenOutput {
  token: string;
  refreshToken: string;
}

export class RefreshAccessTokenUseCase {
  constructor(private readonly tokenService: TokenService) {}

  // Sliding renewal: every successful refresh issues a BRAND NEW refresh
  // token (not the same one re-signed), extending the session another 7
  // days from this moment. There is no server-side session/revocation
  // store (see Global Constraints) — a refresh token's only route to
  // invalidation is expiring naturally.
  execute(refreshToken: string): RefreshAccessTokenOutput {
    let userId: string;
    try {
      ({ userId } = this.tokenService.verifyRefreshToken(refreshToken));
    } catch {
      throw new DomainError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }

    const token = this.tokenService.signAccessToken(userId);
    const newRefreshToken = this.tokenService.signRefreshToken(userId);
    return { token, refreshToken: newRefreshToken };
  }
}
