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
  { id: 'hoi-khi-dan', name: 'Hồi Khí Đan', glyph: '气', rarity: 0, effectKind: 'linhKhi', ...NO_STATS, amount: 50, desc: 'Hấp thu linh khí tán loạn, cộng ngay 50 linh khí.', active: true, starterQuantity: 0, tier: 1 },
  { id: 'tu-linh-dan', name: 'Tụ Linh Đan', glyph: '聚', rarity: 2, effectKind: 'linhKhi', ...NO_STATS, amount: 300, desc: 'Ngưng tụ linh khí thiên địa, cộng ngay 300 linh khí.', active: true, starterQuantity: 0, tier: 1 },
  { id: 'cuu-chuyen-kim-dan', name: 'Cửu Chuyển Kim Đan', glyph: '金', rarity: 4, effectKind: 'linhKhi', ...NO_STATS, amount: 2000, desc: 'Thánh dược cửu chuyển, cộng ngay 2000 linh khí.', active: true, starterQuantity: 0, tier: 1 },
  { id: 'tinh-tam-dan', name: 'Tịnh Tâm Đan', glyph: '静', rarity: 1, effectKind: 'cultivationBuff', ...NO_STATS, multiplier: 1.5, durationSec: 120, desc: 'Tĩnh tâm ngưng thần, tăng 50% tốc độ tu luyện trong 2 phút.', active: true, starterQuantity: 0, tier: 1 },
  { id: 'ngung-than-dan', name: 'Ngưng Thần Đan', glyph: '凝', rarity: 3, effectKind: 'cultivationBuff', ...NO_STATS, multiplier: 2, durationSec: 180, desc: 'Thần thức thông suốt, tăng gấp đôi tốc độ tu luyện trong 3 phút.', active: true, starterQuantity: 0, tier: 1 },
  { id: 'pha-canh-dan', name: 'Phá Cảnh Đan', glyph: '破', rarity: 2, effectKind: 'breakthroughBoost', ...NO_STATS, bonusPct: 15, desc: 'Cộng 15% tỉ lệ thành công cho lần đột phá kế tiếp.', active: true, starterQuantity: 0, tier: 1 },
  { id: 'thien-cang-dan', name: 'Thiên Cang Đan', glyph: '罡', rarity: 4, effectKind: 'breakthroughBoost', ...NO_STATS, bonusPct: 40, desc: 'Cộng 40% tỉ lệ thành công cho lần đột phá kế tiếp.', active: true, starterQuantity: 0, tier: 1 },
  { id: 'giai-phat-dan', name: 'Giải Phạt Đan', glyph: '解', rarity: 3, effectKind: 'clearPunishment', ...NO_STATS, desc: 'Hóa giải phản phệ độ kiếp, lập tức gỡ trạng thái bị phạt.', active: true, starterQuantity: 0, tier: 1 },
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
    upgradeMaterialId: 'linh-tai-khi-huyet', baseMaterialCost: 2, materialCostGrowth: 1.5, cooldownRounds: null,
  },
  {
    id: 'linh-tuc-quyet', name: 'Linh Tốc Quyết', glyph: '速', rarity: 2,
    category: 'passive', desc: 'Thân pháp phiêu hốt, tăng tốc độ.',
    active: true, maxLevel: 10, baseCost: 150, costGrowth: 1.5,
    effects: [{ attribute: 'tocDo', flatPerLevel: 5, pctPerLevel: 2 }],
    powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null,
    upgradeMaterialId: 'linh-tai-than-phap', baseMaterialCost: 2, materialCostGrowth: 1.5, cooldownRounds: null,
  },
  {
    id: 'liet-hoa-tam', name: 'Liệt Hỏa Trảm', glyph: '火', rarity: 3,
    category: 'active', desc: 'Kiếm quyết liệt hỏa, gây sát thương lớn khi combat.',
    active: true, maxLevel: 10, baseCost: 200, costGrowth: 1.6,
    effects: null, powerPerLevel: 120, chanNguyenCost: 30, dupRefundLinhThach: null,
    upgradeMaterialId: 'linh-tai-hoa-luc', baseMaterialCost: 2, materialCostGrowth: 1.6, cooldownRounds: 2,
  },
];

