# Thiết kế: Hệ thống Công Pháp & Thuộc tính nhân vật

- **Ngày:** 2026-07-24
- **Phạm vi:** Backend (domain → application → infrastructure → presentation) + Frontend (panel thuộc tính, màn Công Pháp) + Admin dashboard.
- **Mục tiêu phase này:** *Hiển thị + tăng trưởng*. Tính và hiển thị 6 thuộc tính nhân vật + Chiến lực; công pháp làm tăng thuộc tính (bị động) hoặc lưu sức mạnh kỹ năng để dành combat (chủ động). **Chưa có combat** — hệ chiến đấu là phase sau.

## 1. Tổng quan & quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Bộ thuộc tính | 6: Khí huyết (HP), Chân nguyên (MP), Công vật lý, Công phép, Phòng thủ, Tốc độ |
| Chiến lực | Hàm trọng số thuần của **6 thuộc tính cuối**; công pháp chủ động KHÔNG tính vào |
| Thuộc tính nền | Lưu theo từng sub-stage trong `RealmStage` (DB, admin chỉnh) |
| Công pháp bị động | Cộng dồn vô hạn, luôn bật, cộng thuộc tính |
| Công pháp chủ động | Trang bị vào **4 slot cố định**; hiệu ứng "sát thương thêm khi combat" — lưu skill power theo level, **chưa áp dụng** ở phase này |
| Nâng cấp | Cả 2 loại nâng level bằng **Linh Thạch** (currency mới) |
| Nguồn công pháp | **Redeem code + Admin cấp trực tiếp** (không starter, không gacha) |
| API thuộc tính | **Gộp vào `GetCultivationState`** (server-authoritative, ít round-trip) |
| Redeem trùng công pháp | **Quy đổi thành Linh Thạch** (mặc định = `baseCost`, admin chỉnh được) |

Hướng tiếp cận: **nhân bản pattern `Pill`** — nhất quán với soft-disable, optimistic concurrency, admin CRUD, validator domain thuần (`INVALID_*_CONFIG`). Không gộp thành hệ "item" đa hình (YAGNI), không bỏ định nghĩa khỏi DB (mất khả năng tinh chỉnh admin).

## 2. Mô hình domain (thuần, không phụ thuộc framework)

Thư mục mới: `backend/src/domain/attributes/` và `backend/src/domain/congphap/`.

### 2.1 Thuộc tính

Khóa nội bộ: `khiHuyet, chanNguyen, congVatLy, congPhep, phongThu, tocDo`.

```
AttributeSet = { khiHuyet, chanNguyen, congVatLy, congPhep, phongThu, tocDo }  // tất cả number
```

`attributes.calc.ts` (thuần):

- `computeAttributes(base: AttributeSet, passives: {def, level}[]): { base, final, battlePower }`
  - Với mỗi thuộc tính: `final = (base + Σ flatPerLevel·level) × (1 + Σ pctPerLevel·level / 100)`.
    - **Cộng phẳng trước, nhân % sau** (chuẩn game tu tiên). Làm tròn ở tầng hiển thị, giữ số thực ở domain.
  - Chỉ **công pháp bị động đang sở hữu** (và `def.active === true`) mới đóng góp. Chủ động bị bỏ qua.
- `computeBattlePower(final: AttributeSet, weights: BattlePowerWeights): number`
  - Mặc định (khởi tạo, admin có thể đổi bằng đổi công thức hằng — không cấu hình DB ở phase này):
    `round(HP·0.1 + MP·0.1 + congVatLy·1 + congPhep·1 + phongThu·0.8 + tocDo·1.2)`.
  - Trọng số nằm trong hằng domain `BATTLE_POWER_WEIGHTS` (một chỗ, có comment giải thích).

### 2.2 Công pháp

`congphap.ts` — kiểu dữ liệu:

```
CongPhapCategory = "active" | "passive"

PassiveEffect = { attribute: keyof AttributeSet, flatPerLevel: number, pctPerLevel: number }

CongPhapRecord = {
  id: string            // slug ^[a-z0-9-]+$
  name: string
  glyph: string
  rarity: number
  category: CongPhapCategory
  desc: string
  active: boolean       // soft-disable
  maxLevel: number      // ≥ 1
  baseCost: number      // Linh Thạch cho level 1→2 (≥ 0); cũng là mặc định quy đổi khi redeem trùng
  costGrowth: number    // ≥ 1, hệ số nhân chi phí mỗi level
  // bị động:
  effects?: PassiveEffect[]     // ≥1 khi category==="passive"
  // chủ động:
  powerPerLevel?: number        // > 0 khi category==="active"; skill power = powerPerLevel·level (lưu, chưa áp dụng)
  chanNguyenCost?: number       // tùy chọn, để dành combat
  dupRefundLinhThach?: number   // Linh Thạch quy đổi khi redeem trùng; mặc định = baseCost nếu null
}

OwnedCongPhap = { congPhapId: string, level: number, equippedSlot: number | null }
```

