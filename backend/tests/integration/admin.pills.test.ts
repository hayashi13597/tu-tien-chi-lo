import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

async function registerAndLogin(username: string): Promise<string> {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

async function registerAdminAndLogin(username: string): Promise<string> {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  // Promote directly in the DB, then log in so the access token carries role:admin.
  await prisma.user.update({ where: { username }, data: { role: 'admin' } });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

// A fully valid pill body (POST shape: includes id).
function pillBody(id: string, over: Record<string, unknown> = {}) {
  return {
    id, name: 'Test Đan', glyph: '试', rarity: 1, effectKind: 'linhKhi',
    amount: 25, multiplier: null, durationSec: null, bonusPct: null,
    desc: 'mô tả test', active: true, starterQuantity: 0, ...over,
  };
}

beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
  // Drop pills created by earlier cases in this file (test-* naming convention).
  await prisma.pill.deleteMany({ where: { id: { startsWith: 'test-' } } });
});

afterAll(async () => {
  await prisma.inventoryItem.deleteMany({ where: { pillId: { startsWith: 'test-' } } });
  await prisma.pill.deleteMany({ where: { id: { startsWith: 'test-' } } });
  await prisma.$disconnect();
});

describe('/admin/pills', () => {
  it('rejects a non-admin on GET, POST and PUT with 403', async () => {
    const token = await registerAndLogin('bob');
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    expect((await auth(request(app).get('/admin/pills'))).status).toBe(403);
    expect((await auth(request(app).post('/admin/pills').send(pillBody('test-x')))).status).toBe(403);
    expect((await auth(request(app).put('/admin/pills/test-x').send(pillBody('test-x')))).status).toBe(403);
  });

  it('admin CRUD round-trip: create → list (includes inactive) → update → list', async () => {
    const token = await registerAdminAndLogin('root');
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

    const post = await auth(request(app).post('/admin/pills').send(pillBody('test-crud')));
    expect(post.status).toBe(201);
    expect(post.body.id).toBe('test-crud');

    const list1 = await auth(request(app).get('/admin/pills'));
    expect(list1.status).toBe(200);
    expect(list1.body.pills.some((p: { id: string }) => p.id === 'test-crud')).toBe(true);

    const { id: _drop, ...updateBody } = pillBody('test-crud', { name: 'Đổi Tên Đan', amount: 77, active: false });
    const put = await auth(request(app).put('/admin/pills/test-crud').send(updateBody));
    expect(put.status).toBe(200);
    expect(put.body.name).toBe('Đổi Tên Đan');

    // Inactive pills still appear in the admin list.
    const list2 = await auth(request(app).get('/admin/pills'));
    const row = list2.body.pills.find((p: { id: string }) => p.id === 'test-crud');
    expect(row.active).toBe(false);
    expect(row.amount).toBe(77);
  });

  it('rejects a duplicate id with 409 PILL_ID_TAKEN', async () => {
    const token = await registerAdminAndLogin('root');
    const res = await request(app).post('/admin/pills')
      .set('Authorization', `Bearer ${token}`).send(pillBody('hoi-khi-dan'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PILL_ID_TAKEN');
  });

  it('rejects an invalid definition with 400 INVALID_PILL_CONFIG', async () => {
    const token = await registerAdminAndLogin('root');
    // linhKhi pill without an amount — passes zod nullable but fails the domain rule.
    const res = await request(app).post('/admin/pills')
      .set('Authorization', `Bearer ${token}`).send(pillBody('test-bad', { amount: null }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PILL_CONFIG');
  });

  it('rejects a bad id slug on create with 400', async () => {
    const token = await registerAdminAndLogin('root');
    const res = await request(app).post('/admin/pills')
      .set('Authorization', `Bearer ${token}`).send(pillBody('Test Đan!'));
    expect(res.status).toBe(400);
  });

  it('PUT on an unknown id returns 404 PILL_NOT_FOUND', async () => {
    const token = await registerAdminAndLogin('root');
    const { id: _drop, ...body } = pillBody('test-ghost');
    const res = await request(app).put('/admin/pills/test-ghost')
      .set('Authorization', `Bearer ${token}`).send(body);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PILL_NOT_FOUND');
  });

  it('disabling a pill hides it from the player inventory, blocks consume, and survives re-enable', async () => {
    const adminToken = await registerAdminAndLogin('root');
    const adminAuth = (r: request.Test) => r.set('Authorization', `Bearer ${adminToken}`);

    // Create a pill and hand a player some units directly.
    await adminAuth(request(app).post('/admin/pills').send(pillBody('test-toggle')));
    const playerToken = await registerAndLogin('alice');
    const player = await prisma.user.findUniqueOrThrow({ where: { username: 'alice' } });
    await prisma.inventoryItem.create({ data: { userId: player.id, pillId: 'test-toggle', quantity: 3 } });

    // Visible while active.
    const invBefore = await request(app).get('/pills/inventory').set('Authorization', `Bearer ${playerToken}`);
    expect(invBefore.body.some((p: { id: string }) => p.id === 'test-toggle')).toBe(true);

    // Disable it.
    const { id: _drop, ...body } = pillBody('test-toggle', { active: false });
    await adminAuth(request(app).put('/admin/pills/test-toggle').send(body));

    // Hidden from inventory; consume is a 404; the DB row survives.
    const invAfter = await request(app).get('/pills/inventory').set('Authorization', `Bearer ${playerToken}`);
    expect(invAfter.body.some((p: { id: string }) => p.id === 'test-toggle')).toBe(false);
    const consume = await request(app).post('/pills/consume')
      .set('Authorization', `Bearer ${playerToken}`).send({ pillId: 'test-toggle' });
    expect(consume.status).toBe(404);
    const row = await prisma.inventoryItem.findUnique({
      where: { userId_pillId: { userId: player.id, pillId: 'test-toggle' } },
    });
    expect(row?.quantity).toBe(3);

    // Re-enable: holdings are back.
    await adminAuth(request(app).put('/admin/pills/test-toggle').send({ ...body, active: true }));
    const invRestored = await request(app).get('/pills/inventory').set('Authorization', `Bearer ${playerToken}`);
    expect(invRestored.body.find((p: { id: string }) => p.id === 'test-toggle')?.quantity).toBe(3);
  });

  it('registration grants starter inventory per starterQuantity', async () => {
    const adminToken = await registerAdminAndLogin('root');
    await request(app).post('/admin/pills').set('Authorization', `Bearer ${adminToken}`)
      .send(pillBody('test-starter', { starterQuantity: 7 }));

    const playerToken = await registerAndLogin('carol');
    const inv = await request(app).get('/pills/inventory').set('Authorization', `Bearer ${playerToken}`);
    expect(inv.body.find((p: { id: string }) => p.id === 'test-starter')?.quantity).toBe(7);
    // The classic seeded starters are still granted too.
    expect(inv.body.find((p: { id: string }) => p.id === 'hoi-khi-dan')?.quantity).toBe(5);
  });
});
