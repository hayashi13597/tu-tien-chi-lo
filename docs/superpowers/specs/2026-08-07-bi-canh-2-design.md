# Bí Cảnh 2.0 — Design Spec (Tam hệ Liên hoàn, Phase 3)

Ngày: 2026-08-07 · Nhánh: `feat/tam-he-lien-hoan` · Spec cha: `2026-08-07-tam-he-lien-hoan-design.md`

## 1. Bối cảnh và quyết định

Bí cảnh hiện tại (`expedition`): 8 nhánh (`ExpeditionBranch`) × 3 difficulty (easy/normal/hard), power ladder 100→205, mô phỏng 3 encounter (normal/normal/boss) qua `simulateBattle`, drop nguyên liệu theo `upgradeMaterialWeights`, chiến lực adaptive ±15%. Chưa có: tầng/tier, gate, loadout đan, drop Bí Tịch/Đan Hỏa Tủy. Đan dược hiện hữu không loại nào tác động combat.

Quyết định đã chốt qua brainstorming (Q1–Q8, người chơi chọn phương án A toàn bộ):

| # | Vấn đề | Quyết định |
|---|---|---|
| Q1 | Mô hình tầng | `tier` (1..3) trên `ExpeditionBranch` + `minRealmMajor` + `recommendedPower` |
| Q2 | Gate chiến lực | **Soft** — server không chặn, FE cảnh báo vàng |
| Q3 | Loadout đan | `effectKind: 'combatBuff'` mới: `{combatAttribute, combatTrigger, bonusPct}`, trigger `start`/`lowHp30` |
| Q4 | Boss drop config | Bảng mới `ExpeditionBossDropWeight` — chỉ boss encounter roll |
| Q5 | Gate cảnh giới tầng | Cố định theo tier {1→0 (Phàm Nhân), 2→3 (Kết Đan), 3→5 (Hóa Thần)}, **hard gate** khi start |
| Q6 | Redeem Bí Tịch | Giữ nguyên vai trò quà tặng, không seed code mới |
| Q7 | Gán tầng 8 nhánh | Theo power ladder sẵn: `hoa-vuc`/`bang-coc`/`kiem-mo` → tầng 1; `thanh-lam`/`u-minh`/`van-hai` → tầng 2; `long-mach`/`tinh-thien` → tầng 3 |
| Q8 | Tiêu thụ đan loadout | Trừ tồn kho **ngay khi start** trong transaction start |

Định hướng giữ nguyên: **idle-first** — chiều sâu ở chuẩn bị (build công pháp, loadout đan); combat tự động và settle offline như hiện tại.

## 2. Phạm vi

**Trong phạm vi**: tầng + gate cảnh giới (hard) + chiến lực đề xuất (soft), loadout 2 slot đan combat vào mô phỏng, boss drop Bí Tịch + Đan Hỏa Tủy, admin chỉnh được mọi con số mới, 3 đan combat T2 + recipe seed, FE player + admin tương ứng.

**Ngoài phạm vi (YAGNI)**:
- Rank Đan Sư 7–9 và *tiêu thụ* Đan Hỏa Tủy (Phase 3 chỉ cho tích lũy; `ALCHEMY_RANK_LOCKED` giữ nguyên).
- Trigger combat ngoài `start`/`lowHp30`; đan combat tier 3; buff chuỗi/combo.
- Reserve–refund đan theo kết quả; trừ đan theo số encounter; nhiều expedition đồng thời.
- Thay đổi difficulty/duration/ticket/`adaptiveCoefficient`; combat realtime hay UI minigame.

## 3. Data model & migration `bi_canh_2` (toàn additive)

```prisma
model ExpeditionBranch {
  tier              Int     @default(1)
  minRealmMajor     Int     @default(0)
  recommendedPower  Float   @default(0)
  bossDropWeights   ExpeditionBossDropWeight[]
}

model ExpeditionBossDropWeight {
  id         String           @id @default(uuid())
  branchId   String
  materialId String
  weight     Float
  branch     ExpeditionBranch @relation(fields: [branchId], references: [id], onDelete: Cascade)
  material   Material         @relation(fields: [materialId], references: [id])
  @@unique([branchId, materialId])
}

model Pill {
  combatAttribute String?
  combatTrigger   String?
}
```