`congphap.calc.ts` (thuần):

- `levelUpCost(def, currentLevel): number = round(def.baseCost × def.costGrowth^(currentLevel-1))`
  - Chi phí để đi từ `currentLevel` → `currentLevel+1`. Level bắt đầu = 1.
- `duplicateRefund(def): number = def.dupRefundLinhThach ?? def.baseCost`

`congphap.validate.ts` (thuần) → `INVALID_CONGPHAP_CONFIG`:

- `category==="passive"`: `effects` không rỗng; mỗi `attribute` ∈ 6 khóa; `flatPerLevel`/`pctPerLevel` hữu hạn; không có `powerPerLevel`.
- `category==="active"`: `powerPerLevel > 0`; không có `effects`.
- Chung: `maxLevel ≥ 1`, `baseCost ≥ 0`, `costGrowth ≥ 1`, `id` khớp slug, `rarity` hữu hạn.

### 2.3 Bất biến nghiệp vụ

- **Trang bị chủ động**: `slot ∈ [0,4)`; mỗi slot tối đa 1 công pháp; không hai công pháp cùng slot. `unequip` = set `equippedSlot=null`. Chỉ `category==="active"` mới trang bị (`CONGPHAP_NOT_EQUIPPABLE`). Bị động luôn `equippedSlot=null` và luôn đóng góp.
- **Nâng level**: chặn khi `level ≥ maxLevel` (`CONGPHAP_MAX_LEVEL`) hoặc `linhThach < cost` (`INSUFFICIENT_LINH_THACH`).
- **Soft-disable** (`active=false`): giữ `OwnedCongPhap`; không cộng thuộc tính, không nâng, không trang bị. Bật lại thì khôi phục — giống pill.

## 3. Dữ liệu (Prisma)

### 3.1 `RealmStage` — thêm 6 cột base

`baseKhiHuyet, baseChanNguyen, baseCongVatLy, baseCongPhep, basePhongThu, baseTocDo` (`Float`).
Seed cho **cả 60 dòng** bằng đường cong tăng theo cảnh giới, sinh trong `prisma/seed.ts` từ `SEED_REALMS` (ví dụ base tăng theo `linhKhiRequired` hoặc theo chỉ số realm; số khởi tạo, admin tinh chỉnh). `domain/config/realms.ts` mở rộng `SubStageConfig`/`SubStageRow` với 6 trường; editor `/admin/realms` full-replace mang theo 6 ô mới.

### 3.2 `Character` — thêm currency

`linhThach Int @default(0)`.

### 3.3 `CongPhap` (định nghĩa)

```prisma
model CongPhap {
  id                 String  @id            // slug
  name               String
  glyph              String
  rarity             Int
  category           String                 // "active" | "passive"
  desc               String
  active             Boolean @default(true)
  maxLevel           Int
  baseCost           Int
  costGrowth         Float
  effects            Json?                   // PassiveEffect[] (passive)
  powerPerLevel      Float?                  // active
  chanNguyenCost     Float?                  // active, để dành combat
  dupRefundLinhThach Int?
  owned              OwnedCongPhap[]
  redeemRewards      RedeemCodeReward[]
}
```

### 3.4 `OwnedCongPhap` (sở hữu người chơi)

```prisma
model OwnedCongPhap {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  congPhapId   String
  congPhap     CongPhap @relation(fields: [congPhapId], references: [id])
  level        Int      @default(1)
  equippedSlot Int?     // 0..3 cho active; null nếu chưa trang bị / passive
  @@unique([userId, congPhapId])
}
```

### 3.5 `RedeemCodeReward` — mở rộng

Thêm nullable: `congPhapId String?` + relation, và `linhThach Int?`. Giữ tương thích: một reward là **một trong** {pill, congphap, linhThach}. Ràng buộc "đúng một loại" validate ở domain khi tạo code (`INVALID_REDEEM_REWARD` nếu cần) — hoặc tái dùng validator redeem hiện có.

