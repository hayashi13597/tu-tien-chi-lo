export interface TokenService {
  signAccessToken(userId: string): string;
  verifyAccessToken(token: string): { userId: string };
  signRefreshToken(userId: string): string;
  verifyRefreshToken(token: string): { userId: string };
}
