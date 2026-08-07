# Luyện Đan 2.0 — Đan Sư, Đan Khí, Đan Lô và tỉ lệ thành công (Phase 1 của Tam hệ Liên hoàn)

## 1. Tóm tắt

Biến luyện đan từ hàng đợi deterministic thành một hệ progression thật: người chơi tích **Đan Khí** từ mọi mẻ (kể cả hỏng), nâng **Đan Sư Cấp** và **Đan Lô** để tăng tỉ lệ thành công/giảm thời gian, và mở **công thức tier 2 (Linh Giai)** mạnh hơn. Đây là phase đầu của master spec `2026-08-07-tam-he-lien-hoan-design.md`; nó tự khép kín vòng `farm nguyên liệu → luyện → Đan Khí → luyện tốt hơn` mà không phụ thuộc Phase 2/3.

## 2. Mục tiêu và giới hạn

### Mục tiêu

- Mọi mẻ luyện hoàn tất đều sinh Đan Khí (thành công nhiều, hỏng ít), tạo progression riêng cho hệ luyện đan.
- Thêm tỉ lệ thành công/phẩm chất với công thức minh bạch, admin chỉnh được qua catalog recipe.
- Cảnh giới Kết Đan + Đan Sư cấp 4 là điều kiện mở công thức tier 2 — gating chéo đầu tiên theo master spec.
- 8 đan/nguyên liệu/công thức tier 2 mới có đường rơi ngay từ bí cảnh hiện có (bảng drop trọng số), không chờ tầng bí cảnh (Phase 3 sẽ cơ cấu lại).
- Giữ nguyên hành vi người chơi cũ: 8 công thức tier 1 giữ `baseSuccessPct = 100` (deterministic như hiện tại; xuất sắc ×2 là quy tắc mới, áp dụng thống nhất cho mọi tier), migration chỉ additive.

### Không nằm trong phạm vi

- Nội dung tier 3 (Thiên Giai): 8 đan/nguyên liệu/công thức + Đan Hỏa Tủy — để phase sau cùng Bí Cảnh 2.0.
- Công pháp Đan Đạo (Phase 2) — domain chỉ dựng hook `danDaoSuccessPct` tham số hóa, Phase 2 nối dây.
- Hủy/refund hàng đợi, nhiều lò (giữ quyết định cũ).
- Loadout đan trong bí cảnh (Phase 3).

## 3. Các quyết định đã chốt

### 3.1 Tỉ lệ thành công và phẩm chất

Mỗi đơn vị trong mẻ được settle roll độc lập:

```
successPct = clamp(baseSuccessPct + rankSuccess(rank) + furnaceSuccess(furnaceLevel) + danDaoPct, 5, 95)
roll #1 < successPct     → thành công; roll #2 < 10% → xuất sắc (×2 output cho đơn vị đó)
roll #1 ≥ successPct     → hỏng: không đan, hoàn floor(30% × linhThachCost), vẫn cho Đan Khí mức hỏng
```

- `baseSuccessPct >= 100` → luôn thành công (recipe deterministic, giữ đúng hành vi 8 công thức tier 1 hiện có; admin có thể opt-in deterministic). Với base < 100, clamp 5..95 áp dụng như trên.
- `danDaoPct` mặc định 0 (hook Phase 2). Tier 1 giữ baseSuccessPct 100 → không đổi hành vi cũ.
- Roll dùng `RandomSource` inject (đúng pattern expedition); production dùng nguồn ngẫu nhiên thật, test dùng constant.

### 3.2 Đan Khí (tài nguyên progression)

| Công thức | Thành công (mỗi đơn vị) | Hỏng (mỗi đơn vị) |
|---|---|---|
| tier 1 | 2 | 1 |
| tier 2 | 5 | 2 |
| tier 3 (dự trữ) | 10 | 4 |

Đan Khí cộng thẳng vào `AlchemyProfile.danKhi` trong cùng transaction settle (idempotent theo `outputGrantedAt`).

### 3.3 Đan Sư Cấp (rank 1..6 trong Phase 1)

| Rank | Success bonus | Giảm thời gian | Mở công thức | Chi phí thăng cấp (Đan Khí) | Gate cảnh giới |
|---|---|---|---|---|---|
| 1→2 | +3% | −2% | — | 100 | — |
| 2→3 | +6% | −4% | — | 300 | — |
| 3→4 | +9% | −6% | **tier 2** | 700 | realmMajor ≥ 3 (Kết Đan) |
| 4→5 | +12% | −8% | — | 1300 | — |
| 5→6 | +15% | −10% | — | 2100 | — |