Migration: `npx prisma migrate dev`. Lưu ý Docker/OpenSSL & binary target đã có.

## 4. Use cases & API (backend)

Cấu trúc giữ nguyên: use case chỉ phụ thuộc **port domain**; composition root (`app.ts`) nối infra thật.

### 4.1 Ports mới (`domain/ports`)

- `CongPhapRepository` — CRUD định nghĩa (list active/all, getById, create, update, exists).
- `OwnedCongPhapRepository` — theo user: list (kèm def), getOne, create/upsert, updateLevel, updateSlot; trang bị/gỡ với optimistic concurrency.
- `AttributeConfigSource` — lấy `AttributeSet` base cho `(realmMajor, realmSub)` từ `RealmConfigSet` (mở rộng `RealmConfigSource` hiện có thay vì port mới, nếu gọn hơn).

### 4.2 Use cases

- `GetCultivationStateUseCase` **mở rộng**: sau khi lazy-clamp stage & tính linh khí/buff, đọc base thuộc tính của stage + danh sách bị động sở hữu → `computeAttributes` → trả `attributes {base, final}`, `battlePower`, `linhThach` trong output. Chủ động không ảnh hưởng.
- `ListCongPhapUseCase` — công pháp sở hữu (def + level + slot) + catalog (định nghĩa `active`) cho hiển thị.
- `EquipCongPhapUseCase` / `UnequipCongPhapUseCase` — validate category/slot; optimistic concurrency; nếu slot đang có công pháp khác thì thay thế (unequip cái cũ).
- `LevelUpCongPhapUseCase` — guard sở hữu + `def.active` + chưa max + đủ Linh Thạch → trừ `linhThach` và tăng `level` **nguyên tử** (`updateMany where userId,congPhapId,level=cur` + `Character.updateMany where linhThach ≥ cost`), saga bù nếu một vế thất bại (không transaction cross-repo ở application, giống `ConsumePillUseCase`).
- Admin: `CreateCongPhapUseCase`, `UpdateCongPhapUseCase`, `ListCongPhapAdminUseCase`, `GrantUseCase` (cấp công pháp/Linh Thạch cho user).
- Redeem: `RedeemCodeUseCase` **mở rộng** grant — pill (như cũ), Linh Thạch (cộng thẳng), công pháp (tạo `OwnedCongPhap` nếu chưa có; **nếu đã có → cộng `duplicateRefund(def)` Linh Thạch**). Giữ saga đặt-chỗ-trước-khi-grant.

### 4.3 Routes (presentation)

Người chơi (sau `requireAuth`):
- `GET /congphap` — sở hữu + catalog.
- `POST /congphap/equip` `{ congPhapId, slot }`
- `POST /congphap/unequip` `{ slot }`
- `POST /congphap/levelup` `{ congPhapId }`
- (thuộc tính đi kèm trong `GET /cultivation` state hiện có)

Admin (sau `requireAuth` + `requireAdmin`):
- `GET/POST /admin/congphap`, `PUT /admin/congphap/:id` (id slug, body không id khi update)
- `POST /admin/grant` `{ userId, congPhapId?, linhThach? }`
- `GET/PUT /admin/realms` mang thêm 6 cột base (full-replace như hiện tại)

### 4.4 Mã lỗi (`errorHandler` — nguồn duy nhất map DomainError→HTTP)

`CONGPHAP_NOT_FOUND` 404 · `CONGPHAP_NOT_OWNED` 404 · `CONGPHAP_NOT_EQUIPPABLE` 400 · `CONGPHAP_SLOT_INVALID` 400 · `CONGPHAP_MAX_LEVEL` 409 · `INSUFFICIENT_LINH_THACH` 409 · `INVALID_CONGPHAP_CONFIG` 400 · `CONGPHAP_ID_TAKEN` 409.

## 5. Frontend — người chơi

Layering giữ nguyên (`lib/` → `hooks/` → `components/` → `app/`). Server-authoritative.

