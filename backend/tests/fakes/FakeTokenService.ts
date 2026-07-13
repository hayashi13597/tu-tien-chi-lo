import { TokenService } from '../../src/domain/ports/TokenService';

export class FakeTokenService implements TokenService {
  signAccessToken(userId: string): string {
    return `access-token-for-${userId}`;
  }

  verifyAccessToken(token: string): { userId: string } {
    if (!token.startsWith('access-token-for-')) {
      throw new Error('invalid token');
    }
    return { userId: token.replace('access-token-for-', '') };
  }

  signRefreshToken(userId: string): string {
    return `refresh-token-for-${userId}`;
  }

  verifyRefreshToken(token: string): { userId: string } {
    if (!token.startsWith('refresh-token-for-')) {
      throw new Error('invalid token');
    }
    return { userId: token.replace('refresh-token-for-', '') };
  }
}