Ranks 7–9 (tier 3, gate Hóa Thần + Đan Hỏa Tủy) chỉ vạch thiết kế, **không mở trong Phase 1** — sẽ kích hoạt cùng nội dung Thiên Giai; rank-up quá cấp 6 trả `ALCHEMY_RANK_LOCKED`.

Công thức: `rankSuccess(r) = (r−1)×3`, `rankSpeed(r) = (r−1)×2` (đơn vị %).

### 3.4 Đan Lô (level 1..5)

| Lên | Success bonus | Giảm thời gian | Đan Khí | Linh Thạch |
|---|---|---|---|---|
| 2 | +4% | −4% | 50 | 200 |
| 3 | +8% | −8% | 150 | 600 |
| 4 | +12% | −12% | 350 | 1400 |
| 5 | +16% | −16% | 700 | 3000 |

Công thức: `furnaceSuccess(f) = (f−1)×4`, `furnaceSpeed(f) = (f−1)×4` (đơn vị %).

### 3.5 Thời gian mẻ khi enqueue

`effectiveDurationSec = round(durationSec × (1 − (rankSpeed + furnaceSpeed)/100))`, clamp hệ số tối thiểu 0.5. Giảm tối đa hiện tại −26% (rank 6 + lò 5). Mẻ mới chạy nối tiếp `completesAt` mẻ trước như hiện tại — hệ số áp dụng khi tính `completesAt` lúc enqueue.

### 3.6 Gating công thức

- Recipe thêm `tier`, `minAlchemyRank`, `baseSuccessPct`. Tier 1: `minAlchemyRank = 1`, `baseSuccessPct = 100`.
- Enqueue nếu `profile.rank < recipe.minAlchemyRank` → `ALCHEMY_RANK_TOO_LOW` (409).
- `GET /alchemy/recipes` trả kèm `effectiveSuccessPct` tính theo profile người gọi (để UI hiển thị thật) và `locked` flag.

## 4. Nội dung tier 2 (seed mới, `active = true`)

### 4.1 Nguyên liệu (8, `tier = 2`, rarity 3)

| id | Tên | Vai trò |
|---|---|---|
| `nguyet-hoa-thao` | Nguyệt Hoa Thảo | linh thảo |
| `loi-minh-thach` | Lôi Minh Thạch | khoáng thạch |
| `huyet-long-sam` | Huyết Long Sâm | linh dược |
| `kim-sa-luc` | Kim Sa Lục | khoáng sản |
| `huyen-thiet-tam` | Huyền Thiết Tâm | khoáng sản |
| `ngoc-tuyet-tinh` | Ngọc Tuyết Tinh | bảo ngọc |
| `chu-tuoc-vu` | Chu Tước Vũ | linh vũ |
| `hoang-tuyen-thuy` | Hoàng Tuyển Thủy | linh dịch |

Đường rơi Phase 1: thêm vào `ExpeditionUpgradeMaterialWeight` của các nhánh với **weight thấp (0.2–0.4)** so với linh tài (1.0–1.5) — mỗi nhánh gắn 1–2 loại theo chủ đề; Phase 3 cơ cấu lại theo tầng.

### 4.2 Đan dược (8, `tier = 2`, dùng 4 effectKind hiện có)

| id | Tên | rarity | effectKind | Chỉ số |
|---|---|---|---|---|
| `hoan-khi-dan` | Hoàn Khí Đan | 2 | linhKhi | +800 |
| `hoan-linh-dan` | Hoàn Linh Đan | 3 | linhKhi | +3000 |
| `van-chuyen-kim-dan` | Vạn Chuyển Kim Đan | 4 | linhKhi | +6000 |
| `minh-tam-dan` | Minh Tâm Đan | 3 | cultivationBuff | ×2 / 300s |
| `hoa-than-dan` | Hóa Thần Đan | 4 | cultivationBuff | ×2.5 / 360s |
| `dinh-can-dan` | Định Căn Đan | 3 | breakthroughBoost | +25% |
| `cuu-thien-dan` | Cửu Thiên Đan | 4 | breakthroughBoost | +60% |
| `giai-kiep-dan` | Giải Kiếp Đan | 4 | clearPunishment | — |

### 4.3 Công thức (8, `tier = 2`, `minAlchemyRank = 4`)

Mỗi công thức: 2 nguyên liệu tier 2 (3 + 2) + 1 nguyên liệu tier 1 (2) — giữ giá trị cho nguyên liệu cũ.

