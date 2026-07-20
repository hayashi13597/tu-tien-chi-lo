export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: string; // "user" | "admin"
  // Incremented on logout to invalidate all outstanding refresh tokens.
  tokenVersion: number;
  createdAt: Date;
}
