import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('pills routes', () => {
  it('GET /pills/inventory returns the starter inventory after register', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ username: 'inv-alice', password: 'password123' });

    const res = await agent.get('/pills/inventory');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(8);
    const hoiKhi = res.body.find((p: { id: string }) => p.id === 'hoi-khi-dan');
    expect(hoiKhi).toMatchObject({ id: 'hoi-khi-dan', quantity: 5, effectKind: 'linhKhi' });
  });

  it('POST /pills/consume applies linhKhi and decrements the stack', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ username: 'inv-bob', password: 'password123' });

    const res = await agent.post('/pills/consume').send({ pillId: 'hoi-khi-dan' });
    expect(res.status).toBe(200);
    expect(res.body.linhKhi).toBeGreaterThanOrEqual(50);
    expect(typeof res.body.linhKhiRequired).toBe('number');

    const inv = await agent.get('/pills/inventory');
    const hoiKhi = inv.body.find((p: { id: string }) => p.id === 'hoi-khi-dan');
    expect(hoiKhi.quantity).toBe(4);
  });

  it('POST /pills/consume of a not-punished clearPunishment pill -> 400 PILL_NOT_APPLICABLE', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ username: 'inv-carol', password: 'password123' });

    const res = await agent.post('/pills/consume').send({ pillId: 'giai-phat-dan' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PILL_NOT_APPLICABLE');
  });

  it('consuming a single-unit pill twice -> second is 409 PILL_OUT_OF_STOCK', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ username: 'inv-dave', password: 'password123' });

    const first = await agent.post('/pills/consume').send({ pillId: 'cuu-chuyen-kim-dan' });
    expect(first.status).toBe(200);
    const second = await agent.post('/pills/consume').send({ pillId: 'cuu-chuyen-kim-dan' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('PILL_OUT_OF_STOCK');
  });

  it('POST /pills/consume without auth -> 401', async () => {
    const res = await request(app).post('/pills/consume').send({ pillId: 'hoi-khi-dan' });
    expect(res.status).toBe(401);
  });
});
