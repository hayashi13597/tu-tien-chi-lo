export interface TokenService {
  signAccessToken(userId: string, role: string): string;
  verifyAccessToken(token: string): { userId: string; role: string };
  // The refresh token embeds the user's tokenVersion at sign time; logout bumps
  // the stored version so all previously-issued refresh tokens stop validating.
  signRefreshToken(userId: string, tokenVersion: number): string;
  verifyRefreshToken(token: string): { userId: string; tokenVersion: number };
}
