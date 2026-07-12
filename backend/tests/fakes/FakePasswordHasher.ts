import { PasswordHasher } from '../../src/domain/ports/PasswordHasher';

// Deterministic, non-cryptographic stand-in for BcryptPasswordHasher (Task 10) —
// keeps use-case unit tests fast and independent of real hashing cost.
export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return hash === `hashed:${password}`;
  }
}
