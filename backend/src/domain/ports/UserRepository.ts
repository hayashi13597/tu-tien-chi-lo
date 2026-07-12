import { UserRecord } from '../entities/User';

export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  create(input: { username: string; passwordHash: string }): Promise<UserRecord>;
}