const MATERIALS = [
  { id: 'xich-viem-tinh', name: 'Xích Viêm Tinh', glyph: '炎', rarity: 1, description: 'Tinh thạch hỏa thuộc tính từ Hỏa Vực.', tier: 1 },
  { id: 'han-bang-ngoc', name: 'Hàn Băng Ngọc', glyph: '冰', rarity: 1, description: 'Ngọc lạnh kết tinh trong Băng Cốc.', tier: 1 },
  { id: 'kiem-nguyen-thach', name: 'Kiếm Nguyên Thạch', glyph: '剑', rarity: 2, description: 'Đá nguyên lực sắc bén của Kiếm Mộ.', tier: 1 },
  { id: 'thanh-moc-tinh', name: 'Thanh Mộc Tinh', glyph: '木', rarity: 1, description: 'Tinh hoa sinh trưởng của Thanh Lâm.', tier: 1 },
  { id: 'u-minh-thao', name: 'U Minh Thảo', glyph: '幽', rarity: 2, description: 'Linh thảo âm hàn từ U Minh.', tier: 1 },
  { id: 'van-hai-chau', name: 'Vân Hải Châu', glyph: '云', rarity: 2, description: 'Minh châu ngưng tụ trong Vân Hải.', tier: 1 },
  { id: 'long-mach-sa', name: 'Long Mạch Sa', glyph: '龙', rarity: 3, description: 'Cát linh mạch chứa long khí.', tier: 1 },
  { id: 'tinh-than-hoa', name: 'Tinh Thần Hỏa', glyph: '星', rarity: 3, description: 'Hỏa chủng rơi xuống từ Tinh Thiên.', tier: 1 },
  { id: 'linh-tai-khi-huyet', name: 'Linh Tài Khí Huyết', glyph: '血', rarity: 2, description: 'Linh tài chuyên dùng để rèn khí huyết.', tier: 1 },
  { id: 'linh-tai-than-phap', name: 'Linh Tài Thân Pháp', glyph: '身', rarity: 2, description: 'Linh tài chuyên dùng để luyện thân pháp.', tier: 1 },
  { id: 'linh-tai-hoa-luc', name: 'Linh Tài Hỏa Lực', glyph: '力', rarity: 3, description: 'Linh tài tăng cường uy lực công pháp.', tier: 1 },
] as const;

const BRANCHES = [
  { id: 'hoa-vuc', name: 'Hỏa Vực', glyph: '火', description: 'Biển lửa thiêu đốt linh lực.', basePower: 100, alchemyMaterialId: 'xich-viem-tinh' },
  { id: 'bang-coc', name: 'Băng Cốc', glyph: '冰', description: 'Thung lũng băng giá vạn năm.', basePower: 110, alchemyMaterialId: 'han-bang-ngoc' },
  { id: 'kiem-mo', name: 'Kiếm Mộ', glyph: '剑', description: 'Mộ địa của những thanh kiếm cổ.', basePower: 120, alchemyMaterialId: 'kiem-nguyen-thach' },
  { id: 'thanh-lam', name: 'Thanh Lâm', glyph: '林', description: 'Rừng xanh dày đặc yêu khí.', basePower: 130, alchemyMaterialId: 'thanh-moc-tinh' },
  { id: 'u-minh', name: 'U Minh', glyph: '幽', description: 'Cõi tối nơi âm hồn tụ hội.', basePower: 145, alchemyMaterialId: 'u-minh-thao' },
  { id: 'van-hai', name: 'Vân Hải', glyph: '云', description: 'Biển mây biến ảo khó lường.', basePower: 160, alchemyMaterialId: 'van-hai-chau' },
  { id: 'long-mach', name: 'Long Mạch', glyph: '龙', description: 'Địa mạch cuộn trào long khí.', basePower: 180, alchemyMaterialId: 'long-mach-sa' },
  { id: 'tinh-thien', name: 'Tinh Thiên', glyph: '星', description: 'Thiên vực đầy tinh thần chi lực.', basePower: 205, alchemyMaterialId: 'tinh-than-hoa' },
] as const;

const DIFFICULTIES = [
  { key: 'easy', enemyMultiplier: 0.8, normalDropRate: 0.55, bossDropRate: 0.75, rewardMultiplier: 0.8, adaptiveCoefficient: 0.1 },
  { key: 'normal', enemyMultiplier: 1, normalDropRate: 0.7, bossDropRate: 0.9, rewardMultiplier: 1, adaptiveCoefficient: 0.1 },
  { key: 'hard', enemyMultiplier: 1.3, normalDropRate: 0.85, bossDropRate: 1, rewardMultiplier: 1.25, adaptiveCoefficient: 0.15 },
] as const;

