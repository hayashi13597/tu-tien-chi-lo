import { UserRecord } from '../entities/User';

export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: { username: string; passwordHash: string }): Promise<UserRecord>;
  // Logout-everywhere: bump the user's tokenVersion so every refresh token
  // signed with the old version stops validating. Returns the new version.
  incrementTokenVersion(id: string): Promise<number>;
}
