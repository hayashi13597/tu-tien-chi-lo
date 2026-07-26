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
});
