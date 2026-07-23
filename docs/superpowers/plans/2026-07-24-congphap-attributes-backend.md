# Công Pháp & Thuộc tính — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 6 thuộc tính nhân vật + Chiến lực (tính server-authoritative) và hệ thống công pháp (bị động cộng thuộc tính, chủ động 4 slot để dành combat) nâng cấp bằng Linh Thạch, cấp qua redeem + admin — toàn bộ ở backend.

**Architecture:** Clean Architecture, nhân bản pattern `Pill`. Domain thuần (`attributes/`, `congphap/`, mở rộng `config/realms.ts`) → application use cases (chỉ phụ thuộc port) → infrastructure (Prisma repos) → presentation (Express routes + zod schemas). Composition root `app.ts` nối infra thật. Thuộc tính trả kèm trong `GetCultivationState`. Nâng cấp/tiêu Linh Thạch dùng optimistic concurrency + saga bù (không transaction cross-repo trong application), giống `ConsumePillUseCase`.

**Tech Stack:** Node 24 + Express, TypeScript, Prisma + PostgreSQL, zod (presentation), Vitest (unit + integration vs Postgres thật), bcrypt/jsonwebtoken (không đụng ở plan này).

## Global Constraints

- **Clean Architecture, dependency hướng vào trong.** `domain/` không import `infrastructure`/`presentation`. Use case chỉ phụ thuộc port domain. `errorHandler.ts` là **nguồn duy nhất** map `DomainError.code` → HTTP status.
- **`context7` (`ctx7` CLI) trước khi dùng API thư viện** (Prisma `Json` field / `updateMany` / migrate, zod, Express) — đối chiếu version pin trong `backend/package.json`.
- **Comment logic nghiệp vụ không tầm thường** (công thức, optimistic concurrency, saga) giải thích *tại sao*.
- **Optimistic concurrency:** `updateMany({ where: { id, lastUpdateAt } })` + `count === 0` → `CONCURRENT_MODIFICATION`.
- **Soft-disable, không hard-delete** công pháp (`active` flag), giống `Pill`.
- **Không starter, không gacha** ở phase này. Công pháp chủ động **cố ý không** cộng thuộc tính/chiến lực.
- **6 khóa thuộc tính (đặt tên chính xác, dùng nguyên văn):** `khiHuyet, chanNguyen, congVatLy, congPhep, phongThu, tocDo`.
- **Mã lỗi mới:** `CONGPHAP_NOT_FOUND` 404 · `CONGPHAP_NOT_OWNED` 404 · `CONGPHAP_NOT_EQUIPPABLE` 400 · `CONGPHAP_SLOT_INVALID` 400 · `CONGPHAP_MAX_LEVEL` 409 · `INSUFFICIENT_LINH_THACH` 409 · `INVALID_CONGPHAP_CONFIG` 400 · `CONGPHAP_ID_TAKEN` 409.
- **Test gotchas:** pre-warm Prisma connection trước khi race concurrent request; username phải `min(3)` ký tự (registerSchema).
- **Commit message tiếng Việt, KHÔNG kèm trailer Co-Authored-By.**
- **Sau mỗi task cập nhật `CLAUDE.md`** (core facts + test counts) — chỉ trạng thái hiện tại.

---

## File Structure

**Tạo mới (domain):**
- `backend/src/domain/attributes/attributes.ts` — `AttributeSet`, `ATTRIBUTE_KEYS`, `BATTLE_POWER_WEIGHTS`.
- `backend/src/domain/attributes/attributes.calc.ts` — `computeAttributes`, `computeBattlePower`.
- `backend/src/domain/congphap/congphap.ts` — `CongPhapRecord`, `CongPhapCategory`, `PassiveEffect`, `OwnedCongPhapEntry`, `ACTIVE_SLOTS`.
- `backend/src/domain/congphap/congphap.calc.ts` — `levelUpCost`, `duplicateRefund`.
- `backend/src/domain/congphap/congphap.validate.ts` — `validateCongPhapDefinition`.
- `backend/src/domain/ports/CongPhapRepository.ts`, `backend/src/domain/ports/OwnedCongPhapRepository.ts`.

**Tạo mới (application):**
- `backend/src/application/attributeState.ts` — helper `buildAttributeState`.
- `backend/src/application/ListCongPhapUseCase.ts`, `EquipCongPhapUseCase.ts`, `UnequipCongPhapUseCase.ts`, `LevelUpCongPhapUseCase.ts`.
- `backend/src/application/CreateCongPhapUseCase.ts`, `UpdateCongPhapUseCase.ts`, `ListCongPhapAdminUseCase.ts`, `GrantUseCase.ts`.

**Tạo mới (infrastructure):**
- `backend/src/infrastructure/repositories/PrismaCongPhapRepository.ts`, `PrismaOwnedCongPhapRepository.ts`.

**Tạo mới (presentation):**
- `backend/src/presentation/routes/congphap.routes.ts`, `backend/src/presentation/schemas/congphap.schemas.ts`.

**Sửa:**
- `backend/prisma/schema.prisma` (+RealmStage base cols, Character.linhThach, CongPhap, OwnedCongPhap, RedeemCodeReward), `backend/prisma/seed.ts`.
- `backend/src/domain/config/realms.ts` (+6 base fields, `deriveBaseAttributes`, `RealmConfigSet.baseAttributes`).
- `backend/src/domain/entities/Character.ts` (+`linhThach`), `backend/src/domain/ports/CharacterRepository.ts` (+`linhThach` trong update, +`spendLinhThach`/`addLinhThach`).
- `backend/src/infrastructure/repositories/PrismaCharacterRepository.ts`, `PrismaRealmConfigRepository.ts`.
- `backend/src/application/GetCultivationStateUseCase.ts` (+output fields), `ConsumePillUseCase.ts`, `AttemptBreakthroughUseCase.ts` (điền field mới), `UpdateRealmConfigUseCase.ts` (base attrs), `RedeemCodeUseCase.ts` (congphap+linhThach).
- `backend/src/domain/redeem/redeemCode.ts` (RewardEntry mở rộng).
- `backend/src/presentation/middleware/errorHandler.ts`, `admin.routes.ts`, `admin.schemas.ts`, `redeem`/`cultivation` output serialization, `app.ts`.

---

## Task 1: Prisma schema, migration & seed (DB layer)

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: bảng `CongPhap`, `OwnedCongPhap`; cột `Character.linhThach Int`; 6 cột base trên `RealmStage`; `RedeemCodeReward.congPhapId?`/`linhThach?`. Prisma Client được regenerate với các model này.

- [ ] **Step 1: Thêm cột base vào `RealmStage`, `linhThach` vào `Character`, model mới**

Trong `schema.prisma`, thêm vào `model Character` (sau `linhKhi`):
```prisma
  // Currency dùng để nâng cấp công pháp. Cấp qua redeem code + admin.
  linhThach         Int       @default(0)
```
Thêm vào `model RealmStage` (sau `punishmentSeconds`):
```prisma
  // Thuộc tính nền của sub-stage (trước bonus công pháp bị động). Admin chỉnh.
  baseKhiHuyet      Float     @default(0)
  baseChanNguyen    Float     @default(0)
  baseCongVatLy     Float     @default(0)
  baseCongPhep      Float     @default(0)
  basePhongThu      Float     @default(0)
  baseTocDo         Float     @default(0)
```
Thêm relation vào `model User`:
```prisma
  ownedCongPhap OwnedCongPhap[]
```
Thêm 2 model mới (cuối file):
```prisma
model CongPhap {
  id                 String            @id
  name               String
  glyph              String
  rarity             Int
  category           String            // "active" | "passive"
  desc               String
  active             Boolean           @default(true)
  maxLevel           Int
  baseCost           Int
  costGrowth         Float
  // Bị động: mảng PassiveEffect { attribute, flatPerLevel, pctPerLevel }.
  effects            Json?
  // Chủ động: skill power = powerPerLevel * level (lưu & hiển thị, chưa áp dụng).
  powerPerLevel      Float?
  chanNguyenCost     Float?
  // Linh Thạch quy đổi khi redeem trùng; null => dùng baseCost.
  dupRefundLinhThach Int?
  owned              OwnedCongPhap[]
  redeemRewards      RedeemCodeReward[]
}

model OwnedCongPhap {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  congPhapId   String
  congPhap     CongPhap @relation(fields: [congPhapId], references: [id])
  level        Int      @default(1)
  // 0..3 cho công pháp chủ động đã trang bị; null nếu chưa trang bị / bị động.
  equippedSlot Int?

  @@unique([userId, congPhapId])
}
```

- [ ] **Step 2: Mở rộng `RedeemCodeReward` (reward đa loại)**

Trong `model RedeemCodeReward`, đổi `pillId`/`quantity` sang cho phép reward là 1 trong {pill, congphap, linhThach}:
```prisma
model RedeemCodeReward {
  id         String     @id @default(uuid())
  codeId     String
  code       RedeemCode @relation(fields: [codeId], references: [id], onDelete: Cascade)
  // Đúng MỘT trong ba loại reward dưới đây khác null (validate ở domain khi tạo code).
  pillId     String?
  pill       Pill?      @relation(fields: [pillId], references: [id])
  congPhapId String?
  congPhap   CongPhap?  @relation(fields: [congPhapId], references: [id])
  linhThach  Int?
  quantity   Int
}
```
Bỏ `@@unique([codeId, pillId])` cũ (pillId giờ nullable — unique trên nullable khác nhau giữa DB; thay bằng không ràng buộc unique, hoặc `@@unique([codeId, pillId, congPhapId])`). **Dùng:** xóa dòng `@@unique([codeId, pillId])`. (Tránh đổi hành vi redeem cũ: `Pill.redeemRewards` relation vẫn còn.)

- [ ] **Step 3: Tạo migration & regenerate client**

Run: `cd backend && npx prisma migrate dev --name congphap_attributes`
Expected: migration mới trong `prisma/migrations/`, "Your database is now in sync", client regenerate không lỗi.

- [ ] **Step 4: Seed base attributes + công pháp mẫu**

Trong `seed.ts`, sau import hiện có thêm:
```ts
import { SEED_REALMS, flattenRealms } from '../src/domain/config/realms';
```
(đã có — `flattenRealms` sau Task 4 sẽ tự mang 6 base fields). Thêm mảng công pháp mẫu + upsert (idempotent):
```ts
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
```
Trong `main()`, trước/sau vòng lặp PILLS thêm:
```ts
  for (const c of CONG_PHAP) {
    await prisma.congPhap.upsert({ where: { id: c.id }, create: c, update: c });
  }
```

- [ ] **Step 5: Chạy seed để xác thực**

Run: `cd backend && npm run db:seed`
Expected: chạy xong không lỗi; `npx prisma studio` (hoặc query) thấy 3 CongPhap, RealmStage 60 dòng có base > 0 (base do Task 4 điền — nếu chạy trước Task 4 base = 0, chấp nhận, seed lại sau Task 4).

- [ ] **Step 6: Commit**

```bash
cd backend && git add prisma/schema.prisma prisma/seed.ts prisma/migrations
git commit -m "feat(db): schema công pháp, thuộc tính nền RealmStage, Linh Thạch, reward đa loại"
```

---

## Task 2: Domain — thuộc tính (types + calc)

**Files:**
- Create: `backend/src/domain/attributes/attributes.ts`
- Create: `backend/src/domain/attributes/attributes.calc.ts`
- Test: `backend/src/domain/attributes/attributes.calc.test.ts`

**Interfaces:**
- Consumes: `CongPhapRecord` (Task 3 — chỉ dùng ở kiểu `OwnedPassive`; nếu làm Task 2 trước Task 3, khai báo `OwnedPassive` chỉ cần `{ effects, ... }` — dùng import type sau). Để tránh phụ thuộc vòng, `computeAttributes` nhận `passives: OwnedPassive[]` với `OwnedPassive = { effects: PassiveEffect[]; level: number }` (chỉ cần effects + level, không cần cả record).
- Produces: `AttributeSet`, `ATTRIBUTE_KEYS`, `BATTLE_POWER_WEIGHTS`, `computeAttributes(base, passives)`, `computeBattlePower(final, weights?)`, type `OwnedPassive`, `PassiveEffect` (re-dùng từ congphap — xem chú thích).

- [ ] **Step 1: Viết test thất bại**

