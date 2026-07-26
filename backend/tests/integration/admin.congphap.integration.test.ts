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
  await prisma.user.update({ where: { username }, data: { role: 'admin' } });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

// A valid passive definition; individual tests override what they're probing.
function congPhapBody(over: Record<string, unknown> = {}) {
  return {
    id: 'admin-test-cp', name: 'Admin Test', glyph: '试', rarity: 2,
    category: 'passive', desc: 'Công pháp dựng bởi test admin.',
    active: true, maxLevel: 8, baseCost: 120, costGrowth: 1.4,
    effects: [{ attribute: 'congVatLy', flatPerLevel: 7, pctPerLevel: 1 }],
    powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null,
    ...over,
  };
}

beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

beforeEach(async () => {
  await prisma.ownedCongPhap.deleteMany();
  await prisma.congPhap.deleteMany({ where: { id: { startsWith: 'admin-test-' } } });
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.ownedCongPhap.deleteMany();
  await prisma.congPhap.deleteMany({ where: { id: { startsWith: 'admin-test-' } } });
  await prisma.$disconnect();
});

describe('/admin/congphap', () => {
  it('POST creates a definition, GET lists it, PUT edits it', async () => {
    const token = await registerAdminAndLogin('cpadmin-alice');

    const created = await request(app).post('/admin/congphap').set('Authorization', `Bearer ${token}`).send(congPhapBody());
    expect(created.status).toBe(201);
    expect(created.body.id).toBe('admin-test-cp');

    const listed = await request(app).get('/admin/congphap').set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.congphap.some((c: { id: string }) => c.id === 'admin-test-cp')).toBe(true);

    const updated = await request(app).put('/admin/congphap/admin-test-cp')
      .set('Authorization', `Bearer ${token}`)
      .send(congPhapBody({ id: undefined, name: 'Đã Sửa', active: false }));
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Đã Sửa');

    const row = await prisma.congPhap.findUnique({ where: { id: 'admin-test-cp' } });
    expect(row!.name).toBe('Đã Sửa');
    // Soft-disable, never hard-delete.
    expect(row!.active).toBe(false);
  });

  it('rejects an incoherent definition with 400 INVALID_CONGPHAP_CONFIG', async () => {
    const token = await registerAdminAndLogin('cpadmin-bob');
    // Passive with no effects — a category rule only the domain validator knows.
    const res = await request(app).post('/admin/congphap').set('Authorization', `Bearer ${token}`).send(congPhapBody({ effects: [] }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CONGPHAP_CONFIG');
  });

  it('rejects a duplicate id with 409 CONGPHAP_ID_TAKEN', async () => {
    const token = await registerAdminAndLogin('cpadmin-carol');
    await request(app).post('/admin/congphap').set('Authorization', `Bearer ${token}`).send(congPhapBody());
    const again = await request(app).post('/admin/congphap').set('Authorization', `Bearer ${token}`).send(congPhapBody());
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('CONGPHAP_ID_TAKEN');
  });

  it('PUT on an unknown id returns 404 CONGPHAP_NOT_FOUND', async () => {
    const token = await registerAdminAndLogin('cpadmin-dave');
    const res = await request(app).put('/admin/congphap/admin-test-nope')
      .set('Authorization', `Bearer ${token}`)
      .send(congPhapBody({ id: undefined }));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CONGPHAP_NOT_FOUND');
  });

  it('is forbidden for a non-admin (403)', async () => {
    const token = await registerAndLogin('cpadmin-erin');
    const res = await request(app).get('/admin/congphap').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('/admin/grant', () => {
  it('grants a công pháp and Linh Thạch, visible to that player', async () => {
    const adminToken = await registerAdminAndLogin('grant-admin');
    await request(app).post('/auth/register').send({ username: 'grant-player', password: 'password123' });
    const player = await prisma.user.findUnique({ where: { username: 'grant-player' } });

    const res = await request(app).post('/admin/grant').set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: player!.id, congPhapId: 'thiet-cot-quyet', linhThach: 750 });
    expect(res.status).toBe(200);

    const playerLogin = await request(app).post('/auth/login').send({ username: 'grant-player', password: 'password123' });
    const playerToken = playerLogin.body.token as string;

    const owned = await request(app).get('/congphap').set('Authorization', `Bearer ${playerToken}`);
    expect(owned.body.owned.map((o: { def: { id: string } }) => o.def.id)).toContain('thiet-cot-quyet');

    const state = await request(app).get('/cultivation/state').set('Authorization', `Bearer ${playerToken}`);
    expect(state.body.linhThach).toBe(750);
  });

  it('rejects a grant with nothing to give (400 INVALID_GRANT)', async () => {
    const adminToken = await registerAdminAndLogin('grant-admin-2');
    await request(app).post('/auth/register').send({ username: 'grant-player-2', password: 'password123' });
    const player = await prisma.user.findUnique({ where: { username: 'grant-player-2' } });

    const res = await request(app).post('/admin/grant').set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: player!.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_GRANT');
  });

  it('is forbidden for a non-admin (403)', async () => {
    const token = await registerAndLogin('grant-nonadmin');
    const res = await request(app).post('/admin/grant').set('Authorization', `Bearer ${token}`)
      .send({ userId: 'whoever', linhThach: 1 });
    expect(res.status).toBe(403);
  });
});
