import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { execSync } from 'node:child_process';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();
const username = `route_exp_${Date.now()}`;
let userId = '';

beforeAll(() => {
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username } });
  await prisma.$disconnect();
});

describe('expedition routes', () => {
  it('yêu cầu auth và trả catalog 8 nhánh', async () => {
    expect((await request(app).get('/expeditions/branches')).status).toBe(401);
    const agent = request.agent(app);
    expect((await agent.post('/auth/register').send({ username, password: 'password123' })).status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { username } });
    userId = user.id;
    const branches = await agent.get('/expeditions/branches');
    expect(branches.status).toBe(200);
    expect(branches.body).toHaveLength(8);
  });

  it('start/current/claim giữ slot và claim idempotent', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ username, password: 'password123' });
    const invalid = await agent.post('/expeditions/start').send({ branchId: 'hoa-vuc', difficulty: 'easy', durationSec: 60 });
    expect(invalid.status).toBe(400);

    const started = await agent.post('/expeditions/start').send({ branchId: 'hoa-vuc', difficulty: 'easy', durationSec: 1_800 });
    expect(started.status).toBe(200);
    expect(started.body.ticketCostUnits).toBe(1);
    const current = await agent.get('/expeditions/current');
    expect(current.body.remainingUnits).toBe(11);
    expect(current.body.expedition.status).toBe('running');

    const active = await agent.post('/expeditions/start').send({ branchId: 'hoa-vuc', difficulty: 'easy', durationSec: 1_800 });
    expect(active.status).toBe(409);
    expect(active.body.error.code).toBe('EXPEDITION_ACTIVE');

    await prisma.expedition.updateMany({ where: { userId, status: 'running' }, data: { completesAt: new Date(Date.now() - 1_000) } });
    const claimed = await agent.post('/expeditions/claim');
    expect(claimed.status).toBe(200);
    const repeated = await agent.post('/expeditions/claim');
    expect(repeated.status).toBe(409);
    expect(repeated.body.error.code).toBe('EXPEDITION_ALREADY_CLAIMED');
  });
});