- Không migrate `Expedition` — `combatSnapshot` (Json) mở rộng không đồng bộ schema: thêm optional `loadout?: LoadoutEntrySnapshot[]` (xem §4.3).
- Backfill SQL: `UPDATE "ExpeditionBranch" SET tier=2, "minRealmMajor"=3, "recommendedPower"=600 WHERE id IN ('thanh-lam','u-minh','van-hai');` và tier=3/5/1200 cho `('long-mach','tinh-thien')`. (recommendedPower là con số khởi đầu, admin chỉnh được.)

## 4. Domain

### 4.1 Types mở rộng (`domain/expedition/expedition.ts`)

```ts
export type CombatBuffTrigger = 'start' | 'lowHp30';
export interface LoadoutEntry {
  pillId: string;
  combatAttribute: keyof AttributeSet;
  combatTrigger: CombatBuffTrigger;
  pct: number; // từ Pill.bonusPct
}
export interface ExpeditionBranchConfig {
  // ... hiện có
  tier: number;
  minRealmMajor: number;
  recommendedPower: number;
  bossDropWeights: ExpeditionUpgradeMaterialWeight[]; // tái dùng shape {materialId, weight}
}
export interface ExpeditionCombatSnapshot {
  // ... hiện có
  loadout?: LoadoutEntry[];
}
```

`RewardRollInput` thêm `bossDropWeights` (truyền qua branch).

### 4.2 Gate & validate (`domain/expedition/expedition.calc.ts` + mới `expedition.loadout.ts`)

- `expeditionStartGate(branch, realmMajor): void` — hard gate: `realmMajor < branch.minRealmMajor` → `DomainError('EXPEDITION_REALM_GATE', 'Tầng N yêu cầu cảnh giới {realmName}')` (lấy tên từ RealmConfig tại application layer, truyền sẵn vào message — giữ domain thuần: gate nhận `realmName` dạng string đã resolve).
- `validateLoadout(pills: PillRecord[]): LoadoutEntry[]` — ≤2 id distinct; pill tồn tại + `active` + `effectKind === 'combatBuff'` + `bonusPct > 0` + `combatAttribute` ∈ AttributeSet + `combatTrigger` ∈ {start, lowHp30}; vi phạm → `DomainError('LOADOUT_INVALID', ...)` (400). Trả entries chuẩn hóa để snapshot.

### 4.3 Mô phỏng trigger (phương án L1 — extend `simulateBattle`)

`simulateBattle` nhận optional `pillBuffs?: LoadoutEntry[]`:

- Xử lý trong battle hiện tại (mỗi encounter là một battle riêng):
  - `start`: áp ngay trước lượt 1.
  - `lowHp30`: kiểm sau mỗi lượt; khi `player.hp <= 0.3 * maxHp` → kích **một lần** trong battle đó; không mang sang encounter kế.
- Áp buff: với mỗi attribute bị buff, cộng tuyến tính pct (nếu 2 đan cùng attribute) rồi `attrs[attr] *= (1 + sum/100)`. `khiHuyet` buff: `maxHpMới = khiHuyetMới`; `hp += (maxHpMới − maxHpCũ)`, cap tại `maxHpMới` (mô phỏng thuần, không đụng nhân vật ngoài battle).
- Enemy không bao giờ có buff. Backward-compatible: `pillBuffs` undefined → hành vi y hệt cũ.

`simulateExpedition` truyền `pillBuffs` vào mỗi `simulateBattle` (mỗi encounter khởi tạo buff lại từ đầu — buff `start` áp lại ở encounter mới, `lowHp30` reset).

### 4.4 Boss drop (`rollExpeditionRewards`)

Sau hai nhánh roll hiện có, thêm: **chỉ encounter `boss`** — `if (random.next() < difficulty.bossDropRate)` → weighted pick từ `branch.bossDropWeights` (tái dùng `weightedMaterial`), cộng material vào map (quantity 1). Tầng 1 không seed bảng này → hành vi cũ y nguyên.

