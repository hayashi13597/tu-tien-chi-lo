import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

beforeEach(async () => {
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /auth/register', () => {
  it('creates a user and a default character', async () => {
    const res = await request(app).post('/auth/register').send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('alice');

    const character = await prisma.character.findFirst({ where: { user: { username: 'alice' } } });
    expect(character).not.toBeNull();
    expect(character?.realmMajor).toBe(0);
  });

  it('rejects duplicate usernames with 409', async () => {
    await request(app).post('/auth/register').send({ username: 'bob', password: 'password123' });
    const res = await request(app).post('/auth/register').send({ username: 'bob', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('rejects passwords shorter than 8 characters with 400', async () => {
    const res = await request(app).post('/auth/register').send({ username: 'carol', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });
});

describe('POST /auth/login', () => {
  it('returns a JWT for valid credentials', async () => {
    await request(app).post('/auth/register').send({ username: 'dave', password: 'password123' });
    const res = await request(app).post('/auth/login').send({ username: 'dave', password: 'password123' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('rejects a wrong password with 401', async () => {
    await request(app).post('/auth/register').send({ username: 'erin', password: 'password123' });
    const res = await request(app).post('/auth/login').send({ username: 'erin', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
