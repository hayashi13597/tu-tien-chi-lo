export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: string; // "user" | "admin"
  createdAt: Date;
}