### 4.5 Validate pill `combatBuff` (`domain/pills/pill.validate.ts`)

`KIND_FIELDS['combatBuff'] = { required: ['combatAttribute', 'combatTrigger'], pct: 'bonusPct' }`: bắt buộc `bonusPct > 0`, `combatAttribute` ∈ AttributeSet keys, `combatTrigger` ∈ {start, lowHp30}; `amount`/`multiplier`/`durationSec` phải null (rule hiện có: field ngoài kind phải null). Mirror ở ba chỗ theo quy ước Phase 2: BE domain `pill.validate.ts` + BE zod (`presentation/schemas/admin.schemas.ts`) + FE `lib/pill-validation.ts` (file mirror pill đã tồn tại — cập nhật, không tạo mới).

## 5. Application & API

| Chỗ | Thay đổi |
|---|---|
| `ListExpeditionBranchesUseCase` | Branch DTO thêm `tier`, `minRealmMajor`, `recommendedPower` (field thô; FE tự so sánh battlePower — không trả `locked/underPower`) |
| `StartExpeditionUseCase` | Input thêm `loadoutPillIds?: string[]`. Flow: load branch+difficulty → `expeditionStartGate` (realm) → `validateLoadout` (nếu có) → kiểm tồn kho → `expeditions.start(...)` **trong một transaction** trừ `InventoryItem` (guard `quantity >= n`, thất bại → `INSUFFICIENT_INVENTORY`) + ghi snapshot `loadout` → simulate truyền `pillBuffs` |
| `ClaimExpeditionUseCase` / claim repo | Giữ nguyên (reward materials đã chứa drop mới; claim hiện increment `MaterialInventory`) |
| `UpdateExpeditionConfigAdminUseCase` | Bundle thêm `tier` (int 1..3), `minRealmMajor` (int 0..10), `recommendedPower` (≥0), `bossDropWeights` (weight ≥ 0, materialId non-empty); `INVALID_EXPEDITION_CONFIG` 400 khi sai |
| Admin pills (create/update) | Thêm kind `combatBuff` + 2 field theo §4.5 |

Error codes mới map ở `errorHandler`: `EXPEDITION_REALM_GATE` 409, `LOADOUT_INVALID` 400 (thất bại trừ tồn kho tái dùng `INSUFFICIENT_INVENTORY` 409 hiện có).

Endpoints: **không endpoint mới** — `POST /expeditions/start` body thêm `loadoutPillIds?: string[]` (zod: array string max 2, refine distinct); `GET /expeditions/branches` response mở rộng; `POST /expeditions/claim` giữ nguyên.

## 6. Seed content

| Loại | Chi tiết |
|---|---|
| `dan-hoa-tuy` | Material tier 3, glyph 髓, name "Đan Hỏa Tủy" — chỉ tích lũy (rank 7–9 Phase sau tiêu thụ) |
| BossDropWeights tầng 2 | `thanh-lam`: `bi-tich-vong-coc`/`bi-tich-ngu-kiem`/`bi-tich-dieu-hoa`; `u-minh`: `bi-tich-tieu-chu-thien`/`bi-tich-thien-loi`/`bi-tich-ninh-dan`; `van-hai`: `bi-tich-dai-chu-thien`/`bi-tich-kim-cang`/`bi-tich-van-linh-lo` — tất cả weight 1; mỗi nhánh thêm `dan-hoa-tuy` weight 0.3 |
| BossDropWeights tầng 3 | `long-mach`: `bi-tich-vong-coc`/`bi-tich-ngu-kiem`/`bi-tich-dieu-hoa`; `tinh-thien`: `bi-tich-tieu-chu-thien`/`bi-tich-thien-loi`/`bi-tich-ninh-dan` — weight 1 + `dan-hoa-tuy` weight 0.5 |
| 3 đan combat T2 | `cuong-the-dan` (congVatLy +25%, start, rarity 3), `kim-cang-dan` (phongThu +30%, start, rarity 3), `huyen-huyet-dan` (khiHuyet +35%, lowHp30, rarity 4) — thêm vào `PILLS_T2`; 3 recipe T2 tương ứng (`minAlchemyRank 4`, `baseSuccessPct 70`, nguyên liệu tier 2 hiện có) |

