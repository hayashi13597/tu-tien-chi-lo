import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

describe('CORS', () => {
  it('reflects the configured origin with credentials allowed', async () => {
    const app = createApp();
    const res = await request(app).get('/health').set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');

    await prisma.$disconnect();
  });
});
