import { TokenService } from '../../src/domain/ports/TokenService';

export class FakeTokenService implements TokenService {
  signAccessToken(userId: string, role: string): string {
    return `access-token-for-${role}:${userId}`;
  }

  verifyAccessToken(token: string): { userId: string; role: string } {
    if (!token.startsWith('access-token-for-')) {
      throw new Error('invalid token');
    }
    const body = token.replace('access-token-for-', '');
    const [role, userId] = body.split(':');
    return { userId, role };
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