const RECIPES = [
  { id: 'recipe-hoi-khi-dan', pillId: 'hoi-khi-dan', durationSec: 1800, linhThachCost: 10, tier: 1, minAlchemyRank: 1, baseSuccessPct: 100, ingredients: [['xich-viem-tinh', 3], ['han-bang-ngoc', 2]] },
  { id: 'recipe-tu-linh-dan', pillId: 'tu-linh-dan', durationSec: 3600, linhThachCost: 20, tier: 1, minAlchemyRank: 1, baseSuccessPct: 100, ingredients: [['han-bang-ngoc', 3], ['kiem-nguyen-thach', 2]] },
  { id: 'recipe-cuu-chuyen-kim-dan', pillId: 'cuu-chuyen-kim-dan', durationSec: 14400, linhThachCost: 50, tier: 1, minAlchemyRank: 1, baseSuccessPct: 100, ingredients: [['kiem-nguyen-thach', 3], ['thanh-moc-tinh', 2]] },
  { id: 'recipe-tinh-tam-dan', pillId: 'tinh-tam-dan', durationSec: 2400, linhThachCost: 15, tier: 1, minAlchemyRank: 1, baseSuccessPct: 100, ingredients: [['thanh-moc-tinh', 3], ['u-minh-thao', 2]] },
  { id: 'recipe-ngung-than-dan', pillId: 'ngung-than-dan', durationSec: 7200, linhThachCost: 30, tier: 1, minAlchemyRank: 1, baseSuccessPct: 100, ingredients: [['u-minh-thao', 3], ['van-hai-chau', 2]] },
  { id: 'recipe-pha-canh-dan', pillId: 'pha-canh-dan', durationSec: 10800, linhThachCost: 40, tier: 1, minAlchemyRank: 1, baseSuccessPct: 100, ingredients: [['van-hai-chau', 3], ['long-mach-sa', 2]] },
  { id: 'recipe-thien-cang-dan', pillId: 'thien-cang-dan', durationSec: 21600, linhThachCost: 70, tier: 1, minAlchemyRank: 1, baseSuccessPct: 100, ingredients: [['long-mach-sa', 3], ['tinh-than-hoa', 2]] },
  { id: 'recipe-giai-phat-dan', pillId: 'giai-phat-dan', durationSec: 3000, linhThachCost: 25, tier: 1, minAlchemyRank: 1, baseSuccessPct: 100, ingredients: [['tinh-than-hoa', 3], ['xich-viem-tinh', 2]] },
] as const;

const MATERIALS_T2 = [
  { id: 'nguyet-hoa-thao', name: 'Nguyệt Hoa Thảo', glyph: '月', rarity: 3, description: 'Linh thảo hút trọn ánh trăng ngàn năm.', tier: 2 },
  { id: 'loi-minh-thach', name: 'Lôi Minh Thạch', glyph: '雷', rarity: 3, description: 'Đá tích lôi đình trong sấm sét.', tier: 2 },
  { id: 'huyet-long-sam', name: 'Huyết Long Sâm', glyph: '血', rarity: 3, description: 'Sâm đỏ như máu, nuôi dưỡng bởi long khí.', tier: 2 },
  { id: 'kim-sa-luc', name: 'Kim Sa Lục', glyph: '砂', rarity: 3, description: 'Sa vàng kết tinh từ linh mạch kim.', tier: 2 },
  { id: 'huyen-thiet-tam', name: 'Huyền Thiết Tâm', glyph: '玄', rarity: 3, description: 'Lõi huyền thiết nén vạn năm địa khí.', tier: 2 },
  { id: 'ngoc-tuyet-tinh', name: 'Ngọc Tuyết Tinh', glyph: '雪', rarity: 3, description: 'Tinh ngọc trong tuyết vĩnh cửu.', tier: 2 },
  { id: 'chu-tuoc-vu', name: 'Chu Tước Vũ', glyph: '雀', rarity: 3, description: 'Lông hỏa điểu còn vương hỏa tinh.', tier: 2 },
  { id: 'hoang-tuyen-thuy', name: 'Hoàng Tuyển Thủy', glyph: '泉', rarity: 3, description: 'Nước suối âm ty từ Hoàng Tuyển.', tier: 2 },
] as const;