`attributes.calc.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeAttributes, computeBattlePower } from './attributes.calc';
import { AttributeSet, BATTLE_POWER_WEIGHTS } from './attributes';

const ZERO: AttributeSet = { khiHuyet: 0, chanNguyen: 0, congVatLy: 0, congPhep: 0, phongThu: 0, tocDo: 0 };
const base: AttributeSet = { khiHuyet: 100, chanNguyen: 80, congVatLy: 20, congPhep: 20, phongThu: 10, tocDo: 5 };

describe('computeAttributes', () => {
  it('trả base nguyên vẹn khi không có passive', () => {
    const r = computeAttributes(base, []);
    expect(r.base).toEqual(base);
    expect(r.final).toEqual(base);
  });

  it('cộng phẳng trước, nhân % sau (flat*level rồi (1+pct*level/100))', () => {
    // khiHuyet: flat 50/level, pct 10/level, level 2 => (100 + 100) * (1 + 20/100) = 240
    const r = computeAttributes(base, [
      { level: 2, effects: [{ attribute: 'khiHuyet', flatPerLevel: 50, pctPerLevel: 10 }] },
    ]);
    expect(r.final.khiHuyet).toBe(240);
    expect(r.final.congVatLy).toBe(20); // không ảnh hưởng
  });

  it('gộp nhiều passive lên cùng thuộc tính', () => {
    const r = computeAttributes(base, [
      { level: 1, effects: [{ attribute: 'phongThu', flatPerLevel: 10, pctPerLevel: 0 }] },
      { level: 1, effects: [{ attribute: 'phongThu', flatPerLevel: 0, pctPerLevel: 50 }] },
    ]);
    // (10 + 10) * (1 + 50/100) = 30
    expect(r.final.phongThu).toBe(30);
  });
});

describe('computeBattlePower', () => {
  it('tổng trọng số làm tròn', () => {
    const bp = computeBattlePower(base, BATTLE_POWER_WEIGHTS);
    // 100*.1 + 80*.1 + 20*1 + 20*1 + 10*.8 + 5*1.2 = 10+8+20+20+8+6 = 72
    expect(bp).toBe(72);
  });
  it('mặc định dùng BATTLE_POWER_WEIGHTS', () => {
    expect(computeBattlePower(ZERO)).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `cd backend && npx vitest run src/domain/attributes/attributes.calc.test.ts`
Expected: FAIL (module chưa tồn tại).

- [ ] **Step 3: Viết `attributes.ts`**

```ts
// 6 thuộc tính cơ bản của nhân vật. Khóa dùng nguyên văn xuyên suốt hệ thống.
export interface AttributeSet {
  khiHuyet: number;   // HP
  chanNguyen: number; // MP
  congVatLy: number;  // công vật lý
  congPhep: number;   // công phép
  phongThu: number;   // phòng thủ
  tocDo: number;      // tốc độ
}

export const ATTRIBUTE_KEYS: (keyof AttributeSet)[] = [
  'khiHuyet', 'chanNguyen', 'congVatLy', 'congPhep', 'phongThu', 'tocDo',
];

// Trọng số quy đổi 6 thuộc tính → Chiến lực. Công/tốc độ nặng hơn HP/MP vì HP/MP
// vốn có giá trị tuyệt đối lớn hơn nhiều. Số khởi tạo — cân bằng, không phải chân lý.
export const BATTLE_POWER_WEIGHTS: AttributeSet = {
  khiHuyet: 0.1, chanNguyen: 0.1, congVatLy: 1, congPhep: 1, phongThu: 0.8, tocDo: 1.2,
};
```

- [ ] **Step 4: Viết `attributes.calc.ts`**

```ts
import { AttributeSet, ATTRIBUTE_KEYS, BATTLE_POWER_WEIGHTS } from './attributes';

// Một hiệu ứng bị động: cộng flatPerLevel*level (phẳng) và pctPerLevel*level (%).
export interface PassiveEffect {
  attribute: keyof AttributeSet;
  flatPerLevel: number;
  pctPerLevel: number;
}

// Công pháp bị động đang sở hữu, rút gọn cho phép tính (chỉ cần effects + level).
export interface OwnedPassive {
  level: number;
  effects: PassiveEffect[];
}

// Tổng hợp thuộc tính cuối từ base (cảnh giới) + các công pháp bị động.
// Quy tắc: final = (base + Σ flat) × (1 + Σ pct/100) — cộng phẳng TRƯỚC, nhân %
// SAU (chuẩn game tu tiên: % là "phần trăm tổng sau khi đã cộng nền + trang bị").
export function computeAttributes(
  base: AttributeSet,
  passives: OwnedPassive[],
): { base: AttributeSet; final: AttributeSet } {
  const flat: AttributeSet = { khiHuyet: 0, chanNguyen: 0, congVatLy: 0, congPhep: 0, phongThu: 0, tocDo: 0 };
  const pct: AttributeSet = { khiHuyet: 0, chanNguyen: 0, congVatLy: 0, congPhep: 0, phongThu: 0, tocDo: 0 };

  for (const p of passives) {
    for (const e of p.effects) {
      flat[e.attribute] += e.flatPerLevel * p.level;
      pct[e.attribute] += e.pctPerLevel * p.level;
    }
  }

  const final: AttributeSet = { ...base };
  for (const k of ATTRIBUTE_KEYS) {
    final[k] = (base[k] + flat[k]) * (1 + pct[k] / 100);
  }
  return { base: { ...base }, final };
}

// Chiến lực = tổng trọng số 6 thuộc tính cuối, làm tròn. Công pháp chủ động KHÔNG
// tham gia (hiệu ứng của chúng là sát thương combat, để dành phase sau).
export function computeBattlePower(
  final: AttributeSet,
  weights: AttributeSet = BATTLE_POWER_WEIGHTS,
): number {
  let sum = 0;
  for (const k of ATTRIBUTE_KEYS) sum += final[k] * weights[k];
  return Math.round(sum);
}
```

- [ ] **Step 5: Chạy test — kỳ vọng PASS**

Run: `cd backend && npx vitest run src/domain/attributes/attributes.calc.test.ts`
Expected: PASS (5 test).

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/domain/attributes
git commit -m "feat(domain): thuộc tính nhân vật + công thức chiến lực"
```

---

## Task 3: Domain — công pháp (types + calc + validate)

**Files:**
- Create: `backend/src/domain/congphap/congphap.ts`
- Create: `backend/src/domain/congphap/congphap.calc.ts`
- Create: `backend/src/domain/congphap/congphap.validate.ts`
- Test: `backend/src/domain/congphap/congphap.calc.test.ts`, `backend/src/domain/congphap/congphap.validate.test.ts`

**Interfaces:**
- Consumes: `PassiveEffect`, `AttributeSet`, `ATTRIBUTE_KEYS` từ `attributes` (Task 2).
- Produces: `CongPhapRecord`, `CongPhapCategory`, `OwnedCongPhapEntry`, `ACTIVE_SLOTS`; `levelUpCost(def, currentLevel)`, `duplicateRefund(def)`; `validateCongPhapDefinition(def)`.

- [ ] **Step 1: Viết `congphap.ts`**

```ts
import { PassiveEffect } from '../attributes/attributes.calc';

export type CongPhapCategory = 'active' | 'passive';

// Số slot công pháp chủ động cố định (spec: 4).
export const ACTIVE_SLOTS = 4;

export interface CongPhapRecord {
  id: string;            // slug ^[a-z0-9-]+$
  name: string;
  glyph: string;
  rarity: number;
  category: CongPhapCategory;
  desc: string;
  active: boolean;       // soft-disable
  maxLevel: number;      // >= 1
  baseCost: number;      // Linh Thạch cho level 1->2 (>= 0)
  costGrowth: number;    // >= 1
  // Bị động: >= 1 effect. Chủ động: null.
  effects: PassiveEffect[] | null;
  // Chủ động: skill power = powerPerLevel * level (> 0). Bị động: null.
  powerPerLevel: number | null;
  chanNguyenCost: number | null;   // chủ động, để dành combat
  dupRefundLinhThach: number | null;
}

// Một công pháp người chơi sở hữu (kèm định nghĩa).
export interface OwnedCongPhapEntry {
  def: CongPhapRecord;
  level: number;
  equippedSlot: number | null;
}
```

- [ ] **Step 2: Viết test calc thất bại**

`congphap.calc.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { levelUpCost, duplicateRefund } from './congphap.calc';
import { CongPhapRecord } from './congphap';

const def: CongPhapRecord = {
  id: 'x', name: 'X', glyph: 'x', rarity: 1, category: 'passive', desc: 'd',
  active: true, maxLevel: 10, baseCost: 100, costGrowth: 1.5,
  effects: [{ attribute: 'khiHuyet', flatPerLevel: 10, pctPerLevel: 0 }],
  powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null,
};

describe('levelUpCost', () => {
  it('level 1->2 = baseCost', () => { expect(levelUpCost(def, 1)).toBe(100); });
  it('lũy tiến theo costGrowth^(level-1), làm tròn', () => {
    expect(levelUpCost(def, 2)).toBe(150);      // 100 * 1.5
    expect(levelUpCost(def, 3)).toBe(225);      // 100 * 1.5^2
  });
});

describe('duplicateRefund', () => {
  it('mặc định = baseCost', () => { expect(duplicateRefund(def)).toBe(100); });
  it('dùng dupRefundLinhThach khi có', () => {
    expect(duplicateRefund({ ...def, dupRefundLinhThach: 42 })).toBe(42);
  });
});
```

- [ ] **Step 3: Chạy — FAIL.** `cd backend && npx vitest run src/domain/congphap/congphap.calc.test.ts` → FAIL.

- [ ] **Step 4: Viết `congphap.calc.ts`**

```ts
import { CongPhapRecord } from './congphap';

// Chi phí Linh Thạch để đi từ currentLevel -> currentLevel+1. Level bắt đầu = 1,
// nên level 1->2 = baseCost * costGrowth^0 = baseCost. Lũy tiến hình học theo level.
export function levelUpCost(def: CongPhapRecord, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel - 1));
}

// Linh Thạch quy đổi khi redeem cấp công pháp đã sở hữu. Mặc định = baseCost.
export function duplicateRefund(def: CongPhapRecord): number {
  return def.dupRefundLinhThach ?? def.baseCost;
}
```

- [ ] **Step 5: Chạy — PASS.** Expected: 4 test PASS.

- [ ] **Step 6: Viết test validate thất bại**

`congphap.validate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateCongPhapDefinition } from './congphap.validate';
import { CongPhapRecord } from './congphap';
import { DomainError } from '../errors';

const passive: CongPhapRecord = {
  id: 'thiet-cot-quyet', name: 'Thiết Cốt', glyph: '铁', rarity: 1, category: 'passive',
  desc: 'd', active: true, maxLevel: 10, baseCost: 100, costGrowth: 1.5,
  effects: [{ attribute: 'khiHuyet', flatPerLevel: 50, pctPerLevel: 0 }],
  powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null,
};
const active: CongPhapRecord = {
  id: 'liet-hoa', name: 'Liệt Hỏa', glyph: '火', rarity: 3, category: 'active',
  desc: 'd', active: true, maxLevel: 10, baseCost: 200, costGrowth: 1.6,
  effects: null, powerPerLevel: 120, chanNguyenCost: 30, dupRefundLinhThach: null,
};

function expectFail(def: CongPhapRecord) {
  expect(() => validateCongPhapDefinition(def)).toThrow(DomainError);
  try { validateCongPhapDefinition(def); } catch (e) {
    expect((e as DomainError).code).toBe('INVALID_CONGPHAP_CONFIG');
  }
}

describe('validateCongPhapDefinition', () => {
  it('chấp nhận passive/active hợp lệ', () => {
    expect(() => validateCongPhapDefinition(passive)).not.toThrow();
    expect(() => validateCongPhapDefinition(active)).not.toThrow();
  });
  it('id sai slug', () => expectFail({ ...passive, id: 'Bad_Id' }));
  it('maxLevel < 1', () => expectFail({ ...passive, maxLevel: 0 }));
  it('costGrowth < 1', () => expectFail({ ...passive, costGrowth: 0.9 }));
  it('baseCost < 0', () => expectFail({ ...passive, baseCost: -1 }));
  it('passive không có effect', () => expectFail({ ...passive, effects: [] }));
  it('passive effect attribute lạ', () => expectFail({ ...passive, effects: [{ attribute: 'xxx' as never, flatPerLevel: 1, pctPerLevel: 0 }] }));
  it('passive lại có powerPerLevel', () => expectFail({ ...passive, powerPerLevel: 5 }));
  it('active không powerPerLevel > 0', () => expectFail({ ...active, powerPerLevel: 0 }));
  it('active lại có effects', () => expectFail({ ...active, effects: passive.effects }));
});
```

- [ ] **Step 7: Chạy — FAIL.**

- [ ] **Step 8: Viết `congphap.validate.ts`**