| Output | Nguyên liệu | LT | Giây | baseSuccess% |
|---|---|---|---|---|
| hoan-khi-dan | nguyet-hoa-thao ×3 + loi-minh-thach ×2 + xich-viem-tinh ×2 | 60 | 7200 | 75 |
| minh-tam-dan | loi-minh-thach ×3 + huyet-long-sam ×2 + han-bang-ngoc ×2 | 75 | 9600 | 72 |
| dinh-can-dan | huyet-long-sam ×3 + kim-sa-luc ×2 + kiem-nguyen-thach ×2 | 90 | 10800 | 70 |
| hoan-linh-dan | kim-sa-luc ×3 + huyen-thiet-tam ×2 + thanh-moc-tinh ×2 | 90 | 10800 | 70 |
| giai-kiep-dan | huyen-thiet-tam ×3 + ngoc-tuyet-tinh ×2 + u-minh-thao ×2 | 80 | 9600 | 70 |
| hoa-than-dan | ngoc-tuyet-tinh ×3 + chu-tuoc-vu ×2 + van-hai-chau ×2 | 120 | 14400 | 65 |
| cuu-thien-dan | chu-tuoc-vu ×3 + hoang-tuyen-thuy ×2 + long-mach-sa ×2 | 120 | 14400 | 65 |
| van-chuyen-kim-dan | hoang-tuyen-thuy ×3 + nguyet-hoa-thao ×2 + tinh-than-hoa ×2 | 150 | 21600 | 60 |

## 5. Data model (Prisma, toàn additive)

```prisma
model AlchemyProfile {
  id           String    @id @default(uuid())
  userId       String    @unique
  characterId  String    @unique
  rank         Int       @default(1)   // 1..6 phase 1 (7-9 locked)
  danKhi       Int       @default(0)
  furnaceLevel Int       @default(1)   // 1..5
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  character    Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
}
```

- `Material.tier Int @default(1)`, `Pill.tier Int @default(1)`.
- `AlchemyRecipe`: `tier Int @default(1)`, `minAlchemyRank Int @default(1)`, `baseSuccessPct Int @default(100)`.
- `AlchemyJob`: `successCount Int @default(0)`, `failCount Int @default(0)`, `critCount Int @default(0)` — settle ghi vào đây cùng `outputGrantedAt` để UI báo kết quả.
- Không backfill: profile được **lazy-create** trong transaction đầu tiên đọc/ghi profile của user (get-or-create).

## 6. Kiến trúc và module

### Domain (framework-free)

- `alchemy.profile.ts` (mới): `AlchemyProfileRecord`, bảng hằng `RANK_TABLE`, `FURNACE_TABLE`, `DAN_KHI_BY_TIER`, `MAX_RANK_PHASE1 = 6`.
- `alchemy.calc.ts` mở rộng:
  - `computeSuccessPct({ basePct, rank, furnaceLevel, danDaoPct? })` → clamp 5..95.
  - `computeDurationSec({ durationSec, rank, furnaceLevel })` → clamp factor 0.5.
  - `rollJobOutcome(quantity, successPct, random)` → `{ successCount, failCount, critCount, grantQuantity }` (crit x2 tính vào grantQuantity).
  - `danKhiForJob(tier, successCount, failCount)`.
  - `canRankUp(profile, realmMajor, now)` / `rankUpCost(targetRank)` / `furnaceUpgradeCost(targetLevel)`.
  - `settleAlchemyQueue` nhận thêm `{ profiles: Map<userId, profile>, random }` → settlement trả thêm `danKhiGrants`, `linhThachRefunds`, `jobOutcomes`; vẫn idempotent theo `outputGrantedAt`.
- `validateRecipe` mở rộng: `tier 1..3`, `minAlchemyRank` hợp lệ theo tier (t2→4, t3→7), `baseSuccessPct` 5..100; công thức tier 1 vẫn pass với giá trị default.

### Application

- `GetAlchemyProfileUseCase` (mới): get-or-create profile + trả cost/gate của bước tiếp theo.
- `RankUpAlchemyUseCase` (mới): kiểm Đan Khí, gate cảnh giới, `ALCHEMY_RANK_LOCKED` nếu > 6; độc lập transaction, optimistic theo profile.
- `UpgradeFurnaceUseCase` (mới): kiểm Đan Khí + Linh Thạch, trừ nguyên trong một transaction.
- `QueueAlchemyUseCase` sửa: enforce `minAlchemyRank`, dùng `computeDurationSec`.
- `ListAlchemyRecipesUseCase` sửa: nhận userId, trả `effectiveSuccessPct` + `locked`.
- `RegisterUserUseCase`: không đổi (profile lazy).

