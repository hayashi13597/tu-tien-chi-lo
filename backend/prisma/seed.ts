import { PrismaClient } from '@prisma/client';
import { SEED_REALMS, flattenRealms } from '../src/domain/config/realms';

const prisma = new PrismaClient();

// Pill catalog mirrors the frontend mock (frontend/src/lib/pill-constants.ts):
// same ids, rarities (0..4), and four effect kinds. Definitions live in the DB
// (not config-in-code) so the catalog can change without a code deploy.
const PILLS = [
  { id: 'hoi-khi-dan', name: 'Hồi Khí Đan', glyph: '气', rarity: 0, effectKind: 'linhKhi', amount: 50, desc: 'Hấp thu linh khí tán loạn, cộng ngay 50 linh khí.' },
  { id: 'tu-linh-dan', name: 'Tụ Linh Đan', glyph: '聚', rarity: 2, effectKind: 'linhKhi', amount: 300, desc: 'Ngưng tụ linh khí thiên địa, cộng ngay 300 linh khí.' },
  { id: 'cuu-chuyen-kim-dan', name: 'Cửu Chuyển Kim Đan', glyph: '金', rarity: 4, effectKind: 'linhKhi', amount: 2000, desc: 'Thánh dược cửu chuyển, cộng ngay 2000 linh khí.' },
  { id: 'tinh-tam-dan', name: 'Tịnh Tâm Đan', glyph: '静', rarity: 1, effectKind: 'cultivationBuff', multiplier: 1.5, durationSec: 120, desc: 'Tĩnh tâm ngưng thần, tăng 50% tốc độ tu luyện trong 2 phút.' },
  { id: 'ngung-than-dan', name: 'Ngưng Thần Đan', glyph: '凝', rarity: 3, effectKind: 'cultivationBuff', multiplier: 2, durationSec: 180, desc: 'Thần thức thông suốt, tăng gấp đôi tốc độ tu luyện trong 3 phút.' },
  { id: 'pha-canh-dan', name: 'Phá Cảnh Đan', glyph: '破', rarity: 2, effectKind: 'breakthroughBoost', bonusPct: 15, desc: 'Cộng 15% tỉ lệ thành công cho lần đột phá kế tiếp.' },
  { id: 'thien-cang-dan', name: 'Thiên Cang Đan', glyph: '罡', rarity: 4, effectKind: 'breakthroughBoost', bonusPct: 40, desc: 'Cộng 40% tỉ lệ thành công cho lần đột phá kế tiếp.' },
  { id: 'giai-phat-dan', name: 'Giải Phạt Đan', glyph: '解', rarity: 3, effectKind: 'clearPunishment', desc: 'Hóa giải phản phệ độ kiếp, lập tức gỡ trạng thái bị phạt.' },
];

async function main() {
  for (const p of PILLS) {
    // Idempotent: re-running the seed updates definitions without duplicating.
    await prisma.pill.upsert({ where: { id: p.id }, create: p, update: p });
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
