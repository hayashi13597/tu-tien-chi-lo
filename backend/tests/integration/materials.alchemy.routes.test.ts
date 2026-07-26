import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { execSync } from 'node:child_process';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();
const username = `route_alchemy_${Date.now()}`;

beforeAll(() => {
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username } });
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
    expect(recipes.body).toHaveLength(8);

    const invalid = await agent.post('/alchemy/queue').send({ recipeId: 'recipe-hoi-khi-dan', quantity: 0 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('ALCHEMY_QUEUE_INVALID');
  });
});
