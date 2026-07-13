import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { TokenService } from '../../domain/ports/TokenService';

export class JwtTokenService implements TokenService {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
  ) {}

  signAccessToken(userId: string): string {
    // jti (a random per-token id) is required, not cosmetic: jwt.sign() is a
    // deterministic HMAC over { userId, iat, exp } + secret, and iat/exp only
    // have second-level granularity. Two calls for the same userId within the
    // same wall-clock second (e.g. register immediately followed by refresh)
    // would otherwise produce byte-identical tokens, silently breaking the
    // sliding-refresh guarantee that every refresh issues a genuinely new
    // token (see RefreshAccessTokenUseCase).
    return jwt.sign({ userId, jti: randomUUID() }, this.accessSecret, { expiresIn: '15m' });
  }

  verifyAccessToken(token: string): { userId: string } {
    const payload = jwt.verify(token, this.accessSecret) as { userId: string; [key: string]: unknown };
    return { userId: payload.userId };
  }

  signRefreshToken(userId: string): string {
    return jwt.sign({ userId, jti: randomUUID() }, this.refreshSecret, { expiresIn: '7d' });
  }

  // Verifies exclusively against refreshSecret — a token signed with
  // accessSecret (or any other secret) fails here, since jsonwebtoken's
  // verify() rejects a signature that doesn't match the secret it's checked
  // against. This is what makes a leaked access token unusable as a refresh
  // token and vice versa: the two token kinds are cryptographically
  // independent, not just conventionally different strings.
  verifyRefreshToken(token: string): { userId: string } {
    const payload = jwt.verify(token, this.refreshSecret) as { userId: string; [key: string]: unknown };
    return { userId: payload.userId };
  }
}