```ts
import { CongPhapRecord } from './congphap';
import { ATTRIBUTE_KEYS } from '../attributes/attributes';
import { DomainError } from '../errors';

const SLUG = /^[a-z0-9-]+$/;

function fail(message: string): never {
  throw new DomainError('INVALID_CONGPHAP_CONFIG', message);
}

// Bất biến nghiệp vụ zod (presentation) không diễn đạt được vì phụ thuộc category.
// Nguồn duy nhất định nghĩa "một công pháp hợp lệ".
export function validateCongPhapDefinition(def: CongPhapRecord): void {
  if (!SLUG.test(def.id)) fail('id must match ^[a-z0-9-]+$');
  if (def.name.trim() === '') fail('name must not be empty');
  if (def.glyph.trim() === '') fail('glyph must not be empty');
  if (def.desc.trim() === '') fail('desc must not be empty');
  if (!Number.isFinite(def.rarity)) fail('rarity must be a number');
  if (!Number.isInteger(def.maxLevel) || def.maxLevel < 1) fail('maxLevel must be an integer >= 1');
  if (!Number.isInteger(def.baseCost) || def.baseCost < 0) fail('baseCost must be an integer >= 0');
  if (!(def.costGrowth >= 1)) fail('costGrowth must be >= 1');
  if (def.dupRefundLinhThach !== null && (!Number.isInteger(def.dupRefundLinhThach) || def.dupRefundLinhThach < 0)) {
    fail('dupRefundLinhThach must be null or an integer >= 0');
  }

  if (def.category === 'passive') {
    if (def.powerPerLevel !== null) fail('passive công pháp must not set powerPerLevel');
    if (def.chanNguyenCost !== null) fail('passive công pháp must not set chanNguyenCost');
    if (!def.effects || def.effects.length === 0) fail('passive công pháp requires at least one effect');
    for (const e of def.effects) {
      if (!ATTRIBUTE_KEYS.includes(e.attribute)) fail(`unknown attribute "${e.attribute}"`);
      if (!Number.isFinite(e.flatPerLevel) || !Number.isFinite(e.pctPerLevel)) fail('effect values must be finite numbers');
    }
  } else if (def.category === 'active') {
    if (def.effects !== null) fail('active công pháp must not set effects');
    if (!(def.powerPerLevel !== null && def.powerPerLevel > 0)) fail('active công pháp requires powerPerLevel > 0');
    if (def.chanNguyenCost !== null && !(def.chanNguyenCost >= 0)) fail('chanNguyenCost must be null or >= 0');
  } else {
    fail(`unknown category "${def.category}"`);
  }
}
```

- [ ] **Step 9: Chạy — PASS.** Expected: tất cả test validate + calc PASS.

- [ ] **Step 10: Commit**

```bash
cd backend && git add src/domain/congphap
git commit -m "feat(domain): công pháp types, chi phí nâng cấp, validate định nghĩa"
```

---

## Task 4: Domain — base thuộc tính trong realm config

**Files:**
- Modify: `backend/src/domain/config/realms.ts`
- Test: `backend/src/domain/config/realms.attributes.test.ts`

**Interfaces:**
- Consumes: `AttributeSet` (Task 2).
- Produces: 6 trường base trên `SubStageConfig`/`SubStageRow`; `deriveBaseAttributes(cultivationRate): AttributeSet`; `RealmConfigSet.baseAttributes(realmMajor, realmSub): AttributeSet`; `SEED_REALMS` giờ chứa base fields; `flattenRealms`/`realmConfigSetFromRows` mang theo base.

- [ ] **Step 1: Viết test thất bại**

`realms.attributes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defaultRealmConfigSet, deriveBaseAttributes, flattenRealms, realmConfigSetFromRows, SEED_REALMS } from './realms';

describe('deriveBaseAttributes', () => {
  it('tỉ lệ theo cultivationRate, làm tròn', () => {
    const a = deriveBaseAttributes(1);
    expect(a.khiHuyet).toBe(40);
    expect(a.congVatLy).toBe(6);
    expect(a.tocDo).toBe(2);
  });
});

describe('RealmConfigSet.baseAttributes', () => {
  it('trả 6 thuộc tính cho stage hợp lệ', () => {
    const cfg = defaultRealmConfigSet();
    const a = cfg.baseAttributes(0, 0);
    expect(a.khiHuyet).toBeGreaterThan(0);
    expect(Object.keys(a).sort()).toEqual(['chanNguyen','congPhep','congVatLy','khiHuyet','phongThu','tocDo']);
  });
});

describe('flatten/fromRows round-trip mang base', () => {
  it('giữ nguyên base khi phẳng rồi dựng lại', () => {
    const rows = flattenRealms(SEED_REALMS);
    expect(rows[0].baseKhiHuyet).toBeGreaterThan(0);
    const cfg = realmConfigSetFromRows(rows);
    expect(cfg.baseAttributes(0, 0).khiHuyet).toBe(rows[0].baseKhiHuyet);
  });
});
```

- [ ] **Step 2: Chạy — FAIL.**

- [ ] **Step 3: Sửa `realms.ts` — thêm base vào types**

Thêm import đầu file:
```ts
import { AttributeSet } from '../attributes/attributes';
```
Thêm 6 trường vào `interface SubStageConfig` (sau `punishmentSeconds`):
```ts
  baseKhiHuyet: number;
  baseChanNguyen: number;
  baseCongVatLy: number;
  baseCongPhep: number;
  basePhongThu: number;
  baseTocDo: number;
```
Thêm 6 trường tương tự vào `interface SubStageRow` (sau `punishmentSeconds`).

- [ ] **Step 4: Thêm `deriveBaseAttributes` + augment `SEED_REALMS`**

Trên `SEED_REALMS` hiện tại: **đổi tên literal cũ thành `SEED_REALMS_CORE`** (giữ nguyên 12 realm × 5 sub, KHÔNG có base fields), rồi thêm generator + export mới:
```ts
// Hệ số suy ra thuộc tính nền từ cultivationRate của sub-stage. cultivationRate
// đã tăng dần theo cảnh giới nên base cũng tăng theo — số cân bằng khởi tạo,
// admin tinh chỉnh từng dòng qua /admin/realms.
const BASE_ATTR_FACTORS: AttributeSet = {
  khiHuyet: 40, chanNguyen: 30, congVatLy: 6, congPhep: 6, phongThu: 4, tocDo: 2,
};

export function deriveBaseAttributes(cultivationRate: number): AttributeSet {
  return {
    khiHuyet: Math.round(cultivationRate * BASE_ATTR_FACTORS.khiHuyet),
    chanNguyen: Math.round(cultivationRate * BASE_ATTR_FACTORS.chanNguyen),
    congVatLy: Math.round(cultivationRate * BASE_ATTR_FACTORS.congVatLy),
    congPhep: Math.round(cultivationRate * BASE_ATTR_FACTORS.congPhep),
    phongThu: Math.round(cultivationRate * BASE_ATTR_FACTORS.phongThu),
    tocDo: Math.round(cultivationRate * BASE_ATTR_FACTORS.tocDo),
  };
}

// SEED_REALMS = core balance + base thuộc tính suy ra. Giữ literal core gọn,
// base sinh tự động để không phải tay-tác 360 con số.
export const SEED_REALMS: RealmConfig[] = SEED_REALMS_CORE.map((r) => ({
  name: r.name,
  subStages: r.subStages.map((s) => ({ ...s, ...deriveBaseAttributes(s.cultivationRate) })),
}));
```
> LƯU Ý: literal `SEED_REALMS_CORE` không có 6 trường base nên TypeScript sẽ báo thiếu field khi gán `RealmConfig[]`. Khai báo `SEED_REALMS_CORE` với kiểu nới lỏng: `const SEED_REALMS_CORE: { name: string; subStages: Omit<SubStageConfig, 'baseKhiHuyet'|'baseChanNguyen'|'baseCongVatLy'|'baseCongPhep'|'basePhongThu'|'baseTocDo'>[] }[] = [ ...literal cũ... ];`

- [ ] **Step 5: Thêm `baseAttributes` vào `RealmConfigSet`, cập nhật flatten/fromRows**

Trong `class RealmConfigSet`, thêm method:
```ts
  baseAttributes(realmMajor: number, realmSub: number): AttributeSet {
    const s = this.getStage(realmMajor, realmSub);
    return {
      khiHuyet: s.baseKhiHuyet, chanNguyen: s.baseChanNguyen, congVatLy: s.baseCongVatLy,
      congPhep: s.baseCongPhep, phongThu: s.basePhongThu, tocDo: s.baseTocDo,
    };
  }
```
Trong `realmConfigSetFromRows`, thêm 6 base vào object sub-stage dựng lại:
```ts
      baseKhiHuyet: r.baseKhiHuyet, baseChanNguyen: r.baseChanNguyen, baseCongVatLy: r.baseCongVatLy,
      baseCongPhep: r.baseCongPhep, basePhongThu: r.basePhongThu, baseTocDo: r.baseTocDo,
```
Trong `flattenRealms`, thêm 6 base vào row push:
```ts
        baseKhiHuyet: s.baseKhiHuyet, baseChanNguyen: s.baseChanNguyen, baseCongVatLy: s.baseCongVatLy,
        baseCongPhep: s.baseCongPhep, basePhongThu: s.basePhongThu, baseTocDo: s.baseTocDo,
```

- [ ] **Step 6: Chạy — PASS.** `cd backend && npx vitest run src/domain/config/realms.attributes.test.ts` → PASS. Rồi chạy full domain: `npx vitest run src/domain` → xanh.

- [ ] **Step 7: Reseed để base vào DB**

Run: `cd backend && npm run db:seed` (giờ 60 dòng RealmStage có base > 0).

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/domain/config/realms.ts src/domain/config/realms.attributes.test.ts
git commit -m "feat(domain): thuộc tính nền theo cảnh giới trong realm config"
```

---

## Task 5: Domain ports & entity (Character.linhThach + repos công pháp)

**Files:**
- Modify: `backend/src/domain/entities/Character.ts`
- Modify: `backend/src/domain/ports/CharacterRepository.ts`
- Create: `backend/src/domain/ports/CongPhapRepository.ts`
- Create: `backend/src/domain/ports/OwnedCongPhapRepository.ts`

**Interfaces:**
- Consumes: `CongPhapRecord`, `OwnedCongPhapEntry` (Task 3), `OwnedPassive` (Task 2).
- Produces: `CharacterRecord.linhThach`, `CharacterUpdateInput.linhThach`, `CharacterRepository.spendLinhThach`/`addLinhThach`; port `CongPhapRepository`, `OwnedCongPhapRepository` (chữ ký method dưới đây là hợp đồng các task sau dựa vào).

- [ ] **Step 1: Thêm `linhThach` vào entity + update input**

`Character.ts`: thêm `linhThach: number;` (sau `linhKhi`).
`CharacterRepository.ts`: thêm `linhThach: number;` vào `interface CharacterUpdateInput` (sau `linhKhi`), và thêm 2 method vào `interface CharacterRepository`:
```ts
  /** Atomic: trừ `amount` Linh Thạch guard trên số dư đủ (linhThach >= amount).
   *  Trả false nếu không đủ hoặc không có character — không bao giờ để âm. */
  spendLinhThach(characterId: string, amount: number): Promise<boolean>;
  /** Cộng `amount` Linh Thạch (grant / hoàn khi saga bù). Không guard. */
  addLinhThach(characterId: string, amount: number): Promise<void>;
```

- [ ] **Step 2: Viết `CongPhapRepository.ts`**

```ts
import { CongPhapRecord } from '../congphap/congphap';

export interface CongPhapRepository {
  findById(id: string): Promise<CongPhapRecord | null>;
  // Chỉ công pháp active — catalog cho người chơi.
  listActive(): Promise<CongPhapRecord[]>;
  // Toàn bộ kể cả inactive — admin.
  listAll(): Promise<CongPhapRecord[]>;
  create(def: CongPhapRecord): Promise<void>;
  // Full-row overwrite theo id; false nếu không có row.
  update(def: CongPhapRecord): Promise<boolean>;
}
```

- [ ] **Step 3: Viết `OwnedCongPhapRepository.ts`**

```ts
import { OwnedCongPhapEntry } from '../congphap/congphap';

