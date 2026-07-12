import bcrypt from 'bcrypt';
import { PasswordHasher } from '../../domain/ports/PasswordHasher';

const SALT_ROUNDS = 10;

export class BcryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
