import jwt from 'jsonwebtoken';
import { TokenService } from '../../domain/ports/TokenService';

export class JwtTokenService implements TokenService {
  constructor(private readonly secret: string) {}

  signAccessToken(userId: string): string {
    return jwt.sign({ userId }, this.secret, { expiresIn: '7d' });
  }

  verifyAccessToken(token: string): { userId: string } {
    const payload = jwt.verify(token, this.secret) as { userId: string; [key: string]: any };
    return { userId: payload.userId };
  }
}
