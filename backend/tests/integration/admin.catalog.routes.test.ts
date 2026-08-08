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
    expect(recipes.body.recipes).toHaveLength(21); // +3 T2 + 2 T3 đan combat
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

  it('material tier round-trip: PUT tier 2 → GET admin trả tier 2, sau đó restore', async () => {
    const admin = request.agent(app);
    await admin.post('/auth/login').send({ username: adminUsername, password: 'password123' });
    // Đúng seed shape của xich-viem-tinh để restore không lệch dữ liệu cho test khác.
    const seedRow = { id: 'xich-viem-tinh', name: 'Xích Viêm Tinh', glyph: '炎', rarity: 1, tier: 1, description: 'Tinh thạch hỏa thuộc tính từ Hỏa Vực.', active: true };

    const put = await admin.put('/admin/materials').send({ materials: [{ ...seedRow, tier: 2 }] });
    expect(put.status).toBe(200);
    const list = await admin.get('/admin/materials');
    expect(list.status).toBe(200);
    expect(list.body.materials.find((row: { id: string }) => row.id === seedRow.id)?.tier).toBe(2);

    await admin.put('/admin/materials').send({ materials: [seedRow] });
  });

  it('admin PUT bật-tắt/bật lại recipe (active không bị domain rule chặn)', async () => {
    const admin = request.agent(app);
    await admin.post('/auth/login').send({ username: adminUsername, password: 'password123' });
    // Đúng seed shape của recipe-hoi-khi-dan để restore không lệch dữ liệu cho test khác.
    const row = {
      id: 'recipe-hoi-khi-dan', pillId: 'hoi-khi-dan', durationSec: 1800, linhThachCost: 10,
      active: false, tier: 1, minAlchemyRank: 1, baseSuccessPct: 100,
      ingredients: [
        { materialId: 'xich-viem-tinh', quantity: 3 },
        { materialId: 'han-bang-ngoc', quantity: 2 },
      ],
    };
    const off = await admin.put('/admin/alchemy/recipes').send({ recipes: [row] });
    expect(off.status).toBe(200);
    expect(off.body.recipes.find((recipe: { id: string }) => recipe.id === row.id)?.active).toBe(false);

    // Trả state trước khi cleanup: bật lại recipe.
    const on = await admin.put('/admin/alchemy/recipes').send({ recipes: [{ ...row, active: true }] });
    expect(on.status).toBe(200);
    expect(on.body.recipes.find((recipe: { id: string }) => recipe.id === row.id)?.active).toBe(true);
  });
});