### Ports / Infra

- `AlchemyRepository` thêm `getOrCreateProfile(tx-scoped user lookup)`, `rankUp`, `upgradeFurnace`; `settleInTransaction` nạp profile + roll outcomes + cộng Đan Khí/refund LT/upsert đan trong cùng Serializable tx.
- `PrismaAlchemyRepository` map các field mới; production `RandomSource` dùng implementation hiện có của expedition (hoặc `Math.random` wrapper cùng thư mục).

### Presentation

- Mới: `GET /alchemy/profile`, `POST /alchemy/rank-up`, `POST /alchemy/furnace/upgrade`.
- Sửa: `GET /alchemy/recipes` (có auth — đã requireAuth), `POST /alchemy/queue` (lỗi mới `ALCHEMY_RANK_TOO_LOW` 409).
- Error code mới: `ALCHEMY_RANK_TOO_LOW`, `ALCHEMY_RANK_LOCKED`, `ALCHEMY_RANK_INVALID`, `INSUFFICIENT_DAN_KHI` (402-payment không dùng; 409).

### Admin

- `PUT /admin/alchemy/recipes`: schema thêm `tier`, `minAlchemyRank`, `baseSuccessPct` (có default, validate domain).
- `PUT /admin/materials`, `/admin/pills` editors: thêm input `tier` (số 1..3).

## 7. Frontend

- `lib/types.ts`: DTO mở rộng (`tier`, `minAlchemyRank`, `baseSuccessPct`, `effectiveSuccessPct`, `locked`, `successCount/failCount/critCount` trên job), thêm `AlchemyProfileDTO`.
- `lib/api.ts`: `fetchAlchemyProfile`, `rankUpAlchemy`, `upgradeFurnace`.
- `use-alchemy-queue.ts`: fetch kèm profile; expose `rankUp()`, `upgradeFurnace()`.
- `alchemy-drawer.tsx`: header mới (Cấp Đan Sư + Đan Khí + Đan Lô, nút Thăng Cấp/Nâng Lò hiển thị cost và trạng thái đủ/không đủ), recipe row hiển thị `effectiveSuccessPct` + badge tier + trạng thái khóa (rank thấp thì disable + tooltip yêu cầu).
- `alchemy-card.tsx`: chip nhỏ "Đan Sư cấp N".
- Toast kết quả settle: khi thấy job mới complete → "Hoàn thành mẻ X: thành công a, xuất sắc b, hỏng c".
- `expedition-display.ts` `canQueueAlchemy`: thêm điều kiện rank.

## 8. Backend tests

- Unit `alchemy.calc`: success clamp biên, duration giảm đúng/không dưới 50%, roll outcome với `ConstantRandom` (100% case, 0% case, crit 10%), danKhi cộng đúng tier, settle idempotent (gọi 2 lần không grant lần 2), rank-up gate Kết Đan, `ALCHEMY_RANK_LOCKED` 6→7.
- Unit use case: Queue từ chối rank thấp; RankUp/US đủ/không đủ Đan Khí; Furnace đủ/thiếu Linh Thạch.
- Integration: `GET /alchemy/profile` lazy-create; enqueue tier 2 với rank 4; settle cộng đanKhí + refund 30% khi fail (constant random fail); count inventory đúng grantQuantity có crit.
- `prisma-schema.test.ts`: model/cột mới tồn tại với default đúng.
- Frontend: test pure cho `formatDuration` có giảm, hàm locked/canQueue, mapping DTO.

## 9. Nghiệm thu

1. Người chơi cũ (chưa có profile) mở lò: profile rank 1 tự tạo, 8 công thức cũ y nguyên hành vi (100% thành công).
2. Luyện xong mẻ: Đan Khí tăng đúng bảng; toast phân tách thành công/hỏng/xuất sắc; không grant lặp khi refresh.
3. Rank 3 + đủ 700 ĐK nhưng chưa Kết Đan → nút thăng cấp báo thiếu cảnh giới; sang Kết Đan → thăng được → mở công thức tier 2 với success% hiển thị theo rank+lò.
4. Mẻ tier 2 hỏng: không có đan, Linh Thạch hoàn 30%, Đan Khí vẫn cộng.
5. Admin chỉnh `baseSuccessPct` recipe qua `/admin/alchemy` lưu được và ảnh hưởng enqueue/settle sau đó.