Upsert idempotent theo quy ước seed hiện có.

## 7. Frontend

**Player** (`expeditions` màn):
- Group branch theo tầng: header "Tầng N · Yêu cầu {realmName}" (dùng `getRealmMeta(major).name` — helper FE đã dùng ở `congphap-modal`); nhánh khóa (realm chưa đạt) mờ + `<small class="alchemy-recipe-lock">` hint.
- Cảnh báo vàng "Chiến lực khuyến nghị {recommendedPower} (hiện tại {battlePower})" khi thấp hơn — vẫn cho xuất phát.
- Form xuất phát: **2 slot loadout** — button mở modal chọn đan trong kho (chỉ pill `effectKind='combatBuff'`, hiện tồn kho); slot có thể trống; disable start khi chọn đan hết hàng.
- Claim result: liệt kê thêm materials mới (bi-tich/đan-hoa-tuy đã nằm trong `reward.materials` — chỉ cần đảm bảo UI render theo catalog; kiểm tra trường hợp material chưa có trong map hiển thị).
- `lib/api.ts`: `startExpedition` thêm `loadoutPillIds?`; types DTO branch thêm 3 field.

**Admin**:
- `/admin/expeditions` (config): mỗi branch thêm ô `tier` (select 1..3, gợi ý gate theo tier), `minRealmMajor`, `recommendedPower`, editor `bossDropWeights` (giống pattern upgrade weights hiện có).
- `/admin/pills`: select effectKind thêm `combatBuff`; chọn kind này → hiện select `combatAttribute` (6 thuộc tính) + `combatTrigger` (start/lowHp30) + giữ ô `bonusPct`; các ô khác khóa.

## 8. Testing & acceptance (10 tiêu chí)

1. Migration additive: migrate→status sạch; seed lần 2 idempotent; 8 nhánh cũ tier đúng backfill; suite expedition cũ pass y nguyên số lượng.
2. Hard gate realm: start tầng 2 với realmMajor < 3 → 409 `EXPEDITION_REALM_GATE` có tên cảnh giới; realmMajor = 3 → 200. Tầng 3 cần 5.
3. Soft chiến lực: battlePower < recommendedPower vẫn start được (route integration).
4. Loadout: start 2 đan trừ đúng tồn kho (transactional); thiếu hàng → 409 `INSUFFICIENT_INVENTORY` và không tạo expedition; đan sai kind/inactive/trùng id/>2 → 400 `LOADOUT_INVALID`; `combatSnapshot.loadout` ghi đúng.
5. Trigger `start`: unit `simulateBattle` với buff congVatLy → damage lượt 1 tăng đúng tỉ lệ.
6. Trigger `lowHp30`: kích khi HP ≤ 30% max (đúng một lần, battle tiếp reset — test 2 encounter trong simulateExpedition); không kích khi HP không chạm ngưỡng; buff khiHuyet tăng max+current HP.
7. Boss drop: boss thắng + roll hit → bi-tich trong `reward.materials`, claim ghi vào `MaterialInventory`; `dan-hoa-tuy` chỉ tầng 2/3 (tầng 1 bảng rỗng → không bao giờ rơi).
8. Regression: toàn bộ suite cũ (alchemy/congphap/redeem/cultivation/expedition) giữ số pass (không test nào đỏ).
9. Admin round-trip integration: PUT expedition config với tier/bossDropWeights → GET lại đúng; pill `combatBuff` create/update qua admin; validate chặn sai (attribute lạ, trigger lạ, bonusPct ≤ 0).
10. Suites xanh: backend `npm test` + `npm run build`; frontend `pnpm test` + `pnpm lint` + `tsc --noEmit` + `pnpm build`.

## 9. Deploy & rollback

- Migration trước code mới (`prisma migrate deploy`), như các phase trước.
- Rollback: deploy code cũ là đủ (additive: cột/bảng mới bị bỏ qua); không cần down-migration.
- Cân bằng số (recommendedPower, weight, bonusPct đan) admin chỉnh qua UI, không cần deploy.
