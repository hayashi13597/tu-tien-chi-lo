import { describe, it, expect, vi } from 'vitest';
import { requireAdmin } from '../../src/presentation/middleware/requireAdmin';
import { AuthedRequest } from '../../src/presentation/middleware/auth';
import { DomainError } from '../../src/domain/errors';
import { Response } from 'express';

function run(role: string | undefined) {
  const req = { role } as AuthedRequest;
  const next = vi.fn();
  requireAdmin(req, {} as Response, next);
  return next;
}

describe('requireAdmin', () => {
  it('passes an admin through with no error', () => {
    const next = run('admin');
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a regular user with FORBIDDEN', () => {
    const next = run('user');
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('rejects a missing role with FORBIDDEN', () => {
    const next = run(undefined);
    expect(next.mock.calls[0][0].code).toBe('FORBIDDEN');
  });
});