const PILLS_T2 = [
  { id: 'hoan-khi-dan', name: 'Hoàn Khí Đan', glyph: '還', rarity: 2, effectKind: 'linhKhi', ...NO_STATS, amount: 800, desc: 'Đan khí quy hoàn, cộng ngay 800 linh khí.', active: true, starterQuantity: 0, tier: 2 },
  { id: 'hoan-linh-dan', name: 'Hoàn Linh Đan', glyph: '靈', rarity: 3, effectKind: 'linhKhi', ...NO_STATS, amount: 3000, desc: 'Linh đan hội tụ, cộng ngay 3000 linh khí.', active: true, starterQuantity: 0, tier: 2 },
  { id: 'van-chuyen-kim-dan', name: 'Vạn Chuyển Kim Đan', glyph: '萬', rarity: 4, effectKind: 'linhKhi', ...NO_STATS, amount: 6000, desc: 'Kim đan vạn chuyển, cộng ngay 6000 linh khí.', active: true, starterQuantity: 0, tier: 2 },
  { id: 'minh-tam-dan', name: 'Minh Tâm Đan', glyph: '明', rarity: 3, effectKind: 'cultivationBuff', ...NO_STATS, multiplier: 2, durationSec: 300, desc: 'Tâm kính như gương, tăng gấp đôi tốc độ tu luyện trong 5 phút.', active: true, starterQuantity: 0, tier: 2 },
  { id: 'hoa-than-dan', name: 'Hóa Thần Đan', glyph: '化', rarity: 4, effectKind: 'cultivationBuff', ...NO_STATS, multiplier: 2.5, durationSec: 360, desc: 'Thần hỏa luyện hóa, tăng 150% tốc độ tu luyện trong 6 phút.', active: true, starterQuantity: 0, tier: 2 },
  { id: 'dinh-can-dan', name: 'Định Căn Đan', glyph: '定', rarity: 3, effectKind: 'breakthroughBoost', ...NO_STATS, bonusPct: 25, desc: 'Củng cố căn cơ, cộng 25% tỉ lệ đột phá kế tiếp.', active: true, starterQuantity: 0, tier: 2 },
  { id: 'cuu-thien-dan', name: 'Cửu Thiên Đan', glyph: '九', rarity: 4, effectKind: 'breakthroughBoost', ...NO_STATS, bonusPct: 60, desc: 'Cửu thiên huyền khí, cộng 60% tỉ lệ đột phá kế tiếp.', active: true, starterQuantity: 0, tier: 2 },
  { id: 'giai-kiep-dan', name: 'Giải Kiếp Đan', glyph: '劫', rarity: 4, effectKind: 'clearPunishment', ...NO_STATS, desc: 'Hóa giải kiếp vận, lập tức gỡ trạng thái bị phạt.', active: true, starterQuantity: 0, tier: 2 },
];

const RECIPES_T2 = [
  { id: 'recipe-hoan-khi-dan', pillId: 'hoan-khi-dan', durationSec: 7200, linhThachCost: 60, tier: 2, minAlchemyRank: 4, baseSuccessPct: 75, ingredients: [['nguyet-hoa-thao', 3], ['loi-minh-thach', 2], ['xich-viem-tinh', 2]] },
  { id: 'recipe-minh-tam-dan', pillId: 'minh-tam-dan', durationSec: 9600, linhThachCost: 75, tier: 2, minAlchemyRank: 4, baseSuccessPct: 72, ingredients: [['loi-minh-thach', 3], ['huyet-long-sam', 2], ['han-bang-ngoc', 2]] },
  { id: 'recipe-dinh-can-dan', pillId: 'dinh-can-dan', durationSec: 10800, linhThachCost: 90, tier: 2, minAlchemyRank: 4, baseSuccessPct: 70, ingredients: [['huyet-long-sam', 3], ['kim-sa-luc', 2], ['kiem-nguyen-thach', 2]] },
  { id: 'recipe-hoan-linh-dan', pillId: 'hoan-linh-dan', durationSec: 10800, linhThachCost: 90, tier: 2, minAlchemyRank: 4, baseSuccessPct: 70, ingredients: [['kim-sa-luc', 3], ['huyen-thiet-tam', 2], ['thanh-moc-tinh', 2]] },
  { id: 'recipe-giai-kiep-dan', pillId: 'giai-kiep-dan', durationSec: 9600, linhThachCost: 80, tier: 2, minAlchemyRank: 4, baseSuccessPct: 70, ingredients: [['huyen-thiet-tam', 3], ['ngoc-tuyet-tinh', 2], ['u-minh-thao', 2]] },
  { id: 'recipe-hoa-than-dan', pillId: 'hoa-than-dan', durationSec: 14400, linhThachCost: 120, tier: 2, minAlchemyRank: 4, baseSuccessPct: 65, ingredients: [['ngoc-tuyet-tinh', 3], ['chu-tuoc-vu', 2], ['van-hai-chau', 2]] },
  { id: 'recipe-cuu-thien-dan', pillId: 'cuu-thien-dan', durationSec: 14400, linhThachCost: 120, tier: 2, minAlchemyRank: 4, baseSuccessPct: 65, ingredients: [['chu-tuoc-vu', 3], ['hoang-tuyen-thuy', 2], ['long-mach-sa', 2]] },
  { id: 'recipe-van-chuyen-kim-dan', pillId: 'van-chuyen-kim-dan', durationSec: 21600, linhThachCost: 150, tier: 2, minAlchemyRank: 4, baseSuccessPct: 60, ingredients: [['hoang-tuyen-thuy', 3], ['nguyet-hoa-thao', 2], ['tinh-than-hoa', 2]] },
] as const;

