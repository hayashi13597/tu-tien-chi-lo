import { TokenService } from '../../src/domain/ports/TokenService';

export class FakeTokenService implements TokenService {
  signAccessToken(userId: string): string {
    return `token-for-${userId}`;
  }

  verifyAccessToken(token: string): { userId: string } {
    const userId = token.replace('token-for-', '');
    if (`token-for-${userId}` !== token) {
      throw new Error('invalid token');
    }
    return { userId };
  }
}