- **Panel thuộc tính**: 6 thuộc tính (hiện `final`, tô vàng phần chênh so với `base` như pattern `(+N%)`) + **Chiến lực** nổi bật + số **Linh Thạch**. Nguồn = `useCultivationState` (đã có buff/boost truth), bổ sung trường attributes/battlePower/linhThach.
- **Màn "Công Pháp"** (mở từ `HeaderMenu`, GSAP như Đan Phòng):
  - Khu **4 slot chủ động**: gán/gỡ công pháp active; hiện skill power theo level + nhãn "hiệu quả khi Combat".
  - Danh sách **bị động**: luôn bật, hiện bonus thuộc tính theo level.
  - Nút **Nâng cấp** mỗi công pháp: hiện chi phí Linh Thạch level kế; disable khi thiếu/đạt max; **wait-for-server** (await POST → refetch trong `finally` → particle/toast; lỗi server = toast danger).
  - `usePillInventory`-style: `useCongPhap(enabled)` lazy-fetch khi mở modal, `equip/unequip/levelUp` POST rồi refetch.
- **Mirror công thức** FE `lib/attributes-display.ts` (base+passive) và `lib/congphap-display.ts` (cost level kế) để preview không chờ server — như `cultivation-display.ts`. Dùng lại `RARITY_META`.
- API client trong `lib/api.ts` (giữ silent 401→refresh→retry, `credentials:"include"`).

## 6. Frontend — Admin dashboard

- **`/admin/congphap`** (master/detail như `/admin/pills`): sửa định nghĩa; form theo `category` (bị động: editor `effects[]`; chủ động: `powerPerLevel`, `chanNguyenCost`); `maxLevel/baseCost/costGrowth`, soft-disable. Validate mirror `lib/congphap-validation.ts` (pre-flight field errors, NaN chặn Save; disable control khi saving).
- **Cấp thưởng**: khối trong `/admin/congphap` — chọn user + công pháp/Linh Thạch → `POST /admin/grant`.
- **`/admin/realms`**: thêm 6 ô base thuộc tính vào editor sub-stage (full-replace PUT sẵn có; validation mirror `lib/realm-validation.ts` mở rộng).
- KPI `/admin`: tùy chọn thêm "tổng công pháp đã phát" — có thể bỏ để thu gọn scope.

## 7. Testing, thứ tự & rủi ro

### Testing
- **Unit domain thuần**: `attributes.calc` (flat trước %, chỉ passive+active def, battlePower), `congphap.calc` (cost lũy tiến, dup refund), `congphap.validate` (mọi nhánh lỗi).
- **Integration vs Postgres thật**: use case + route (equip/unequip/levelup, admin CRUD, grant, redeem mở rộng, state gộp attributes). Pre-warm Prisma trước khi race concurrent; username ≥ 3 ký tự.
- **FE**: unit pure-logic (`environment:"node"`, `include: src/**/*.test.ts`) cho `attributes-display`/`congphap-display`/validation; UI động = human-observation gate (375/768/1024/1440px).
- Cập nhật test counts trong `CLAUDE.md` sau mỗi task.

### Thứ tự thực hiện (mirror tiền lệ Đan Dược → 3 plan)
1. **Backend**: schema/migration + seed base + domain (attributes, congphap) + ports + use cases + routes + admin + redeem mở rộng.
2. **Frontend-integration**: types/format/api/hook + panel thuộc tính trong state hiện có.
3. **UI**: màn Công Pháp (slot + nâng cấp) + trang `/admin/congphap` + 6 ô base trong `/admin/realms`.

`writing-plans` sẽ tách thành các plan tương ứng.

### Rủi ro & lưu ý
- `db:seed` **upsert đè** chỉnh sửa admin — áp dụng cho cả `CongPhap` như `Pill`; là công cụ reset, không routine.
- JSON `effects` phải **validate chặt** ở domain (`INVALID_CONGPHAP_CONFIG`) để tránh cấu hình rác lọt vào tính toán.
- Chiến lực & base thuộc tính là **balance mới** — số trong seed là khởi tạo, admin tinh chỉnh; không coi là chân lý.
- Công pháp chủ động ở phase này **cố ý không** ảnh hưởng thuộc tính/chiến lực; skill power chỉ lưu + hiển thị, sẵn sàng cho phase combat.
- `context7` trước khi dùng API Prisma (Json field, migrate) / Next.js / GSAP theo version pin.

## 8. Ngoài phạm vi (phase sau)
- Combat/chiến đấu thực tế (áp dụng skill power chủ động, chân nguyên cost, chém yêu/boss).
- Vật liệu nâng cấp dạng item, gacha/vòng quay công pháp, starter công pháp.
- Trọng số chiến lực cấu hình qua DB/admin (hiện là hằng domain).