// Nguyên liệu tier 2 rơi theo bảng drop trọng số của nhánh (weight thấp — Phase 3
// cơ cấu lại theo tầng bí cảnh).
const TIER2_DROPS: readonly (readonly [string, string, number])[] = [
  ['hoa-vuc', 'chu-tuoc-vu', 0.3],
  ['bang-coc', 'ngoc-tuyet-tinh', 0.3],
  ['kiem-mo', 'huyen-thiet-tam', 0.3],
  ['thanh-lam', 'huyet-long-sam', 0.3],
  ['u-minh', 'hoang-tuyen-thuy', 0.3],
  ['van-hai', 'nguyet-hoa-thao', 0.3],
  ['long-mach', 'loi-minh-thach', 0.3],
  ['tinh-thien', 'kim-sa-luc', 0.3],
];

const UPGRADE_MATERIALS = ['linh-tai-khi-huyet', 'linh-tai-than-phap', 'linh-tai-hoa-luc'] as const;

async function main() {
  for (const p of [...PILLS, ...PILLS_T2]) {
    // Idempotent: re-running the seed updates definitions without duplicating.
    await prisma.pill.upsert({ where: { id: p.id }, create: p, update: p });
  }

  for (const material of [...MATERIALS, ...MATERIALS_T2]) {
    await prisma.material.upsert({
      where: { id: material.id },
      create: { ...material, active: true },
      update: { ...material, active: true },
    });
  }

  for (const c of CONG_PHAP) {
    await prisma.congPhap.upsert({ where: { id: c.id }, create: c, update: c });
  }

  for (const recipe of [...RECIPES, ...RECIPES_T2]) {
    const { ingredients, ...recipeData } = recipe;
    await prisma.alchemyRecipe.upsert({
      where: { id: recipe.id },
      create: { ...recipeData, active: true },
      update: { ...recipeData, active: true },
    });
    for (const [materialId, quantity] of ingredients) {
      await prisma.alchemyRecipeIngredient.upsert({
        where: { recipeId_materialId: { recipeId: recipe.id, materialId } },
        create: { id: `${recipe.id}-${materialId}`, recipeId: recipe.id, materialId, quantity },
        update: { quantity },
      });
    }
  }

  for (const branch of BRANCHES) {
    await prisma.expeditionBranch.upsert({
      where: { id: branch.id },
      create: branch,
      update: branch,
    });
    for (const difficulty of DIFFICULTIES) {
      await prisma.expeditionDifficulty.upsert({
        where: { branchId_key: { branchId: branch.id, key: difficulty.key } },
        create: { ...difficulty, branchId: branch.id },
        update: { ...difficulty },
      });
    }
    for (const [index, materialId] of UPGRADE_MATERIALS.entries()) {
      await prisma.expeditionUpgradeMaterialWeight.upsert({
        where: { branchId_materialId: { branchId: branch.id, materialId } },
        create: { id: `${branch.id}-${materialId}`, branchId: branch.id, materialId, weight: 1 + (index * 0.25) },
        update: { weight: 1 + (index * 0.25) },
      });
    }
    const tier2 = TIER2_DROPS.find(([branchId]) => branchId === branch.id);
    if (tier2) {
      const [, materialId, weight] = tier2;
      await prisma.expeditionUpgradeMaterialWeight.upsert({
        where: { branchId_materialId: { branchId: branch.id, materialId } },
        create: { id: `${branch.id}-${materialId}`, branchId: branch.id, materialId, weight },
        update: { weight },
      });
    }
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
