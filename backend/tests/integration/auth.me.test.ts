import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /auth/me', () => {
  it('returns id, username, and role for a logged-in user (cookie auth)', async () => {
    await request(app).post('/auth/register').send({ username: 'mei', password: 'password123' });
    const login = await request(app).post('/auth/login').send({ username: 'mei', password: 'password123' });
    const cookies = login.headers['set-cookie'] as unknown as string[];

    const res = await request(app).get('/auth/me').set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: expect.any(String), username: 'mei', role: 'user' });
  });

  it('carries role admin once the token does', async () => {
    await request(app).post('/auth/register').send({ username: 'root', password: 'password123' });
    await prisma.user.update({ where: { username: 'root' }, data: { role: 'admin' } });
    // Re-login so the access token carries role:admin.
    const login = await request(app).post('/auth/login').send({ username: 'root', password: 'password123' });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });
});
