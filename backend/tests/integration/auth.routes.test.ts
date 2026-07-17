import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

function findCookie(res: request.Response, name: string): string | undefined {
  const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
  return cookies.find((c) => c.startsWith(`${name}=`));
}

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /auth/register', () => {
  it('creates a user and a default character, and sets both auth cookies', async () => {
    const res = await request(app).post('/auth/register').send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(String), username: 'alice' });
    expect(findCookie(res, 'access_token')).toContain('HttpOnly');
    expect(findCookie(res, 'refresh_token')).toContain('HttpOnly');

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

  it('allows a subsequent authenticated request with no Authorization header, using the cookie jar', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ username: 'fiona', password: 'password123' });

    const res = await agent.get('/cultivation/state');
    expect(res.status).toBe(200);
  });
});

describe('POST /auth/login', () => {
  it('returns a JWT for valid credentials and sets both auth cookies', async () => {
    await request(app).post('/auth/register').send({ username: 'dave', password: 'password123' });
    const res = await request(app).post('/auth/login').send({ username: 'dave', password: 'password123' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.refreshToken).toBeUndefined();
    expect(findCookie(res, 'access_token')).toContain('HttpOnly');
    expect(findCookie(res, 'refresh_token')).toContain('HttpOnly');
  });

  it('rejects a wrong password with 401', async () => {
    await request(app).post('/auth/register').send({ username: 'erin', password: 'password123' });
    const res = await request(app).post('/auth/login').send({ username: 'erin', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('allows a subsequent authenticated request with no Authorization header, using the cookie jar', async () => {
    await request(app).post('/auth/register').send({ username: 'george', password: 'password123' });
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ username: 'george', password: 'password123' });

    const res = await agent.get('/cultivation/state');
    expect(res.status).toBe(200);
  });
});

describe('POST /auth/refresh', () => {
  it('issues new cookies from a valid refresh_token cookie, and the agent can still reach a protected route', async () => {
    const agent = request.agent(app);
    const registerRes = await agent.post('/auth/register').send({ username: 'hannah', password: 'password123' });
    const originalAccessCookie = findCookie(registerRes, 'access_token');
    const originalRefreshCookie = findCookie(registerRes, 'refresh_token');

    const refreshRes = await agent.post('/auth/refresh');
    expect(refreshRes.status).toBe(200);
    expect(typeof refreshRes.body.token).toBe('string');
    expect(findCookie(refreshRes, 'access_token')).not.toBe(originalAccessCookie);
    expect(findCookie(refreshRes, 'refresh_token')).not.toBe(originalRefreshCookie);

    const stateRes = await agent.get('/cultivation/state');
    expect(stateRes.status).toBe(200);
  });

  it('rejects a missing refresh_token cookie with 401 INVALID_REFRESH_TOKEN', async () => {
    const res = await request(app).post('/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('rejects a tampered refresh_token cookie with 401 INVALID_REFRESH_TOKEN', async () => {
    const res = await request(app).post('/auth/refresh').set('Cookie', 'refresh_token=not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('POST /auth/logout', () => {
  it('clears both cookies and subsequent requests on the same agent are rejected', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ username: 'ian', password: 'password123' });

    const logoutRes = await agent.post('/auth/logout');
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toEqual({ message: 'Logged out' });
    expect(findCookie(logoutRes, 'access_token')).toContain('access_token=;');
    expect(findCookie(logoutRes, 'refresh_token')).toContain('refresh_token=;');

    const stateRes = await agent.get('/cultivation/state');
    expect(stateRes.status).toBe(401);

    const refreshRes = await agent.post('/auth/refresh');
    expect(refreshRes.status).toBe(401);
  });

  it('is idempotent — succeeds even with no prior session', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Logged out' });
  });
});
