export interface TokenService {
  signAccessToken(userId: string, role: string): string;
  verifyAccessToken(token: string): { userId: string; role: string };
  signRefreshToken(userId: string): string;
  verifyRefreshToken(token: string): { userId: string };
}
