export interface TokenService {
  signAccessToken(userId: string): string;
  verifyAccessToken(token: string): { userId: string };
}
