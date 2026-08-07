import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { execSync } from 'node:child_process';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();
const username = `route_alchemy_${Date.now()}`;
// Register schema giới hạn username 32 ký tự — suffix ngắn để không vượt quá.
const usernameProfile = `${username}_p`;

beforeAll(() => {
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { in: [username, usernameProfile] } } });
  await prisma.$disconnect();
});

describe('materials/alchemy routes', () => {
  it('yêu cầu auth cho player endpoints', async () => {
    expect((await request(app).get('/materials/inventory')).status).toBe(401);
    expect((await request(app).get('/alchemy/recipes')).status).toBe(401);
  });

  it('trả catalog recipe, inventory và validate queue input', async () => {
    const agent = request.agent(app);
    expect((await agent.post('/auth/register').send({ username, password: 'password123' })).status).toBe(201);

    const inventory = await agent.get('/materials/inventory');
    expect(inventory.status).toBe(200);
    expect(inventory.body).toEqual([]);

    const recipes = await agent.get('/alchemy/recipes');
    expect(recipes.status).toBe(200);
    expect(recipes.body).toHaveLength(16);
    // Player view: recipe tier 1 ở rank 1 → hiệu lực đầy đủ, không locked.
    expect(recipes.body[0]).toMatchObject({ tier: 1, minAlchemyRank: 1, baseSuccessPct: 100, effectiveSuccessPct: 100, locked: false });

    const invalid = await agent.post('/alchemy/queue').send({ recipeId: 'recipe-hoi-khi-dan', quantity: 0 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('ALCHEMY_QUEUE_INVALID');
  });

  it('profile/rank-up/furnace yêu cầu auth; profile lazy trả rank 1', async () => {
    expect((await request(app).get('/alchemy/profile')).status).toBe(401);
    expect((await request(app).post('/alchemy/rank-up')).status).toBe(401);
    expect((await request(app).post('/alchemy/furnace/upgrade')).status).toBe(401);

    const agent = request.agent(app);
    expect((await agent.post('/auth/register').send({ username: usernameProfile, password: 'password123' })).status).toBe(201);
    const res = await agent.get('/alchemy/profile');
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({ rank: 1, danKhi: 0, furnaceLevel: 1 });
    expect(res.body.nextRank.target).toBe(2);
  });
});
