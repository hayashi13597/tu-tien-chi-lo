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
  await prisma.ownedCongPhap.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Register a player and return an authenticated supertest agent + userId. */
async function player(username: string) {
  const agent = request.agent(app);
  await agent.post('/auth/register').send({ username, password: 'password123' });
  const user = await prisma.user.findUnique({ where: { username } });
  return { agent, userId: user!.id };
}

describe('congphap routes', () => {
  it('GET /congphap returns an empty owned list and the active catalog', async () => {
    const { agent } = await player('cp-alice');

    const res = await agent.get('/congphap');
    expect(res.status).toBe(200);
    expect(res.body.owned).toEqual([]);
    // Seeded catalog: 2 passive + 1 active.
    expect(res.body.catalog.length).toBeGreaterThanOrEqual(3);
    expect(res.body.catalog.every((c: { active: boolean }) => c.active)).toBe(true);
  });

  it('POST /congphap/equip puts an active công pháp in a slot; unequip clears it', async () => {
    const { agent, userId } = await player('cp-bob');
    await prisma.ownedCongPhap.create({ data: { userId, congPhapId: 'liet-hoa-tam' } });

    const equipped = await agent.post('/congphap/equip').send({ congPhapId: 'liet-hoa-tam', slot: 2 });
    expect(equipped.status).toBe(200);
    let list = await agent.get('/congphap');
    expect(list.body.owned[0].equippedSlot).toBe(2);

    const unequipped = await agent.post('/congphap/unequip').send({ congPhapId: 'liet-hoa-tam' });
    expect(unequipped.status).toBe(200);
    list = await agent.get('/congphap');
    expect(list.body.owned[0].equippedSlot).toBeNull();
  });

  it('rejects equipping a passive công pháp (400 CONGPHAP_NOT_EQUIPPABLE)', async () => {
    const { agent, userId } = await player('cp-carol');
    await prisma.ownedCongPhap.create({ data: { userId, congPhapId: 'thiet-cot-quyet' } });

    const res = await agent.post('/congphap/equip').send({ congPhapId: 'thiet-cot-quyet', slot: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CONGPHAP_NOT_EQUIPPABLE');
  });

  it('rejects an out-of-range slot at the schema boundary (400)', async () => {
    const { agent, userId } = await player('cp-dave');
    await prisma.ownedCongPhap.create({ data: { userId, congPhapId: 'liet-hoa-tam' } });

    const res = await agent.post('/congphap/equip').send({ congPhapId: 'liet-hoa-tam', slot: 4 });
    expect(res.status).toBe(400);
  });

  it('rejects equipping something the player does not own (404 CONGPHAP_NOT_OWNED)', async () => {
    const { agent } = await player('cp-erin');

    const res = await agent.post('/congphap/equip').send({ congPhapId: 'liet-hoa-tam', slot: 0 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CONGPHAP_NOT_OWNED');
  });

  it('POST /congphap/levelup spends Linh Thạch and raises the level', async () => {
    const { agent, userId } = await player('cp-frank');
    await prisma.ownedCongPhap.create({ data: { userId, congPhapId: 'thiet-cot-quyet' } });
    // thiet-cot-quyet: baseCost 100 => level 1->2 costs exactly 100.
    await prisma.character.update({ where: { userId }, data: { linhThach: 100 } });
    await prisma.materialInventory.create({ data: { userId, materialId: 'linh-tai-khi-huyet', quantity: 2 } });

    const res = await agent.post('/congphap/levelup').send({ congPhapId: 'thiet-cot-quyet' });
    expect(res.status).toBe(200);
    expect(res.body.level).toBe(2);
    expect(res.body.linhThach).toBe(0);

    // A second attempt with an empty purse is rejected, and nothing changed.
    const broke = await agent.post('/congphap/levelup').send({ congPhapId: 'thiet-cot-quyet' });
    expect(broke.status).toBe(409);
    expect(broke.body.error.code).toBe('INSUFFICIENT_LINH_THACH');
    const owned = await prisma.ownedCongPhap.findFirst({ where: { userId } });
    expect(owned!.level).toBe(2);
  });

  it('GET /cultivation/state exposes attributes, battlePower and linhThach', async () => {
    const { agent } = await player('cp-gina');

    const res = await agent.get('/cultivation/state');
    expect(res.status).toBe(200);
    expect(res.body.attributes.final.khiHuyet).toBeGreaterThan(0);
    expect(typeof res.body.battlePower).toBe('number');
    expect(typeof res.body.linhThach).toBe('number');
  });

  it('a passive công pháp raises final attributes above base', async () => {
    const { agent, userId } = await player('cp-hana');
    const before = await agent.get('/cultivation/state');

    // thiet-cot-quyet at level 1: +50 khí huyết, +8 phòng thủ (flat).
    await prisma.ownedCongPhap.create({ data: { userId, congPhapId: 'thiet-cot-quyet' } });
    const after = await agent.get('/cultivation/state');

    expect(after.body.attributes.base.khiHuyet).toBe(before.body.attributes.base.khiHuyet);
    expect(after.body.attributes.final.khiHuyet).toBe(before.body.attributes.final.khiHuyet + 50);
    expect(after.body.battlePower).toBeGreaterThan(before.body.battlePower);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/congphap');
    expect(res.status).toBe(401);
  });

  // Phase 2 — POST /congphap/:id/learn (spec §9.2/§9.3)
  describe('POST /congphap/:id/learn (Phase 2)', () => {
    async function prepLearnable(userId: string, opts: { realmMajor: number; biTich: number; linhThach: number }) {
      const character = await prisma.character.findUniqueOrThrow({ where: { userId } });
      await prisma.character.update({ where: { id: character.id }, data: { realmMajor: opts.realmMajor, linhThach: opts.linhThach } });
      await prisma.materialInventory.upsert({
        where: { userId_materialId: { userId, materialId: 'bi-tich-dieu-hoa' } },
        create: { userId, materialId: 'bi-tich-dieu-hoa', quantity: opts.biTich },
        update: { quantity: opts.biTich },
      });
    }

    it('học môn Điều Hỏa Tán Quyết: trừ 1 Bí Tịch + 300 LT + owned level 1; gọi lại → 409 ALREADY_OWNED', async () => {
      const { agent, userId } = await player('cp-learn-ok');
      await prepLearnable(userId, { realmMajor: 3, biTich: 1, linhThach: 500 });

      const res = await agent.post('/congphap/dieu-hoa-tan-quyet/learn');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ owned: 'dieu-hoa-tan-quyet', linhThach: 200, biTich: { id: 'bi-tich-dieu-hoa', quantity: 0 } });

      const again = await agent.post('/congphap/dieu-hoa-tan-quyet/learn');
      expect(again.status).toBe(409);
      expect(again.body).toMatchObject({ error: { code: 'CONGPHAP_ALREADY_OWNED' } });
    });

    it('realm thấp (Trúc Cơ) → 409 CONGPHAP_REALM_GATE; biTich không bị trừ', async () => {
      const { agent, userId } = await player('cp-learn-gate');
      await prepLearnable(userId, { realmMajor: 2, biTich: 1, linhThach: 500 });

      const res = await agent.post('/congphap/dieu-hoa-tan-quyet/learn');
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'CONGPHAP_REALM_GATE' } });
      const inv = await prisma.materialInventory.findUniqueOrThrow({ where: { userId_materialId: { userId, materialId: 'bi-tich-dieu-hoa' } } });
      expect(inv.quantity).toBe(1);
    });

    it('thiếu Bí Tịch → 409 CONGPHAP_MISSING_BITICH', async () => {
      const { agent, userId } = await player('cp-learn-nobitich');
      await prepLearnable(userId, { realmMajor: 5, biTich: 0, linhThach: 500 });

      const res = await agent.post('/congphap/dieu-hoa-tan-quyet/learn');
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'CONGPHAP_MISSING_BITICH' } });
    });

    it('thiếu Linh Thạch → 409 INSUFFICIENT_LINH_THACH', async () => {
      const { agent, userId } = await player('cp-learn-poor');
      await prepLearnable(userId, { realmMajor: 5, biTich: 1, linhThach: 100 });

      const res = await agent.post('/congphap/dieu-hoa-tan-quyet/learn');
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'INSUFFICIENT_LINH_THACH' } });
    });

    it('môn không gắn Bí Tịch (tier 1) → 400 CONGPHAP_NOT_LEARNABLE', async () => {
      const { agent, userId } = await player('cp-learn-t1');
      await prepLearnable(userId, { realmMajor: 5, biTich: 0, linhThach: 500 });

      const res = await agent.post('/congphap/thiet-cot-quyet/learn');
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'CONGPHAP_NOT_LEARNABLE' } });
    });

    it('GET /congphap trả field Phase 2 + system sau khi học', async () => {
      const { agent, userId } = await player('cp-learn-list');
      await prepLearnable(userId, { realmMajor: 3, biTich: 1, linhThach: 500 });

      const before = await agent.get('/congphap');
      const entry = before.body.catalog.find((c: { id: string }) => c.id === 'dieu-hoa-tan-quyet');
      expect(entry).toMatchObject({ tier: 2, branch: 'danDao', minRealmMajor: 3, biTichMaterialId: 'bi-tich-dieu-hoa', biTichOwned: 1 });
      expect(before.body.system).toEqual({ linhKhiRatePct: 0, danDaoSuccessPct: 0 });

      await agent.post('/congphap/dieu-hoa-tan-quyet/learn');
      const after = await agent.get('/congphap');
      expect(after.body.system).toEqual({ linhKhiRatePct: 0, danDaoSuccessPct: 1 });
      const afterEntry = after.body.catalog.find((c: { id: string }) => c.id === 'dieu-hoa-tan-quyet');
      expect(afterEntry.biTichOwned).toBe(0);
    });
  });
});
