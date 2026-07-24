import { PrismaClient } from '@prisma/client';
import { SEED_REALMS, flattenRealms } from '../src/domain/config/realms';

const prisma = new PrismaClient();

// Pill catalog mirrors the frontend mock (frontend/src/lib/pill-constants.ts):
// same ids, rarities (0..4), and four effect kinds. Definitions live in the DB
// (not config-in-code) so the catalog can change without a code deploy.
// starterQuantity carries the old hardcoded STARTER_INVENTORY values, so
// registration behavior is unchanged after migration + seed.
// NOTE: re-running the seed upserts full rows, overwriting admin edits — the
// seed is a fresh-setup/reset tool, not a routine command.
// Every optional stat field (amount/multiplier/durationSec/bonusPct) is set
// explicitly — null when it doesn't apply to the effectKind — so the upsert's
// update path clears stale values instead of leaving them behind.
const NO_STATS = { amount: null, multiplier: null, durationSec: null, bonusPct: null };
const PILLS = [
  { id: 'hoi-khi-dan', name: 'Hồi Khí Đan', glyph: '气', rarity: 0, effectKind: 'linhKhi', ...NO_STATS, amount: 50, desc: 'Hấp thu linh khí tán loạn, cộng ngay 50 linh khí.', active: true, starterQuantity: 0 },
  { id: 'tu-linh-dan', name: 'Tụ Linh Đan', glyph: '聚', rarity: 2, effectKind: 'linhKhi', ...NO_STATS, amount: 300, desc: 'Ngưng tụ linh khí thiên địa, cộng ngay 300 linh khí.', active: true, starterQuantity: 0 },
  { id: 'cuu-chuyen-kim-dan', name: 'Cửu Chuyển Kim Đan', glyph: '金', rarity: 4, effectKind: 'linhKhi', ...NO_STATS, amount: 2000, desc: 'Thánh dược cửu chuyển, cộng ngay 2000 linh khí.', active: true, starterQuantity: 0 },
  { id: 'tinh-tam-dan', name: 'Tịnh Tâm Đan', glyph: '静', rarity: 1, effectKind: 'cultivationBuff', ...NO_STATS, multiplier: 1.5, durationSec: 120, desc: 'Tĩnh tâm ngưng thần, tăng 50% tốc độ tu luyện trong 2 phút.', active: true, starterQuantity: 0 },
  { id: 'ngung-than-dan', name: 'Ngưng Thần Đan', glyph: '凝', rarity: 3, effectKind: 'cultivationBuff', ...NO_STATS, multiplier: 2, durationSec: 180, desc: 'Thần thức thông suốt, tăng gấp đôi tốc độ tu luyện trong 3 phút.', active: true, starterQuantity: 0 },
  { id: 'pha-canh-dan', name: 'Phá Cảnh Đan', glyph: '破', rarity: 2, effectKind: 'breakthroughBoost', ...NO_STATS, bonusPct: 15, desc: 'Cộng 15% tỉ lệ thành công cho lần đột phá kế tiếp.', active: true, starterQuantity: 0 },
  { id: 'thien-cang-dan', name: 'Thiên Cang Đan', glyph: '罡', rarity: 4, effectKind: 'breakthroughBoost', ...NO_STATS, bonusPct: 40, desc: 'Cộng 40% tỉ lệ thành công cho lần đột phá kế tiếp.', active: true, starterQuantity: 0 },
  { id: 'giai-phat-dan', name: 'Giải Phạt Đan', glyph: '解', rarity: 3, effectKind: 'clearPunishment', ...NO_STATS, desc: 'Hóa giải phản phệ độ kiếp, lập tức gỡ trạng thái bị phạt.', active: true, starterQuantity: 0 },
];

// Công pháp mẫu (definitions trong DB). Re-run seed upsert đè chỉnh sửa admin —
// công cụ reset, không routine (giống PILLS). effects là JSON cho công pháp bị động.
const CONG_PHAP = [
  {
    id: 'thiet-cot-quyet', name: 'Thiết Cốt Quyết', glyph: '铁', rarity: 1,
    category: 'passive', desc: 'Rèn thân như thiết, tăng khí huyết và phòng thủ.',
    active: true, maxLevel: 10, baseCost: 100, costGrowth: 1.5,
    effects: [
      { attribute: 'khiHuyet', flatPerLevel: 50, pctPerLevel: 0 },
      { attribute: 'phongThu', flatPerLevel: 8, pctPerLevel: 0 },
    ],
    powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null,
  },
  {
    id: 'linh-tuc-quyet', name: 'Linh Tốc Quyết', glyph: '速', rarity: 2,
    category: 'passive', desc: 'Thân pháp phiêu hốt, tăng tốc độ.',
    active: true, maxLevel: 10, baseCost: 150, costGrowth: 1.5,
    effects: [{ attribute: 'tocDo', flatPerLevel: 5, pctPerLevel: 2 }],
    powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null,
  },
  {
    id: 'liet-hoa-tam', name: 'Liệt Hỏa Trảm', glyph: '火', rarity: 3,
    category: 'active', desc: 'Kiếm quyết liệt hỏa, gây sát thương lớn khi combat.',
    active: true, maxLevel: 10, baseCost: 200, costGrowth: 1.6,
    effects: null, powerPerLevel: 120, chanNguyenCost: 30, dupRefundLinhThach: null,
  },
];

async function main() {
  for (const p of PILLS) {
    // Idempotent: re-running the seed updates definitions without duplicating.
    await prisma.pill.upsert({ where: { id: p.id }, create: p, update: p });
  }

  for (const c of CONG_PHAP) {
    await prisma.congPhap.upsert({ where: { id: c.id }, create: c, update: c });
  }

  // Seed the realm config from the original hard-coded balance. Idempotent:
  // upsert by the (realmMajor, realmSub) unique key so re-running updates values
  // in place instead of duplicating rows.
  for (const row of flattenRealms(SEED_REALMS)) {
    await prisma.realmStage.upsert({
      where: { realmMajor_realmSub: { realmMajor: row.realmMajor, realmSub: row.realmSub } },
      create: row,
      update: row,
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
