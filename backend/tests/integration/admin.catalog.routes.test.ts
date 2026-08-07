import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { execSync } from 'node:child_process';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();
const adminUsername = `catalog_admin_${Date.now()}`;
const userUsername = `catalog_user_${Date.now()}`;

beforeAll(() => execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' }));

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { in: [adminUsername, userUsername] } } });
  await prisma.$disconnect();
});

describe('admin material/alchemy/expedition catalog routes', () => {
  it('admin đọc được ba catalog, user thường nhận 403', async () => {
    const admin = request.agent(app);
    expect((await admin.post('/auth/register').send({ username: adminUsername, password: 'password123' })).status).toBe(201);
    await prisma.user.update({ where: { username: adminUsername }, data: { role: 'admin' } });
    await admin.post('/auth/login').send({ username: adminUsername, password: 'password123' });

    const materials = await admin.get('/admin/materials');
    const recipes = await admin.get('/admin/alchemy/recipes');
    const expeditions = await admin.get('/admin/expeditions');
    expect(materials.status).toBe(200);
    expect(materials.body.materials.length).toBeGreaterThanOrEqual(11);
    expect(recipes.status).toBe(200);
    expect(recipes.body.recipes).toHaveLength(16);
    expect(expeditions.status).toBe(200);
    expect(expeditions.body.branches).toHaveLength(8);

    const user = request.agent(app);
    expect((await user.post('/auth/register').send({ username: userUsername, password: 'password123' })).status).toBe(201);
    expect((await user.get('/admin/materials')).status).toBe(403);
  });

  it('admin PUT validation reject payload thiếu catalog fields', async () => {
    const admin = request.agent(app);
    await admin.post('/auth/login').send({ username: adminUsername, password: 'password123' });
    const res = await admin.put('/admin/expeditions').send({ branches: [{ branch: { id: 'hoa-vuc' }, difficulties: [] }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_EXPEDITION_CONFIG');
  });
});
