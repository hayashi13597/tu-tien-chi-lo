import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

async function registerAndLogin(username: string) {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

beforeEach(async () => {
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /cultivation/state', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/cultivation/state');
    expect(res.status).toBe(401);
  });

  it('returns the starting state for a freshly registered character', async () => {
    const token = await registerAndLogin('fiona');
    const res = await request(app).get('/cultivation/state').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.realmName).toBe('Phàm Nhân - Sơ');
    expect(res.body.linhKhiRequired).toBe(100);
    expect(res.body.canBreakthrough).toBe(false);
    expect(res.body.isMaxStage).toBe(false);
  });

  it('does not write to the database on repeated calls', async () => {
    const token = await registerAndLogin('george');
    await request(app).get('/cultivation/state').set('Authorization', `Bearer ${token}`);
    const before = await prisma.character.findFirst({ where: { user: { username: 'george' } } });

    await request(app).get('/cultivation/state').set('Authorization', `Bearer ${token}`);
    const after = await prisma.character.findFirst({ where: { user: { username: 'george' } } });

    expect(after?.lastUpdateAt.getTime()).toBe(before?.lastUpdateAt.getTime());
  });
});
