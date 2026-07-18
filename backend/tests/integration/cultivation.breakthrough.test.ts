import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';
import { FixedRandomSource } from '../fakes/FixedRandomSource';

const prismaClientForApp = prisma;

async function registerAndLogin(app: ReturnType<typeof createApp>, username: string) {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /cultivation/breakthrough', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const app = createApp({ prismaClient: prismaClientForApp });
    const res = await request(app).post('/cultivation/breakthrough');
    expect(res.status).toBe(401);
  });

  it('rejects with 400 INSUFFICIENT_LINH_KHI when linh khi is below the requirement', async () => {
    const app = createApp({ prismaClient: prismaClientForApp });
    const token = await registerAndLogin(app, 'hannah');

    const res = await request(app)
      .post('/cultivation/breakthrough')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_LINH_KHI');
  });

  it('advances the substage on a forced success', async () => {
    // randomValue 0 always beats any positive success rate, forcing success.
    const app = createApp({ prismaClient: prismaClientForApp, randomSource: new FixedRandomSource(0) });
    const token = await registerAndLogin(app, 'ian');

    const user = await prisma.user.findUnique({ where: { username: 'ian' } });
    await prisma.character.update({ where: { userId: user!.id }, data: { linhKhi: 150 } });

    const res = await request(app)
      .post('/cultivation/breakthrough')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.character.realmSub).toBe(1);
    // Not an exact toBe(50): linh khi accrues lazily from real wall-clock time
    // (unlike Task 9's unit tests, which fully control `now`), so the register
    // -> login -> update -> breakthrough round trip against real Postgres always
    // adds a small, machine-speed-dependent sliver on top of the 150 - 100 = 50
    // baseline. Bound it generously (a full second at cultivationRate 1.00/s)
    // rather than asserting a value that can never land on exactly 50.
    expect(res.body.character.linhKhi).toBeGreaterThanOrEqual(50);
    expect(res.body.character.linhKhi).toBeLessThan(51);
  });

  it('punishes on a forced failure without deducting linh khi', async () => {
    // randomValue 0.999 beats no realistic success rate, forcing failure.
    const app = createApp({ prismaClient: prismaClientForApp, randomSource: new FixedRandomSource(0.999) });
    const token = await registerAndLogin(app, 'julia');

    const user = await prisma.user.findUnique({ where: { username: 'julia' } });
    await prisma.character.update({ where: { userId: user!.id }, data: { linhKhi: 150 } });

    const res = await request(app)
      .post('/cultivation/breakthrough')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    // Same lazy-accrual caveat as the forced-success case above: a failed
    // breakthrough doesn't deduct linh khi, but real wall-clock time still
    // passed since the 150 was written, so it never lands on exactly 150.
    expect(res.body.character.linhKhi).toBeGreaterThanOrEqual(150);
    expect(res.body.character.linhKhi).toBeLessThan(151);
    expect(res.body.character.punishedUntil).not.toBeNull();
  });

  it('rejects a second attempt with 400 PUNISHED while still in the punishment window', async () => {
    const app = createApp({ prismaClient: prismaClientForApp, randomSource: new FixedRandomSource(0.999) });
    const token = await registerAndLogin(app, 'kevin');

    const user = await prisma.user.findUnique({ where: { username: 'kevin' } });
    await prisma.character.update({ where: { userId: user!.id }, data: { linhKhi: 150 } });

    await request(app).post('/cultivation/breakthrough').set('Authorization', `Bearer ${token}`);
    const res = await request(app).post('/cultivation/breakthrough').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PUNISHED');
  });

  it('rejects with 400 MAX_STAGE_REACHED at Thái Ất - Viên Mãn', async () => {
    const app = createApp({ prismaClient: prismaClientForApp, randomSource: new FixedRandomSource(0) });
    const token = await registerAndLogin(app, 'laura');

    const user = await prisma.user.findUnique({ where: { username: 'laura' } });
    await prisma.character.update({
      where: { userId: user!.id },
      data: { realmMajor: 11, realmSub: 4, linhKhi: 999_999_999 },
    });

    const res = await request(app)
      .post('/cultivation/breakthrough')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MAX_STAGE_REACHED');
  });

  it('rejects the loser of two concurrent breakthrough attempts with 409 CONCURRENT_MODIFICATION', async () => {
    const app = createApp({ prismaClient: prismaClientForApp, randomSource: new FixedRandomSource(0) });
    const token = await registerAndLogin(app, 'mike');

    const user = await prisma.user.findUnique({ where: { username: 'mike' } });
    await prisma.character.update({ where: { userId: user!.id }, data: { linhKhi: 150 } });

    // Pre-warm two Prisma pool connections before racing. Root-caused via manual
    // instrumentation (process.hrtime timestamps around the repository call):
    // with a cold pool, the loser's *initial read* frequently has to pay a
    // one-time ~10ms cost to open a fresh Postgres connection, while the winner
    // reuses an already-established one and completes its entire read-compute
    // -write cycle (3 round trips) well within that window. That isn't a race
    // at all — the loser reads the row *after* the winner already committed,
    // so it correctly gets 400 INSUFFICIENT_LINH_KHI (linh khi now too low for
    // the advanced substage) instead of ever hitting the concurrency guard.
    // Warming the pool first means both requests' initial reads are contending
    // for two already-open connections, so their dispatch-to-Postgres timing
    // reflects true request concurrency instead of connection-setup latency —
    // confirmed deterministic (200/409) across dozens of manual reruns after
    // this change, versus mostly 200/400 before it. This does not change what
    // is being tested: the concurrency guard itself is untouched application
    // code: only how reliably the test induces a genuine two-reader race.
    await Promise.all([prisma.character.findFirst(), prisma.character.findFirst()]);

    const [first, second] = await Promise.all([
      request(app).post('/cultivation/breakthrough').set('Authorization', `Bearer ${token}`),
      request(app).post('/cultivation/breakthrough').set('Authorization', `Bearer ${token}`),
    ]);

    const statuses = [first.status, second.status].sort();
    // One request wins (200), the other loses the race (409) — order between
    // them is not guaranteed under real concurrency, only that both outcomes occur.
    expect(statuses).toEqual([200, 409]);
  });
});
