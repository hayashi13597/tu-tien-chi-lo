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

describe('security headers (helmet)', () => {
  it('sets helmet defaults such as X-Content-Type-Options: nosniff', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    // helmet removes the framework-fingerprinting X-Powered-By header.
    expect(res.headers['x-powered-by']).toBeUndefined();

    await prisma.$disconnect();
  });
});