export interface OwnedCongPhapRepository {
  // Toàn bộ công pháp user sở hữu (kèm định nghĩa, kể cả def inactive — caller lọc).
  listByUser(userId: string): Promise<OwnedCongPhapEntry[]>;
  getOne(userId: string, congPhapId: string): Promise<OwnedCongPhapEntry | null>;
  // Tạo bản sở hữu level 1 nếu chưa có. false nếu đã sở hữu (redeem trùng dùng cái này).
  grant(userId: string, congPhapId: string): Promise<boolean>;
  // Optimistic guard: tăng level lên +1 chỉ khi level hiện tại = expectedLevel.
  levelUpGuarded(userId: string, congPhapId: string, expectedLevel: number): Promise<boolean>;
  // Gỡ bất kỳ công pháp nào đang ở slot này (đặt equippedSlot=null). Cho phép thay slot.
  clearSlot(userId: string, slot: number): Promise<void>;
  // Đặt equippedSlot cho một công pháp sở hữu. false nếu không sở hữu.
  setSlot(userId: string, congPhapId: string, slot: number): Promise<boolean>;
  // equippedSlot=null. false nếu không sở hữu.
  unsetSlot(userId: string, congPhapId: string): Promise<boolean>;
}
```

- [ ] **Step 4: Kiểm tra biên dịch**

Run: `cd backend && npx tsc --noEmit`
Expected: **sẽ FAIL** ở các file dùng `CharacterUpdateInput` (ConsumePill, GetCultivationState, AttemptBreakthrough) vì thiếu `linhThach`, và `PrismaCharacterRepository` chưa có 2 method mới + `linhThach`. Đây là kỳ vọng — Task 6 & 7 sửa. Ghi nhận danh sách lỗi để Task 6/7 xử lý. (Nếu muốn xanh ngay: có thể để Step 5 commit rồi sang Task 6.)

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/domain/entities/Character.ts src/domain/ports
git commit -m "feat(domain): port công pháp + Linh Thạch trên Character"
```

---

## Task 6: Infrastructure — Prisma repositories

**Files:**
- Create: `backend/src/infrastructure/repositories/PrismaCongPhapRepository.ts`
- Create: `backend/src/infrastructure/repositories/PrismaOwnedCongPhapRepository.ts`
- Modify: `backend/src/infrastructure/repositories/PrismaCharacterRepository.ts`
- Modify: `backend/src/infrastructure/repositories/PrismaRealmConfigRepository.ts`
- Test: `backend/src/infrastructure/repositories/congphap.repo.integration.test.ts`

**Interfaces:**
- Consumes: các port Task 5, model Prisma Task 1.
- Produces: implementation cụ thể; `PrismaCharacterRepository` trả `linhThach` trong `CharacterRecord` + method spend/add.

> **context7:** trước khi viết, `npx ctx7@latest docs /prisma/docs "updateMany conditional decrement and Json field typing"` (đối chiếu version Prisma trong package.json).

- [ ] **Step 1: Viết `PrismaCongPhapRepository.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import { CongPhapRepository } from '../../domain/ports/CongPhapRepository';
import { CongPhapRecord, CongPhapCategory } from '../../domain/congphap/congphap';
import { PassiveEffect } from '../../domain/attributes/attributes.calc';

// Prisma lưu category là string, effects là Json — narrow lại về domain ở biên.
function toRecord(row: {
  id: string; name: string; glyph: string; rarity: number; category: string; desc: string;
  active: boolean; maxLevel: number; baseCost: number; costGrowth: number;
  effects: unknown; powerPerLevel: number | null; chanNguyenCost: number | null;
  dupRefundLinhThach: number | null;
}): CongPhapRecord {
  return {
    ...row,
    category: row.category as CongPhapCategory,
    effects: (row.effects as PassiveEffect[] | null) ?? null,
  };
}

// Chuẩn bị data cho Prisma: effects null -> Prisma.JsonNull.
function toData(def: CongPhapRecord) {
  const { effects, ...rest } = def;
  return { ...rest, effects: effects === null ? undefined : (effects as unknown as object) };
}

export class PrismaCongPhapRepository implements CongPhapRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<CongPhapRecord | null> {
    const row = await this.client.congPhap.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }
  async listActive(): Promise<CongPhapRecord[]> {
    const rows = await this.client.congPhap.findMany({ where: { active: true }, orderBy: [{ rarity: 'asc' }, { id: 'asc' }] });
    return rows.map(toRecord);
  }
  async listAll(): Promise<CongPhapRecord[]> {
    const rows = await this.client.congPhap.findMany({ orderBy: [{ rarity: 'asc' }, { id: 'asc' }] });
    return rows.map(toRecord);
  }
  async create(def: CongPhapRecord): Promise<void> {
    await this.client.congPhap.create({ data: toData(def) });
  }
  async update(def: CongPhapRecord): Promise<boolean> {
    const { id, ...data } = toData(def);
    const result = await this.client.congPhap.updateMany({ where: { id: def.id }, data });
    return result.count === 1;
  }
}
```
> Nếu `effects` cần "set null" khi update công pháp active (chuyển passive→active), dùng `Prisma.JsonNull`. Kiểm tra bằng test Step 4.

- [ ] **Step 2: Viết `PrismaOwnedCongPhapRepository.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import { OwnedCongPhapRepository } from '../../domain/ports/OwnedCongPhapRepository';
import { OwnedCongPhapEntry, CongPhapCategory } from '../../domain/congphap/congphap';
import { PassiveEffect } from '../../domain/attributes/attributes.calc';

export class PrismaOwnedCongPhapRepository implements OwnedCongPhapRepository {
  constructor(private readonly client: PrismaClient) {}

  async listByUser(userId: string): Promise<OwnedCongPhapEntry[]> {
    const rows = await this.client.ownedCongPhap.findMany({ where: { userId }, include: { congPhap: true } });
    return rows.map((r) => ({
      def: { ...r.congPhap, category: r.congPhap.category as CongPhapCategory, effects: (r.congPhap.effects as PassiveEffect[] | null) ?? null },
      level: r.level,
      equippedSlot: r.equippedSlot,
    }));
  }
  async getOne(userId: string, congPhapId: string): Promise<OwnedCongPhapEntry | null> {
    const r = await this.client.ownedCongPhap.findUnique({ where: { userId_congPhapId: { userId, congPhapId } }, include: { congPhap: true } });
    if (!r) return null;
    return {
      def: { ...r.congPhap, category: r.congPhap.category as CongPhapCategory, effects: (r.congPhap.effects as PassiveEffect[] | null) ?? null },
      level: r.level, equippedSlot: r.equippedSlot,
    };
  }
  async grant(userId: string, congPhapId: string): Promise<boolean> {
    // createMany skipDuplicates: 0 rows tạo => đã sở hữu.
    const res = await this.client.ownedCongPhap.createMany({ data: [{ userId, congPhapId }], skipDuplicates: true });
    return res.count === 1;
  }
  async levelUpGuarded(userId: string, congPhapId: string, expectedLevel: number): Promise<boolean> {
    // Optimistic: chỉ +1 khi level vẫn = expectedLevel (chống double level-up song song).
    const res = await this.client.ownedCongPhap.updateMany({
      where: { userId, congPhapId, level: expectedLevel },
      data: { level: { increment: 1 } },
    });
    return res.count === 1;
  }
  async clearSlot(userId: string, slot: number): Promise<void> {
    await this.client.ownedCongPhap.updateMany({ where: { userId, equippedSlot: slot }, data: { equippedSlot: null } });
  }
  async setSlot(userId: string, congPhapId: string, slot: number): Promise<boolean> {
    const res = await this.client.ownedCongPhap.updateMany({ where: { userId, congPhapId }, data: { equippedSlot: slot } });
    return res.count === 1;
  }
  async unsetSlot(userId: string, congPhapId: string): Promise<boolean> {
    const res = await this.client.ownedCongPhap.updateMany({ where: { userId, congPhapId }, data: { equippedSlot: null } });
    return res.count === 1;
  }
}
```

- [ ] **Step 3: Sửa `PrismaCharacterRepository.ts`**

Trong `toCharacterRecord` (hàm map) thêm `linhThach: row.linhThach`. Trong `updateWithConcurrencyGuard`'s `data`, thêm `linhThach: data.linhThach`. Thêm 2 method:
```ts
  async spendLinhThach(characterId: string, amount: number): Promise<boolean> {
    // Row-level atomic guard: chỉ trừ khi số dư >= amount => không bao giờ âm,
    // hai lần nâng cấp song song không cùng tiêu quá số dư.
    const res = await this.client.character.updateMany({
      where: { id: characterId, linhThach: { gte: amount } },
      data: { linhThach: { decrement: amount } },
    });
    return res.count === 1;
  }
  async addLinhThach(characterId: string, amount: number): Promise<void> {
    await this.client.character.updateMany({ where: { id: characterId }, data: { linhThach: { increment: amount } } });
  }
```
> Nếu file dùng `include`/`select` tường minh, đảm bảo `linhThach` được đọc. Đọc file hiện tại trước khi sửa.

- [ ] **Step 4: Sửa `PrismaRealmConfigRepository.ts`** — map 6 cột base khi đọc/ghi

Đọc file hiện tại; trong hàm map row→`SubStageRow` thêm 6 field base; trong `replaceAll` (createMany) đảm bảo 6 field base nằm trong data (do `flattenRealms` đã sinh — chỉ cần không bị `select`/`omit` loại). Nếu repo map thủ công, thêm 6 dòng tương ứng.

- [ ] **Step 5: Viết integration test**

`congphap.repo.integration.test.ts` (theo mẫu integration test hiện có — tạo user+character, seed 1 CongPhap):
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaCongPhapRepository } from './PrismaCongPhapRepository';
import { PrismaOwnedCongPhapRepository } from './PrismaOwnedCongPhapRepository';
import { PrismaCharacterRepository } from './PrismaCharacterRepository';

const prisma = new PrismaClient();
const congphap = new PrismaCongPhapRepository(prisma);
const owned = new PrismaOwnedCongPhapRepository(prisma);
const characters = new PrismaCharacterRepository(prisma);

let userId = '';
let charId = '';

