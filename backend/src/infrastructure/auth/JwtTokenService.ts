import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { TokenService } from '../../domain/ports/TokenService';

export class JwtTokenService implements TokenService {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
  ) {}

  signAccessToken(userId: string, role: string): string {
    // role travels in the access token (15m) so requireAdmin can authorize
    // without a DB lookup per request.
    //
    // jti (a random per-token id) is required, not cosmetic: jwt.sign() is a
    // deterministic HMAC over { userId, iat, exp } + secret, and iat/exp only
    // have second-level granularity. Two calls for the same userId within the
    // same wall-clock second (e.g. register immediately followed by refresh)
    // would otherwise produce byte-identical tokens, silently breaking the
    // sliding-refresh guarantee that every refresh issues a genuinely new
    // token (see RefreshAccessTokenUseCase).
    //
    // typ is a defense-in-depth backstop, not the primary defense: the two
    // token kinds are supposed to be cryptographically independent because
    // accessSecret/refreshSecret are different values (enforced at
    // composition-root startup — see app.ts). If that env-var distinctness
    // were ever accidentally violated (e.g. both secrets set to the same
    // value in a deploy config), the typ claim still stops a token minted
    // for one purpose from verifying as the other.
    return jwt.sign({ userId, role, jti: randomUUID(), typ: 'access' }, this.accessSecret, { expiresIn: '15m' });
  }

  verifyAccessToken(token: string): { userId: string; role: string } {
    // Pin the algorithm: jwt.sign() defaults to HS256 (HMAC), so verification
    // must only accept HS256. Without this, jsonwebtoken accepts any algorithm
    // the token's header declares — the classic alg-confusion foot-gun (e.g. a
    // token could try to smuggle a different alg past a symmetric-secret check).
    const payload = jwt.verify(token, this.accessSecret, { algorithms: ['HS256'] }) as { userId: string; role?: string; typ?: string; [key: string]: unknown };
    if (payload.typ !== 'access') {
      throw new Error('Token is not an access token');
    }
    // Tokens minted before roles existed have no role claim; treat them as "user".
    return { userId: payload.userId, role: payload.role ?? 'user' };
  }

  signRefreshToken(userId: string, tokenVersion: number): string {
    // tokenVersion is the revocation lever: RefreshAccessTokenUseCase compares
    // it against the user's current stored version and rejects the token once
    // logout has bumped that counter (see UserRepository.incrementTokenVersion).
    return jwt.sign({ userId, tokenVersion, jti: randomUUID(), typ: 'refresh' }, this.refreshSecret, { expiresIn: '7d' });
  }

  // Verifies exclusively against refreshSecret — a token signed with
  // accessSecret (or any other secret) fails here, since jsonwebtoken's
  // verify() rejects a signature that doesn't match the secret it's checked
  // against. This is what makes a leaked access token unusable as a refresh
  // token and vice versa: the two token kinds are cryptographically
  // independent, not just conventionally different strings. The typ check
  // below is the same defense-in-depth backstop described in
  // signAccessToken, for the case where the two secrets are misconfigured
  // to be identical.
  verifyRefreshToken(token: string): { userId: string; tokenVersion: number } {
    // Same HS256 pin as verifyAccessToken — see the note there.
    const payload = jwt.verify(token, this.refreshSecret, { algorithms: ['HS256'] }) as { userId: string; tokenVersion?: number; typ?: string; [key: string]: unknown };
    if (payload.typ !== 'refresh') {
      throw new Error('Token is not a refresh token');
    }
    // Tokens minted before tokenVersion existed have no claim; treat as 0 so a
    // legacy token still validates against a fresh user (whose version is 0).
    return { userId: payload.userId, tokenVersion: payload.tokenVersion ?? 0 };
  }
}