beforeAll(async () => {
  await prisma.congPhap.upsert({
    where: { id: 'test-passive' },
    create: { id: 'test-passive', name: 'T', glyph: 't', rarity: 1, category: 'passive', desc: 'd', active: true, maxLevel: 5, baseCost: 100, costGrowth: 1.5, effects: [{ attribute: 'khiHuyet', flatPerLevel: 10, pctPerLevel: 0 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null },
    update: {},
  });
  const user = await prisma.user.create({ data: { username: `cp_${Date.now()}`, passwordHash: 'x' } });
  userId = user.id;
  const c = await prisma.character.create({ data: { userId, linhThach: 500 } });
  charId = c.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('OwnedCongPhap + Linh Thạch', () => {
  it('grant tạo bản sở hữu, grant lần 2 trả false', async () => {
    expect(await owned.grant(userId, 'test-passive')).toBe(true);
    expect(await owned.grant(userId, 'test-passive')).toBe(false);
  });
  it('effects round-trip đúng JSON', async () => {
    const one = await owned.getOne(userId, 'test-passive');
    expect(one?.def.effects?.[0].attribute).toBe('khiHuyet');
  });
  it('levelUpGuarded chỉ +1 khi level khớp', async () => {
    expect(await owned.levelUpGuarded(userId, 'test-passive', 1)).toBe(true);
    expect(await owned.levelUpGuarded(userId, 'test-passive', 1)).toBe(false); // giờ level=2
  });
  it('spendLinhThach guard số dư', async () => {
    expect(await characters.spendLinhThach(charId, 400)).toBe(true);   // 500->100
    expect(await characters.spendLinhThach(charId, 400)).toBe(false);  // không đủ
    await characters.addLinhThach(charId, 400);                        // 100->500
  });
  it('setSlot/clearSlot/unsetSlot', async () => {
    expect(await owned.setSlot(userId, 'test-passive', 0)).toBe(true);
    await owned.clearSlot(userId, 0);
    expect((await owned.getOne(userId, 'test-passive'))?.equippedSlot).toBeNull();
  });
});
```

- [ ] **Step 6: Chạy integration test**

Đảm bảo Postgres chạy (`docker compose up -d`). Run: `cd backend && npx vitest run src/infrastructure/repositories/congphap.repo.integration.test.ts`
Expected: PASS.

- [ ] **Step 7: `tsc` xanh phần infra/domain (application vẫn có thể đỏ tới Task 7).** Commit:

```bash
cd backend && git add src/infrastructure/repositories
git commit -m "feat(infra): Prisma repo công pháp + Linh Thạch spend/add + base attrs realm"
```

---

## Task 7: Application — attributeState + mở rộng GetCultivationState (và 2 use case dùng chung output)

**Files:**
- Create: `backend/src/application/attributeState.ts`
- Modify: `backend/src/application/GetCultivationStateUseCase.ts`
- Modify: `backend/src/application/ConsumePillUseCase.ts`
- Modify: `backend/src/application/AttemptBreakthroughUseCase.ts`
- Test: `backend/src/application/attributeState.test.ts`

**Interfaces:**
- Consumes: `RealmConfigSet.baseAttributes`, `computeAttributes`, `computeBattlePower`, `OwnedCongPhapRepository.listByUser`, `CharacterRecord.linhThach`.
- Produces: `buildAttributeState(config, realmMajor, realmSub, owned) → { attributes: { base, final }, battlePower }`; `CultivationStateOutput` thêm `attributes`, `battlePower`, `linhThach`.

- [ ] **Step 1: Viết test thất bại cho `buildAttributeState`**

`attributeState.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildAttributeState } from './attributeState';
import { defaultRealmConfigSet } from '../domain/config/realms';
import { OwnedCongPhapEntry } from '../domain/congphap/congphap';

const cfg = defaultRealmConfigSet();

const passiveOwned: OwnedCongPhapEntry = {
  def: { id: 'p', name: 'P', glyph: 'p', rarity: 1, category: 'passive', desc: 'd', active: true, maxLevel: 10, baseCost: 100, costGrowth: 1.5, effects: [{ attribute: 'khiHuyet', flatPerLevel: 100, pctPerLevel: 0 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null },
  level: 2, equippedSlot: null,
};
const activeOwned: OwnedCongPhapEntry = {
  def: { id: 'a', name: 'A', glyph: 'a', rarity: 3, category: 'active', desc: 'd', active: true, maxLevel: 10, baseCost: 200, costGrowth: 1.6, effects: null, powerPerLevel: 120, chanNguyenCost: 30, dupRefundLinhThach: null },
  level: 5, equippedSlot: 0,
};

describe('buildAttributeState', () => {
  it('chỉ passive active cộng thuộc tính; active bị bỏ qua', () => {
    const base = cfg.baseAttributes(0, 0);
    const s = buildAttributeState(cfg, 0, 0, [passiveOwned, activeOwned]);
    expect(s.attributes.final.khiHuyet).toBe(base.khiHuyet + 200); // 100/level * 2
    expect(s.attributes.base.khiHuyet).toBe(base.khiHuyet);
    expect(s.battlePower).toBeGreaterThan(0);
  });
  it('bỏ qua passive def.active=false', () => {
    const base = cfg.baseAttributes(0, 0);
    const disabled = { ...passiveOwned, def: { ...passiveOwned.def, active: false } };
    const s = buildAttributeState(cfg, 0, 0, [disabled]);
    expect(s.attributes.final.khiHuyet).toBe(base.khiHuyet);
  });
});
```

- [ ] **Step 2: Chạy — FAIL.**

- [ ] **Step 3: Viết `attributeState.ts`**

```ts
import { AttributeSet } from '../domain/attributes/attributes';
import { computeAttributes, computeBattlePower } from '../domain/attributes/attributes.calc';
import { RealmConfigSet } from '../domain/config/realms';
import { OwnedCongPhapEntry } from '../domain/congphap/congphap';

export interface AttributeStateOutput {
  attributes: { base: AttributeSet; final: AttributeSet };
  battlePower: number;
}

// Dựng thuộc tính hiển thị từ base cảnh giới + công pháp bị động đang sở hữu.
// Chỉ passive VÀ def.active mới đóng góp; công pháp chủ động bị bỏ qua (hiệu ứng
// của chúng để dành phase combat). Dùng chung bởi cả 3 use case trả cultivation state.
export function buildAttributeState(
  config: RealmConfigSet,
  realmMajor: number,
  realmSub: number,
  owned: OwnedCongPhapEntry[],
): AttributeStateOutput {
  const base = config.baseAttributes(realmMajor, realmSub);
  const passives = owned
    .filter((o) => o.def.category === 'passive' && o.def.active && o.def.effects)
    .map((o) => ({ level: o.level, effects: o.def.effects! }));
  const { base: b, final } = computeAttributes(base, passives);
  return { attributes: { base: b, final }, battlePower: computeBattlePower(final) };
}
```

- [ ] **Step 4: Chạy — PASS.**

- [ ] **Step 5: Mở rộng `CultivationStateOutput` + `GetCultivationStateUseCase`**

Trong `GetCultivationStateUseCase.ts`, thêm import:
```ts
import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { AttributeSet } from '../domain/attributes/attributes';
import { buildAttributeState } from './attributeState';
```
Thêm vào `interface CultivationStateOutput`:
```ts
  linhThach: number;
  attributes: { base: AttributeSet; final: AttributeSet };
  battlePower: number;
```
Sửa constructor để nhận repo owned:
```ts
  constructor(
    private readonly characters: CharacterRepository,
    private readonly realmConfig: RealmConfigSource,
    private readonly ownedCongPhap: OwnedCongPhapRepository,
  ) {}
```
Trong self-heal `updateWithConcurrencyGuard(...)` thêm `linhThach: character.linhThach,` vào data. Trước `return`, thêm:
```ts
    const owned = await this.ownedCongPhap.listByUser(userId);
    const attrState = buildAttributeState(config, character.realmMajor, character.realmSub, owned);
```
Và thêm vào object return:
```ts
      linhThach: character.linhThach,
      attributes: attrState.attributes,
      battlePower: attrState.battlePower,
```

- [ ] **Step 6: Sửa `ConsumePillUseCase` & `AttemptBreakthroughUseCase`**

Cả hai trả `CultivationStateOutput`, nên phải điền field mới. Thêm ctor param `private readonly ownedCongPhap: OwnedCongPhapRepository` + import `buildAttributeState`, `OwnedCongPhapRepository`. Trong `updateWithConcurrencyGuard(...)` data thêm `linhThach: character.linhThach,`. Trước return cuối:
```ts
    const owned = await this.ownedCongPhap.listByUser(userId);
    const attrState = buildAttributeState(config, updated.realmMajor, updated.realmSub, owned);
```
Thêm vào object return: `linhThach: updated.linhThach, attributes: attrState.attributes, battlePower: attrState.battlePower,`.
> `AttemptBreakthroughUseCase` cần đọc file để chèn đúng chỗ (nó cũng build `CultivationStateOutput`); đảm bảo `linhThach` được carry trong mọi `updateWithConcurrencyGuard` data của nó.

- [ ] **Step 7: `tsc` + full unit**

Run: `cd backend && npx tsc --noEmit` (giờ phải xanh trừ `app.ts` — Task 11 sửa wiring). Nếu `app.ts` đỏ vì ctor đổi, tạm thời chấp nhận; sẽ sửa ở Task 11. Chạy `npx vitest run src/application/attributeState.test.ts src/domain` → PASS.

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/application/attributeState.ts src/application/attributeState.test.ts src/application/GetCultivationStateUseCase.ts src/application/ConsumePillUseCase.ts src/application/AttemptBreakthroughUseCase.ts
git commit -m "feat(app): thuộc tính + chiến lực + Linh Thạch trong cultivation state"
```

---

## Task 8: Application — use case công pháp người chơi

**Files:**
- Create: `backend/src/application/ListCongPhapUseCase.ts`, `EquipCongPhapUseCase.ts`, `UnequipCongPhapUseCase.ts`, `LevelUpCongPhapUseCase.ts`
- Test: `backend/src/application/congphap.usecases.test.ts` (dùng fake repo in-memory)

**Interfaces:**
- Consumes: `CongPhapRepository`, `OwnedCongPhapRepository`, `CharacterRepository`, `levelUpCost`, `ACTIVE_SLOTS`.
- Produces:
  - `ListCongPhapUseCase.execute(userId) → { owned: OwnedCongPhapEntry[]; catalog: CongPhapRecord[] }`
  - `EquipCongPhapUseCase.execute(userId, congPhapId, slot) → void`
  - `UnequipCongPhapUseCase.execute(userId, congPhapId) → void`
  - `LevelUpCongPhapUseCase.execute(userId, congPhapId) → { level: number; linhThach: number }`

- [ ] **Step 1: Viết test thất bại (fake repos)**

`congphap.usecases.test.ts` — dựng fake in-memory cho 3 repo, kiểm mọi nhánh:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { EquipCongPhapUseCase } from './EquipCongPhapUseCase';
import { UnequipCongPhapUseCase } from './UnequipCongPhapUseCase';
import { LevelUpCongPhapUseCase } from './LevelUpCongPhapUseCase';
import { ListCongPhapUseCase } from './ListCongPhapUseCase';
import { CongPhapRecord, OwnedCongPhapEntry } from '../domain/congphap/congphap';
import { DomainError } from '../domain/errors';

const passive: CongPhapRecord = { id: 'p', name: 'P', glyph: 'p', rarity: 1, category: 'passive', desc: 'd', active: true, maxLevel: 3, baseCost: 100, costGrowth: 1.5, effects: [{ attribute: 'khiHuyet', flatPerLevel: 10, pctPerLevel: 0 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null };
const active: CongPhapRecord = { id: 'a', name: 'A', glyph: 'a', rarity: 2, category: 'active', desc: 'd', active: true, maxLevel: 3, baseCost: 100, costGrowth: 1.5, effects: null, powerPerLevel: 100, chanNguyenCost: 10, dupRefundLinhThach: null };

function fakes(opts: { owned?: OwnedCongPhapEntry[]; linhThach?: number } = {}) {
  const defs = new Map([['p', passive], ['a', active]]);
  const owned = new Map<string, OwnedCongPhapEntry>();
  for (const o of opts.owned ?? []) owned.set(o.def.id, { ...o });
  let linhThach = opts.linhThach ?? 0;

  const congphapRepo = {
    findById: async (id: string) => defs.get(id) ?? null,
    listActive: async () => [...defs.values()].filter((d) => d.active),
    listAll: async () => [...defs.values()],
    create: async () => {}, update: async () => true,
  };
  const ownedRepo = {
    listByUser: async () => [...owned.values()],
    getOne: async (_u: string, id: string) => owned.get(id) ?? null,
    grant: async (_u: string, id: string) => { if (owned.has(id)) return false; owned.set(id, { def: defs.get(id)!, level: 1, equippedSlot: null }); return true; },
    levelUpGuarded: async (_u: string, id: string, exp: number) => { const o = owned.get(id); if (!o || o.level !== exp) return false; o.level += 1; return true; },
    clearSlot: async (_u: string, slot: number) => { for (const o of owned.values()) if (o.equippedSlot === slot) o.equippedSlot = null; },
    setSlot: async (_u: string, id: string, slot: number) => { const o = owned.get(id); if (!o) return false; o.equippedSlot = slot; return true; },
    unsetSlot: async (_u: string, id: string) => { const o = owned.get(id); if (!o) return false; o.equippedSlot = null; return true; },
  };
  const charRepo = {
    findByUserId: async () => ({ id: 'c', userId: 'u', linhThach } as never),
    updateWithConcurrencyGuard: async () => ({} as never),
    spendLinhThach: async (_id: string, amt: number) => { if (linhThach < amt) return false; linhThach -= amt; return true; },
    addLinhThach: async (_id: string, amt: number) => { linhThach += amt; },
  };
  return { congphapRepo, ownedRepo, charRepo, get linhThach() { return linhThach; } };
}

describe('EquipCongPhapUseCase', () => {
  it('trang bị active vào slot hợp lệ', async () => {
    const f = fakes({ owned: [{ def: active, level: 1, equippedSlot: null }] });
    await new EquipCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never).execute('u', 'a', 0);
    expect((await f.ownedRepo.getOne('u', 'a'))!.equippedSlot).toBe(0);
  });
  it('từ chối slot ngoài [0,4)', async () => {
    const f = fakes({ owned: [{ def: active, level: 1, equippedSlot: null }] });
    await expect(new EquipCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never).execute('u', 'a', 4))
      .rejects.toMatchObject({ code: 'CONGPHAP_SLOT_INVALID' });
  });
  it('từ chối trang bị passive', async () => {
    const f = fakes({ owned: [{ def: passive, level: 1, equippedSlot: null }] });
    await expect(new EquipCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never).execute('u', 'p', 0))
      .rejects.toMatchObject({ code: 'CONGPHAP_NOT_EQUIPPABLE' });
  });
  it('không sở hữu -> CONGPHAP_NOT_OWNED', async () => {
    const f = fakes();
    await expect(new EquipCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never).execute('u', 'a', 0))
      .rejects.toMatchObject({ code: 'CONGPHAP_NOT_OWNED' });
  });
});

describe('LevelUpCongPhapUseCase', () => {
  it('trừ Linh Thạch = levelUpCost và +1 level', async () => {
    const f = fakes({ owned: [{ def: passive, level: 1, equippedSlot: null }], linhThach: 100 });
    const r = await new LevelUpCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never, f.charRepo as never).execute('u', 'p');
    expect(r.level).toBe(2);
    expect(r.linhThach).toBe(0);
  });
  it('thiếu Linh Thạch -> INSUFFICIENT_LINH_THACH', async () => {
    const f = fakes({ owned: [{ def: passive, level: 1, equippedSlot: null }], linhThach: 50 });
    await expect(new LevelUpCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never, f.charRepo as never).execute('u', 'p'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_LINH_THACH' });
  });
  it('đạt maxLevel -> CONGPHAP_MAX_LEVEL', async () => {
    const f = fakes({ owned: [{ def: passive, level: 3, equippedSlot: null }], linhThach: 9999 });
    await expect(new LevelUpCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never, f.charRepo as never).execute('u', 'p'))
      .rejects.toMatchObject({ code: 'CONGPHAP_MAX_LEVEL' });
  });
});
```

- [ ] **Step 2: Chạy — FAIL.**

- [ ] **Step 3: Viết `ListCongPhapUseCase.ts`**

```ts
import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { CongPhapRecord, OwnedCongPhapEntry } from '../domain/congphap/congphap';

export class ListCongPhapUseCase {
  constructor(
    private readonly owned: OwnedCongPhapRepository,
    private readonly congphap: CongPhapRepository,
  ) {}

  async execute(userId: string): Promise<{ owned: OwnedCongPhapEntry[]; catalog: CongPhapRecord[] }> {
    // owned: giữ cả def inactive để UI hiển thị "đã bị vô hiệu"; catalog: chỉ active.
    const [owned, catalog] = await Promise.all([this.owned.listByUser(userId), this.congphap.listActive()]);
    return { owned, catalog };
  }
}
```

- [ ] **Step 4: Viết `EquipCongPhapUseCase.ts`**

```ts
import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { ACTIVE_SLOTS } from '../domain/congphap/congphap';
import { DomainError } from '../domain/errors';

export class EquipCongPhapUseCase {
  constructor(
    private readonly owned: OwnedCongPhapRepository,
    private readonly congphap: CongPhapRepository,
  ) {}

  async execute(userId: string, congPhapId: string, slot: number): Promise<void> {
    if (!Number.isInteger(slot) || slot < 0 || slot >= ACTIVE_SLOTS) {
      throw new DomainError('CONGPHAP_SLOT_INVALID', `slot must be an integer in [0, ${ACTIVE_SLOTS})`);
    }
    const owned = await this.owned.getOne(userId, congPhapId);
    if (!owned) throw new DomainError('CONGPHAP_NOT_OWNED', 'Bạn chưa sở hữu công pháp này');
    // Chỉ công pháp chủ động (còn active) mới trang bị vào slot.
    if (owned.def.category !== 'active') throw new DomainError('CONGPHAP_NOT_EQUIPPABLE', 'Chỉ công pháp chủ động mới trang bị được');
    if (!owned.def.active) throw new DomainError('CONGPHAP_NOT_FOUND', 'Công pháp không khả dụng');

    // Dọn slot trước (thay công pháp đang chiếm slot), rồi gán — 1 công pháp/slot.
    await this.owned.clearSlot(userId, slot);
    const ok = await this.owned.setSlot(userId, congPhapId, slot);
    if (!ok) throw new DomainError('CONGPHAP_NOT_OWNED', 'Bạn chưa sở hữu công pháp này');
  }
}
```

- [ ] **Step 5: Viết `UnequipCongPhapUseCase.ts`**

```ts
import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { DomainError } from '../domain/errors';

export class UnequipCongPhapUseCase {
  constructor(private readonly owned: OwnedCongPhapRepository) {}

  async execute(userId: string, congPhapId: string): Promise<void> {
    const ok = await this.owned.unsetSlot(userId, congPhapId);
    if (!ok) throw new DomainError('CONGPHAP_NOT_OWNED', 'Bạn chưa sở hữu công pháp này');
  }
}
```

- [ ] **Step 6: Viết `LevelUpCongPhapUseCase.ts`**

```ts
import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { levelUpCost } from '../domain/congphap/congphap.calc';
import { DomainError } from '../domain/errors';

export class LevelUpCongPhapUseCase {
  constructor(
    private readonly owned: OwnedCongPhapRepository,
    private readonly congphap: CongPhapRepository,
    private readonly characters: CharacterRepository,
  ) {}

  async execute(userId: string, congPhapId: string): Promise<{ level: number; linhThach: number }> {
    const character = await this.characters.findByUserId(userId);
    if (!character) throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
    const ownedEntry = await this.owned.getOne(userId, congPhapId);
    if (!ownedEntry) throw new DomainError('CONGPHAP_NOT_OWNED', 'Bạn chưa sở hữu công pháp này');
    if (!ownedEntry.def.active) throw new DomainError('CONGPHAP_NOT_FOUND', 'Công pháp không khả dụng');
    if (ownedEntry.level >= ownedEntry.def.maxLevel) {
      throw new DomainError('CONGPHAP_MAX_LEVEL', 'Công pháp đã đạt cấp tối đa');
    }

    const cost = levelUpCost(ownedEntry.def, ownedEntry.level);

    // Saga (giống ConsumePill): TIÊU Linh Thạch trước (atomic guard số dư), rồi
    // nâng level (optimistic guard trên level cũ). Nếu nâng thua race -> hoàn lại
    // Linh Thạch. Không transaction cross-repo trong tầng application.
    const spent = await this.characters.spendLinhThach(character.id, cost);
    if (!spent) throw new DomainError('INSUFFICIENT_LINH_THACH', 'Không đủ Linh Thạch');

    const leveled = await this.owned.levelUpGuarded(userId, congPhapId, ownedEntry.level);
    if (!leveled) {
      await this.characters.addLinhThach(character.id, cost); // bù
      throw new DomainError('CONCURRENT_MODIFICATION', 'Công pháp vừa bị thay đổi bởi request khác');
    }

    return { level: ownedEntry.level + 1, linhThach: character.linhThach - cost };
  }
}
```

- [ ] **Step 7: Chạy — PASS.** `cd backend && npx vitest run src/application/congphap.usecases.test.ts` → PASS.

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/application/ListCongPhapUseCase.ts src/application/EquipCongPhapUseCase.ts src/application/UnequipCongPhapUseCase.ts src/application/LevelUpCongPhapUseCase.ts src/application/congphap.usecases.test.ts
git commit -m "feat(app): use case công pháp người chơi (list/equip/unequip/levelup)"
```

---

## Task 9: Application — admin use case (CRUD định nghĩa + grant) & realm base attrs

**Files:**
- Create: `backend/src/application/CreateCongPhapUseCase.ts`, `UpdateCongPhapUseCase.ts`, `ListCongPhapAdminUseCase.ts`, `GrantUseCase.ts`
- Modify: `backend/src/application/UpdateRealmConfigUseCase.ts` (không đổi logic — base fields đi kèm `RealmConfig` tự động; chỉ cần đảm bảo không có validation chặn base)
- Test: `backend/src/application/congphap.admin.test.ts`

**Interfaces:**
- Consumes: `CongPhapRepository`, `OwnedCongPhapRepository`, `CharacterRepository`, `validateCongPhapDefinition`.
- Produces:
  - `CreateCongPhapUseCase.execute(def) → CongPhapRecord`
  - `UpdateCongPhapUseCase.execute(def) → CongPhapRecord`
  - `ListCongPhapAdminUseCase.execute() → CongPhapRecord[]`
  - `GrantUseCase.execute({ userId, congPhapId?, linhThach? }) → void`

- [ ] **Step 1: Viết test thất bại**

`congphap.admin.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CreateCongPhapUseCase } from './CreateCongPhapUseCase';
import { UpdateCongPhapUseCase } from './UpdateCongPhapUseCase';
import { GrantUseCase } from './GrantUseCase';
import { CongPhapRecord } from '../domain/congphap/congphap';

const valid: CongPhapRecord = { id: 'new-cp', name: 'N', glyph: 'n', rarity: 1, category: 'passive', desc: 'd', active: true, maxLevel: 5, baseCost: 100, costGrowth: 1.5, effects: [{ attribute: 'tocDo', flatPerLevel: 1, pctPerLevel: 0 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null };

function repoFakes(existing: CongPhapRecord[] = []) {
  const m = new Map(existing.map((d) => [d.id, d]));
  return {
    findById: async (id: string) => m.get(id) ?? null,
    listActive: async () => [...m.values()].filter((d) => d.active),
    listAll: async () => [...m.values()],
    create: async (d: CongPhapRecord) => { m.set(d.id, d); },
    update: async (d: CongPhapRecord) => { if (!m.has(d.id)) return false; m.set(d.id, d); return true; },
  };
}

describe('CreateCongPhapUseCase', () => {
  it('validate rồi tạo', async () => {
    const repo = repoFakes();
    const r = await new CreateCongPhapUseCase(repo as never).execute(valid);
    expect(r.id).toBe('new-cp');
  });
  it('id trùng -> CONGPHAP_ID_TAKEN', async () => {
    const repo = repoFakes([valid]);
    await expect(new CreateCongPhapUseCase(repo as never).execute(valid)).rejects.toMatchObject({ code: 'CONGPHAP_ID_TAKEN' });
  });
  it('config sai -> INVALID_CONGPHAP_CONFIG', async () => {
    const repo = repoFakes();
    await expect(new CreateCongPhapUseCase(repo as never).execute({ ...valid, effects: [] })).rejects.toMatchObject({ code: 'INVALID_CONGPHAP_CONFIG' });
  });
});

describe('UpdateCongPhapUseCase', () => {
  it('không tồn tại -> CONGPHAP_NOT_FOUND', async () => {
    const repo = repoFakes();
    await expect(new UpdateCongPhapUseCase(repo as never).execute(valid)).rejects.toMatchObject({ code: 'CONGPHAP_NOT_FOUND' });
  });
});

describe('GrantUseCase', () => {
  it('grant congphap + linhThach', async () => {
    let added = 0; const granted: string[] = [];
    const owned = { grant: async (_u: string, id: string) => { granted.push(id); return true; } };
    const chars = { findByUserId: async () => ({ id: 'c' } as never), addLinhThach: async (_id: string, a: number) => { added += a; } };
    await new GrantUseCase(owned as never, chars as never).execute({ userId: 'u', congPhapId: 'x', linhThach: 500 });
    expect(granted).toEqual(['x']);
    expect(added).toBe(500);
  });
  it('không có gì để cấp -> lỗi', async () => {
    const owned = { grant: async () => true };
    const chars = { findByUserId: async () => ({ id: 'c' } as never), addLinhThach: async () => {} };
    await expect(new GrantUseCase(owned as never, chars as never).execute({ userId: 'u' })).rejects.toMatchObject({ code: 'INVALID_GRANT' });
  });
});
```

- [ ] **Step 2: Chạy — FAIL.**

- [ ] **Step 3: Viết `CreateCongPhapUseCase.ts`**

```ts
import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { CongPhapRecord } from '../domain/congphap/congphap';
import { validateCongPhapDefinition } from '../domain/congphap/congphap.validate';
import { DomainError } from '../domain/errors';

export class CreateCongPhapUseCase {
  constructor(private readonly congphap: CongPhapRepository) {}
  async execute(def: CongPhapRecord): Promise<CongPhapRecord> {
    validateCongPhapDefinition(def);
    // Check-then-create (admin-only path; concurrent dup hits PK -> 500, chấp nhận).
    if (await this.congphap.findById(def.id)) {
      throw new DomainError('CONGPHAP_ID_TAKEN', `Công pháp id "${def.id}" đã tồn tại`);
    }
    await this.congphap.create(def);
    return def;
  }
}
```

- [ ] **Step 4: Viết `UpdateCongPhapUseCase.ts`**

```ts
import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { CongPhapRecord } from '../domain/congphap/congphap';
import { validateCongPhapDefinition } from '../domain/congphap/congphap.validate';
import { DomainError } from '../domain/errors';

export class UpdateCongPhapUseCase {
  constructor(private readonly congphap: CongPhapRepository) {}
  async execute(def: CongPhapRecord): Promise<CongPhapRecord> {
    validateCongPhapDefinition(def);
    const ok = await this.congphap.update(def);
    if (!ok) throw new DomainError('CONGPHAP_NOT_FOUND', `Không tìm thấy công pháp "${def.id}"`);
    return def;
  }
}
```

- [ ] **Step 5: Viết `ListCongPhapAdminUseCase.ts`**

```ts
import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { CongPhapRecord } from '../domain/congphap/congphap';

export class ListCongPhapAdminUseCase {
  constructor(private readonly congphap: CongPhapRepository) {}
  async execute(): Promise<CongPhapRecord[]> {
    return this.congphap.listAll();
  }
}
```

- [ ] **Step 6: Viết `GrantUseCase.ts`**

```ts
import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { DomainError } from '../domain/errors';

// Admin cấp trực tiếp công pháp và/hoặc Linh Thạch cho một người chơi.
export class GrantUseCase {
  constructor(
    private readonly owned: OwnedCongPhapRepository,
    private readonly characters: CharacterRepository,
  ) {}

  async execute(input: { userId: string; congPhapId?: string; linhThach?: number }): Promise<void> {
    if (!input.congPhapId && !input.linhThach) {
      throw new DomainError('INVALID_GRANT', 'Phải cấp ít nhất công pháp hoặc Linh Thạch');
    }
    if (input.linhThach !== undefined && input.linhThach !== 0) {
      const character = await this.characters.findByUserId(input.userId);
      if (!character) throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
      await this.characters.addLinhThach(character.id, input.linhThach);
    }
    if (input.congPhapId) {
      // grant idempotent: đã sở hữu thì bỏ qua (admin không quan tâm dup ở đây).
      await this.owned.grant(input.userId, input.congPhapId);
    }
  }
}
```
> `INVALID_GRANT` là mã lỗi phụ — map 400 ở Task 11 cùng nhóm.

- [ ] **Step 7: Chạy — PASS.** `cd backend && npx vitest run src/application/congphap.admin.test.ts` → PASS.

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/application/CreateCongPhapUseCase.ts src/application/UpdateCongPhapUseCase.ts src/application/ListCongPhapAdminUseCase.ts src/application/GrantUseCase.ts src/application/congphap.admin.test.ts
git commit -m "feat(app): admin CRUD công pháp + cấp thưởng"
```

---

## Task 10: Application — mở rộng Redeem (công pháp + Linh Thạch, dup→refund)

**Files:**
- Modify: `backend/src/domain/redeem/redeemCode.ts`
- Modify: `backend/src/application/RedeemCodeUseCase.ts`
- Modify: `backend/src/domain/ports/RedeemCodeRepository.ts` (nếu `grantRewards` cần đổi chữ ký) + `PrismaRedeemCodeRepository.ts`
- Test: `backend/src/application/redeem.congphap.test.ts`

**Interfaces:**
- Consumes: `CongPhapRepository`, `OwnedCongPhapRepository`, `CharacterRepository`, `duplicateRefund`.
- Produces: `RewardEntry` mở rộng `{ pillId?: string; congPhapId?: string; linhThach?: number; quantity: number }`; `RedeemResultDto.rewards` phần tử có `kind: 'pill'|'congphap'|'linhThach'`.

- [ ] **Step 1: Mở rộng `redeemCode.ts`**

```ts
export interface RewardEntry {
  // Đúng một trong ba khác undefined.
  pillId?: string;
  congPhapId?: string;
  linhThach?: number;
  quantity: number; // với linhThach: coi quantity là bội số (hoặc =1 và linhThach là lượng)
}

export interface RedeemCodeRecord {
  id: string; code: string; active: boolean; maxRedemptions: number;
  redeemedCount: number; expiresAt: Date | null; rewards: RewardEntry[];
}

export interface RedeemRewardResult {
  kind: 'pill' | 'congphap' | 'linhThach';
  id: string;        // pillId / congPhapId / 'linh-thach'
  name: string; glyph: string; quantity: number;
}
export interface RedeemResultDto { rewards: RedeemRewardResult[]; }
```

- [ ] **Step 2: Viết test thất bại**

`redeem.congphap.test.ts` — fake repos, kiểm: cấp công pháp mới (grant true), cấp công pháp trùng (grant false → cộng `duplicateRefund` Linh Thạch), cấp Linh Thạch:
```ts
import { describe, it, expect } from 'vitest';
import { RedeemCodeUseCase } from './RedeemCodeUseCase';
import { CongPhapRecord } from '../domain/congphap/congphap';

const cp: CongPhapRecord = { id: 'cp1', name: 'CP', glyph: 'c', rarity: 2, category: 'passive', desc: 'd', active: true, maxLevel: 5, baseCost: 100, costGrowth: 1.5, effects: [{ attribute: 'khiHuyet', flatPerLevel: 10, pctPerLevel: 0 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: 250 };

function build(rewards: any[], ownedAlready: string[] = []) {
  let refund = 0; let granted: string[] = []; const owned = new Set(ownedAlready);
  const codes = {
    findByCode: async () => ({ id: 'code', code: 'X', active: true, maxRedemptions: 10, redeemedCount: 0, expiresAt: null, rewards }),
    tryReserveRedemption: async () => 'ok',
    grantRewards: async () => {}, // pill path cũ — không dùng ở test này
  };
  const pills = { findById: async () => null };
  const congphap = { findById: async (id: string) => (id === 'cp1' ? cp : null) };
  const ownedRepo = { grant: async (_u: string, id: string) => { if (owned.has(id)) return false; owned.add(id); granted.push(id); return true; } };
  const chars = { findByUserId: async () => ({ id: 'c' } as never), addLinhThach: async (_i: string, a: number) => { refund += a; } };
  return { uc: new RedeemCodeUseCase(codes as never, pills as never, congphap as never, ownedRepo as never, chars as never), get refund() { return refund; }, get granted() { return granted; } };
}

describe('RedeemCodeUseCase công pháp', () => {
  it('cấp công pháp mới', async () => {
    const b = build([{ congPhapId: 'cp1', quantity: 1 }]);
    const r = await b.uc.execute({ userId: 'u', code: 'X' });
    expect(b.granted).toEqual(['cp1']);
    expect(r.rewards[0].kind).toBe('congphap');
  });
  it('công pháp trùng -> hoàn Linh Thạch = duplicateRefund', async () => {
    const b = build([{ congPhapId: 'cp1', quantity: 1 }], ['cp1']);
    const r = await b.uc.execute({ userId: 'u', code: 'X' });
    expect(b.refund).toBe(250);
    expect(r.rewards[0].kind).toBe('linhThach');
    expect(r.rewards[0].quantity).toBe(250);
  });
  it('cấp Linh Thạch trực tiếp', async () => {
    const b = build([{ linhThach: 1000, quantity: 1 }]);
    const r = await b.uc.execute({ userId: 'u', code: 'X' });
    expect(b.refund).toBe(1000);
    expect(r.rewards[0].kind).toBe('linhThach');
  });
});
```

- [ ] **Step 3: Chạy — FAIL.**

- [ ] **Step 4: Viết lại `RedeemCodeUseCase.ts`**

```ts
import { RedeemCodeRepository } from '../domain/ports/RedeemCodeRepository';
import { PillRepository } from '../domain/ports/PillRepository';
import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { RedeemResultDto, RedeemRewardResult } from '../domain/redeem/redeemCode';
import { normalizeCode } from '../domain/redeem/redeemCode.validate';
import { duplicateRefund } from '../domain/congphap/congphap.calc';
import { DomainError } from '../domain/errors';

export class RedeemCodeUseCase {
  constructor(
    private readonly codes: RedeemCodeRepository,
    private readonly pills: PillRepository,
    private readonly congphap: CongPhapRepository,
    private readonly owned: OwnedCongPhapRepository,
    private readonly characters: CharacterRepository,
  ) {}

  async execute(input: { userId: string; code: string }): Promise<RedeemResultDto> {
    const code = await this.codes.findByCode(normalizeCode(input.code));
    if (!code) throw new DomainError('REDEEM_CODE_NOT_FOUND', 'Mã không tồn tại');
    if (!code.active) throw new DomainError('REDEEM_CODE_INACTIVE', 'Mã đã bị vô hiệu hóa');
    if (code.expiresAt && code.expiresAt.getTime() <= Date.now()) throw new DomainError('REDEEM_CODE_EXPIRED', 'Mã đã hết hạn');

    const reserved = await this.codes.tryReserveRedemption(code.id, input.userId, code.maxRedemptions);
    if (reserved === 'already_redeemed') throw new DomainError('REDEEM_CODE_ALREADY_USED', 'Bạn đã đổi mã này rồi');
    if (reserved === 'exhausted') throw new DomainError('REDEEM_CODE_EXHAUSTED', 'Mã đã hết lượt đổi');

    // Grant từng reward theo loại. Pill dùng đường cũ (grantRewards trên pill).
    // Character cho các phần Linh Thạch (grant + hoàn khi công pháp trùng).
    const character = await this.characters.findByUserId(input.userId);
    if (!character) throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');

    const results: RedeemRewardResult[] = [];
    for (const r of code.rewards) {
      if (r.pillId) {
        await this.codes.grantRewards(input.userId, [{ pillId: r.pillId, quantity: r.quantity }]);
        const pill = await this.pills.findById(r.pillId);
        results.push({ kind: 'pill', id: r.pillId, name: pill?.name ?? r.pillId, glyph: pill?.glyph ?? '?', quantity: r.quantity });
      } else if (r.congPhapId) {
        const def = await this.congphap.findById(r.congPhapId);
        const isNew = await this.owned.grant(input.userId, r.congPhapId);
        if (isNew) {
          results.push({ kind: 'congphap', id: r.congPhapId, name: def?.name ?? r.congPhapId, glyph: def?.glyph ?? '?', quantity: 1 });
        } else {
          // Đã sở hữu -> quy đổi thành Linh Thạch (spec).
          const refund = def ? duplicateRefund(def) : 0;
          if (refund > 0) await this.characters.addLinhThach(character.id, refund);
          results.push({ kind: 'linhThach', id: 'linh-thach', name: 'Linh Thạch', glyph: '晶', quantity: refund });
        }
      } else if (r.linhThach) {
        await this.characters.addLinhThach(character.id, r.linhThach);
        results.push({ kind: 'linhThach', id: 'linh-thach', name: 'Linh Thạch', glyph: '晶', quantity: r.linhThach });
      }
    }
    return { rewards: results };
  }
}
```
> `RedeemCodeRepository.grantRewards` giữ chữ ký cũ `(userId, RewardEntry[])` nhưng giờ `RewardEntry` có `pillId?` optional — đảm bảo `PrismaRedeemCodeRepository.grantRewards` chỉ xử lý phần tử có `pillId` (bỏ qua congphap/linhThach, chúng được use case xử lý trực tiếp). Sửa Prisma repo tương ứng.

- [ ] **Step 5: Sửa `PrismaRedeemCodeRepository`** — đọc rewards với 3 cột mới; `grantRewards` chỉ tăng inventory cho reward có `pillId`. Đọc file hiện tại rồi map thêm `congPhapId`, `linhThach`.

- [ ] **Step 6: Chạy — PASS.** `cd backend && npx vitest run src/application/redeem.congphap.test.ts` → PASS.

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/domain/redeem/redeemCode.ts src/application/RedeemCodeUseCase.ts src/infrastructure/repositories/PrismaRedeemCodeRepository.ts src/domain/ports/RedeemCodeRepository.ts src/application/redeem.congphap.test.ts
git commit -m "feat(app): redeem cấp công pháp + Linh Thạch, trùng thì quy đổi"
```

---

## Task 11: Presentation — routes người chơi + errorHandler + wiring app.ts

**Files:**
- Create: `backend/src/presentation/routes/congphap.routes.ts`, `backend/src/presentation/schemas/congphap.schemas.ts`
- Modify: `backend/src/presentation/middleware/errorHandler.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/presentation/routes/cultivation.routes.ts` (serialize field mới nếu route tự map — nếu trả thẳng output thì không cần)
- Test: `backend/src/presentation/congphap.integration.test.ts`

**Interfaces:**
- Consumes: use case Task 7–8, repos Task 6.
- Produces: `POST /congphap/equip|unequip|levelup`, `GET /congphap`; cultivation state trả kèm attributes/battlePower/linhThach.

> **context7:** `npx ctx7@latest docs /colinhacks/zod "object schema with number int min max and refine"` nếu cần.

- [ ] **Step 1: Thêm mã lỗi vào `errorHandler.ts`**

Đọc file, thêm vào bảng map code→status:
```ts
  CONGPHAP_NOT_FOUND: 404,
  CONGPHAP_NOT_OWNED: 404,
  CONGPHAP_NOT_EQUIPPABLE: 400,
  CONGPHAP_SLOT_INVALID: 400,
  CONGPHAP_MAX_LEVEL: 409,
  INSUFFICIENT_LINH_THACH: 409,
  INVALID_CONGPHAP_CONFIG: 400,
  CONGPHAP_ID_TAKEN: 409,
  INVALID_GRANT: 400,
```
(theo đúng cấu trúc map hiện có — đọc trước để khớp format.)

- [ ] **Step 2: Viết `congphap.schemas.ts`**

```ts
import { z } from 'zod';

export const equipSchema = z.object({
  congPhapId: z.string().regex(/^[a-z0-9-]+$/),
  slot: z.number().int().min(0).max(3),
});
export const unequipSchema = z.object({ congPhapId: z.string().regex(/^[a-z0-9-]+$/) });
export const levelUpSchema = z.object({ congPhapId: z.string().regex(/^[a-z0-9-]+$/) });
```

- [ ] **Step 3: Viết `congphap.routes.ts`** (theo mẫu `pills.routes.ts`)

```ts
import { Router, RequestHandler } from 'express';
import { ListCongPhapUseCase } from '../../application/ListCongPhapUseCase';
import { EquipCongPhapUseCase } from '../../application/EquipCongPhapUseCase';
import { UnequipCongPhapUseCase } from '../../application/UnequipCongPhapUseCase';
import { LevelUpCongPhapUseCase } from '../../application/LevelUpCongPhapUseCase';
import { equipSchema, unequipSchema, levelUpSchema } from '../schemas/congphap.schemas';
import { DomainError } from '../../domain/errors';

interface Deps {
  listCongPhapUseCase: ListCongPhapUseCase;
  equipCongPhapUseCase: EquipCongPhapUseCase;
  unequipCongPhapUseCase: UnequipCongPhapUseCase;
  levelUpCongPhapUseCase: LevelUpCongPhapUseCase;
  requireAuth: RequestHandler;
}

export function createCongPhapRouter(deps: Deps): Router {
  const router = Router();
  router.use(deps.requireAuth);

  router.get('/', async (req, res, next) => {
    try { res.json(await deps.listCongPhapUseCase.execute((req as any).userId)); }
    catch (e) { next(e); }
  });

  router.post('/equip', async (req, res, next) => {
    try {
      const parsed = equipSchema.safeParse(req.body);
      if (!parsed.success) throw new DomainError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ');
      await deps.equipCongPhapUseCase.execute((req as any).userId, parsed.data.congPhapId, parsed.data.slot);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  router.post('/unequip', async (req, res, next) => {
    try {
      const parsed = unequipSchema.safeParse(req.body);
      if (!parsed.success) throw new DomainError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ');
      await deps.unequipCongPhapUseCase.execute((req as any).userId, parsed.data.congPhapId);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  router.post('/levelup', async (req, res, next) => {
    try {
      const parsed = levelUpSchema.safeParse(req.body);
      if (!parsed.success) throw new DomainError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ');
      res.json(await deps.levelUpCongPhapUseCase.execute((req as any).userId, parsed.data.congPhapId));
    } catch (e) { next(e); }
  });

  return router;
}
```
> Cách lấy `userId` từ request phải khớp mẫu hiện có (đọc `pills.routes.ts`/`auth.ts` middleware để biết `req.userId` hay `res.locals`). Sửa cho khớp. `VALIDATION_ERROR` là mã đã có trong errorHandler (kiểm tra; nếu chưa, dùng mã zod hiện dùng ở routes khác).

- [ ] **Step 4: Wire `app.ts`**

Thêm import repo + use case + router mới; khởi tạo:
```ts
  const congPhapRepository = new PrismaCongPhapRepository(client);
  const ownedCongPhapRepository = new PrismaOwnedCongPhapRepository(client);
```
Sửa các use case đã đổi ctor:
```ts
  const getCultivationStateUseCase = new GetCultivationStateUseCase(characterRepository, realmConfigProvider, ownedCongPhapRepository);
  const consumePillUseCase = new ConsumePillUseCase(characterRepository, pillRepository, realmConfigProvider, ownedCongPhapRepository);
  const attemptBreakthroughUseCase = new AttemptBreakthroughUseCase(characterRepository, randomSource, realmConfigProvider, ownedCongPhapRepository);
  const redeemCodeUseCase = new RedeemCodeUseCase(redeemCodeRepository, pillRepository, congPhapRepository, ownedCongPhapRepository, characterRepository);
```
Thêm use case công pháp:
```ts
  const listCongPhapUseCase = new ListCongPhapUseCase(ownedCongPhapRepository, congPhapRepository);
  const equipCongPhapUseCase = new EquipCongPhapUseCase(ownedCongPhapRepository, congPhapRepository);
  const unequipCongPhapUseCase = new UnequipCongPhapUseCase(ownedCongPhapRepository);
  const levelUpCongPhapUseCase = new LevelUpCongPhapUseCase(ownedCongPhapRepository, congPhapRepository, characterRepository);
```
Mount router:
```ts
  app.use('/congphap', createCongPhapRouter({ listCongPhapUseCase, equipCongPhapUseCase, unequipCongPhapUseCase, levelUpCongPhapUseCase, requireAuth }));
```

- [ ] **Step 5: Viết integration test** `congphap.integration.test.ts` — dùng `createApp({ prismaClient })` + supertest (mẫu integration test hiện có): đăng ký user, grant 1 công pháp qua repo, GET /congphap thấy owned, POST /congphap/equip, POST /congphap/levelup sau khi cấp Linh Thạch; GET /cultivation/state có `attributes`, `battlePower`, `linhThach`.

```ts
// Khung — theo đúng helper đăng ký/login của các integration test hiện có.
// Assert then:
//   expect(state.body.attributes.final.khiHuyet).toBeGreaterThan(0);
//   expect(typeof state.body.battlePower).toBe('number');
//   expect(typeof state.body.linhThach).toBe('number');
```

- [ ] **Step 6: Chạy** `cd backend && npx tsc --noEmit` (xanh toàn bộ) rồi `npx vitest run src/presentation/congphap.integration.test.ts` → PASS.

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/presentation/routes/congphap.routes.ts src/presentation/schemas/congphap.schemas.ts src/presentation/middleware/errorHandler.ts src/app.ts src/presentation/congphap.integration.test.ts
git commit -m "feat(api): routes công pháp người chơi + thuộc tính trong cultivation state"
```

---

## Task 12: Presentation — admin routes (CRUD công pháp, grant, realm base attrs)

**Files:**
- Modify: `backend/src/presentation/routes/admin.routes.ts`
- Modify: `backend/src/presentation/schemas/admin.schemas.ts`
- Modify: `backend/src/app.ts` (truyền use case admin mới vào `createAdminRouter`)
- Test: `backend/src/presentation/admin.congphap.integration.test.ts`

**Interfaces:**
- Consumes: `CreateCongPhapUseCase`, `UpdateCongPhapUseCase`, `ListCongPhapAdminUseCase`, `GrantUseCase`, `UpdateRealmConfigUseCase` (base attrs).
- Produces: `GET/POST /admin/congphap`, `PUT /admin/congphap/:id`, `POST /admin/grant`; `PUT /admin/realms` chấp nhận 6 base fields.

- [ ] **Step 1: Viết zod schema công pháp trong `admin.schemas.ts`**

```ts
const passiveEffectSchema = z.object({
  attribute: z.enum(['khiHuyet','chanNguyen','congVatLy','congPhep','phongThu','tocDo']),
  flatPerLevel: z.number(),
  pctPerLevel: z.number(),
});

// Body tạo có id; body update KHÔNG có id (id lấy từ :id param) — mirror pill schema.
export const createCongPhapSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1), glyph: z.string().min(1), rarity: z.number().int(),
  category: z.enum(['active','passive']), desc: z.string().min(1),
  active: z.boolean(), maxLevel: z.number().int().min(1),
  baseCost: z.number().int().min(0), costGrowth: z.number().min(1),
  effects: z.array(passiveEffectSchema).nullable(),
  powerPerLevel: z.number().nullable(),
  chanNguyenCost: z.number().nullable(),
  dupRefundLinhThach: z.number().int().min(0).nullable(),
});
export const updateCongPhapSchema = createCongPhapSchema.omit({ id: true });

export const grantSchema = z.object({
  userId: z.string().min(1),
  congPhapId: z.string().regex(/^[a-z0-9-]+$/).optional(),
  linhThach: z.number().int().optional(),
});
```
Và mở rộng schema realm sub-stage hiện có: thêm 6 base fields `z.number()` (đọc schema realm hiện tại, thêm `baseKhiHuyet` … `baseTocDo`). Nếu base optional để tương thích client cũ, dùng `.default(0)`.

- [ ] **Step 2: Thêm routes vào `admin.routes.ts`** (sau nhóm pills, theo đúng mẫu):

```ts
  router.get('/congphap', async (_req, res, next) => {
    try { res.json(await deps.listCongPhapAdminUseCase.execute()); } catch (e) { next(e); }
  });
  router.post('/congphap', async (req, res, next) => {
    try {
      const parsed = createCongPhapSchema.safeParse(req.body);
      if (!parsed.success) throw new DomainError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ');
      res.status(201).json(await deps.createCongPhapUseCase.execute(parsed.data as any));
    } catch (e) { next(e); }
  });
  router.put('/congphap/:id', async (req, res, next) => {
    try {
      if (!/^[a-z0-9-]+$/.test(req.params.id)) throw new DomainError('VALIDATION_ERROR', 'id không hợp lệ');
      const parsed = updateCongPhapSchema.safeParse(req.body);
      if (!parsed.success) throw new DomainError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ');
      res.json(await deps.updateCongPhapUseCase.execute({ id: req.params.id, ...parsed.data } as any));
    } catch (e) { next(e); }
  });
  router.post('/grant', async (req, res, next) => {
    try {
      const parsed = grantSchema.safeParse(req.body);
      if (!parsed.success) throw new DomainError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ');
      await deps.grantUseCase.execute(parsed.data);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });
```
Thêm 4 use case vào `interface` Deps của `createAdminRouter` + import schema/DomainError.

- [ ] **Step 3: Wire `app.ts`** — khởi tạo `listCongPhapAdminUseCase`, `createCongPhapUseCase`, `updateCongPhapUseCase`, `grantUseCase` và truyền vào `createAdminRouter({ ... })`.

- [ ] **Step 4: Viết integration test** `admin.congphap.integration.test.ts` — tạo user admin (set role='admin' trực tiếp qua prisma, re-login), POST /admin/congphap tạo định nghĩa hợp lệ (201) và sai config (400 `INVALID_CONGPHAP_CONFIG`), PUT sửa, GET liệt kê, POST /admin/grant cấp cho user thường rồi GET /congphap của user đó thấy sở hữu. Non-admin gọi → 403 `FORBIDDEN`.

- [ ] **Step 5: Chạy** `npx tsc --noEmit` + `npx vitest run src/presentation/admin.congphap.integration.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/presentation/routes/admin.routes.ts src/presentation/schemas/admin.schemas.ts src/app.ts src/presentation/admin.congphap.integration.test.ts
git commit -m "feat(api): admin CRUD công pháp + cấp thưởng + base thuộc tính realm"
```

---

## Task 13: Full suite, CLAUDE.md, dọn dẹp

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Chạy toàn bộ test backend**

Run: `cd backend && npm test`
Expected: tất cả xanh. Ghi lại tổng số test mới (unit + integration).

- [ ] **Step 2: Lint/format nếu có** (`npm run lint`/`format` nếu backend cấu hình).

- [ ] **Step 3: Cập nhật `CLAUDE.md`** — thêm mục "Công Pháp & Thuộc tính" (core facts, hiện trạng):
  - 6 thuộc tính (`khiHuyet…tocDo`), Chiến lực = trọng số `BATTLE_POWER_WEIGHTS`; base per sub-stage trong `RealmStage` (6 cột, `deriveBaseAttributes` seed từ cultivationRate).
  - `CongPhap`/`OwnedCongPhap`, `Character.linhThach`; bị động cộng thuộc tính (flat trước %), chủ động 4 slot (`ACTIVE_SLOTS`) chưa áp dụng.
  - `levelUpCost = round(baseCost·costGrowth^(level-1))`; saga spend-first/refund giống ConsumePill.
  - Redeem trùng công pháp → refund Linh Thạch (`duplicateRefund = dupRefundLinhThach ?? baseCost`); RedeemCodeReward đa loại.
  - Routes `GET /congphap`, `POST /congphap/equip|unequip|levelup`; admin `GET/POST /admin/congphap`, `PUT /admin/congphap/:id`, `POST /admin/grant`; thuộc tính gộp trong `GET /cultivation/state`.
  - Mã lỗi mới. Cập nhật **test counts** (backend N).
  - Gotcha: `db:seed` upsert đè cả `CongPhap`.

- [ ] **Step 4: Commit**

```bash
cd backend && git add ../CLAUDE.md
git commit -m "docs: cập nhật CLAUDE.md cho hệ công pháp + thuộc tính (backend)"
```

---

## Self-Review (đã chạy khi viết plan)

- **Spec coverage:** 6 thuộc tính (T2,T4), chiến lực chỉ từ 6 thuộc tính (T2), base per sub-stage admin-editable (T1,T4,T12), công pháp bị động cộng dồn (T3,T7), chủ động 4 slot không cộng thuộc tính (T3,T7,T8), nâng level bằng Linh Thạch (T5,T6,T8), redeem+admin nguồn (T9,T10), redeem trùng→refund (T10), API gộp cultivation state (T7), soft-disable (T3,T7,T8), optimistic/saga (T6,T8). ✔
- **Placeholder scan:** không có TBD/TODO; mọi step code có nội dung thật. Các chỗ "đọc file hiện tại rồi khớp" là hướng dẫn tích hợp cụ thể vào file có sẵn (userId accessor, errorHandler map format, Prisma repo map) — cố ý, vì phải khớp mẫu hiện có; không phải placeholder logic.
- **Type consistency:** `AttributeSet` (6 khóa) nhất quán; `CongPhapRecord` giống nhau ở domain/infra/schema; `levelUpCost(def, currentLevel)`, `duplicateRefund(def)`, `buildAttributeState(config, major, sub, owned)`, `computeAttributes(base, passives)` dùng đồng nhất; `PassiveEffect` export từ `attributes.calc.ts` và tái dùng ở `congphap.ts`. ✔
