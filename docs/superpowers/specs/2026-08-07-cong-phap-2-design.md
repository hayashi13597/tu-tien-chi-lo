# Phase 2 — Công Pháp 2.0: tier, ba nhánh, Bí Tịch

> Spec con của `2026-08-07-tam-he-lien-hoan-design.md`. Triển khai sau khi Phase 1 (Luyện Đan 2.0) đã hoàn tất trên nhánh `feat/tam-he-lien-hoan`.

## 1. Tóm tắt

Thêm trục progression cho hệ công pháp: mỗi môn có `tier` (1–3) và `branch` (`tuLuyen | chienDao | danDao`), 9 môn mới ở tier 2 trải đều ba nhánh, hai loại hiệu ứng hệ thống mới (`linhKhiRate` nhân tốc độ tu luyện, `danDaoSuccess` cộng điểm % luyện đan), và đường học môn qua vật phẩm **Bí Tịch** (Material tier 2) + Linh Thạch, gate theo cảnh giới. Drop Bí Tịch thực tế thuộc Phase 3; Phase 2 dựng hook và phát Bí Tịch tạm qua redeem/gift.

## 2. Mục tiêu và giới hạn

### Mục tiêu

- Công pháp trở thành một progression track đọc từ `tier` chung (mục 4 master spec) — nhất quán với luyện đan.
- Nhánh Tu Luyện và Đan Đạo tạo hai feedback loop mới (tăng tốc tu luyện chính; tăng success luyện đan) thay vì chỉ buff thuộc tính.
- Học môn gắn vào vật phẩm Bí Tịch để Phase 3 chỉ cần bật drop (wire `increment` inventory), không động lại kiến trúc.
- Migration additive; 3 môn cũ giữ nguyên hành vi.

### Không nằm trong phạm vi

- Drop Bí Tịch từ boss / tầng bí cảnh (Phase 3).
- Áp dụng `powerPerLevel` của công pháp chủ động vào combat (đã hoãn từ spec 2026-07-27, vẫn hoãn; `thien-loi-chi` mới cũng chỉ lưu/hiển thị).
- Giới hạn số môn bị động được áp dụng (mọi passive sở hữu đều áp dụng — như hiện tại).
- Nội dung tier 3 (Thượng phẩm) — chỉ dựng khung `tier`/gating, catalog tier 3 để phase sau.

## 3. Các quyết định đã chốt (brainstorming)

| # | Chủ đề | Quyết định |
|---|---|---|
| Q1 | Mô hình hiệu ứng mới | Mở rộng `PassiveEffect` (union key), một mảng `effects` duy nhất |
| Q2 | Đường học môn mới | Bí Tịch là item vật lý; Phase 2 phát qua redeem/gift, Phase 3 bật drop |
| Q3 | Hình thái Bí Tịch | Tái dùng bộ `Material`/`MaterialInventory` (id `bi-tich-*`, tier 2) |
| Q4 | Công thức học | 1 Bí Tịch tương ứng + 300 Linh Thạch (môn tier 2) |
| Q5 | Gating học môn | `minRealmMajor` theo tier (tier 2 → 3 = Kết Đan, tier 3 → 5 = Hóa Thần) |
| Q6 | Cấu trúc union key | `attribute: keyof AttributeSet \| 'linhKhiRate' \| 'danDaoSuccess'`; key đặc biệt bắt buộc `flatPerLevel = 0`, `pctPerLevel > 0` |
| Q7 | Phạm vi áp dụng | Mọi passive của môn đã sở hữu đều áp dụng; không thêm slot |
| Q8 | Điểm tiêu thụ buff | `danDaoSuccess` cộng điểm % vào `computeSuccessPct` (hook sẵn); `linhKhiRate` nhân `(1 + pct/100)` vào `cultivationRate` trước khi tích lũy, không động vào pill buff |

## 4. Data model

### 4.1 Schema Prisma (1 migration additive)

`CongPhap` thêm bốn cột:

```prisma
model CongPhap {
  // ... giữ nguyên cột cũ
  tier             Int       @default(1)
  branch           String?   // "tuLuyen" | "chienDao" | "danDao"; null = không thuộc nhánh
  minRealmMajor    Int       @default(0) // 0 = không gate; giữ hành vi môn cũ
  biTichMaterialId String?   // FK → Material; null = học không cần Bí Tịch (môn cũ/redeem-only)
  biTichMaterial   Material? @relation("CongPhapBiTichMaterial", fields: [biTichMaterialId], references: [id])

  @@index([tier, branch])
}

model Material {
  // ... giữ nguyên cột cũ
  biTichCongPhaps CongPhap[] @relation("CongPhapBiTichMaterial")
}
```

- `realmMajor` là 0-based: Phàm Nhân=0, Luyện Khí=1, Trúc Cơ=2, **Kết Đan=3**, Nguyên Anh=4, **Hóa Thần=5** (đọc từ `RealmConfigSet`, không hard-code tên).
- Giá trị mặc định (tier 1, branch null, minRealmMajor 0, biTich null) giữ nguyên hành vi cho 3 môn cũ và mọi môn admin đã tạo.
- Backfill trong migration: 3 môn hiện có gán `branch = 'chienDao'` (chúng buff thuộc tính/chiến đấu); nhánh Tu Luyện/Đan Đạo chỉ xuất hiện từ tier 2 — khớp master spec.

### 4.2 Domain record

`CongPhapRecord` thêm: `tier: number`, `branch: CongPhapBranch | null`, `minRealmMajor: number`, `biTichMaterialId: string | null`, với `export type CongPhapBranch = 'tuLuyen' | 'chienDao' | 'danDao'`.

### 4.3 Bí Tịch

9 material tier 2, `id: 'bi-tich-' + <hậu tố môn>`, `rarity: 4`, `active: true`, desc dạng "Bí tịch cổ ghi lại <tên môn>…". Không gán `branchAlchemyMaterial` (không rơi từ expedition; Phase 3 boss dùng bảng drop riêng).

## 5. Mechanics

### 5.1 Union key hiệu ứng

```ts
// attributes/attributes.calc.ts
export type EffectAttribute = keyof AttributeSet | 'linhKhiRate' | 'danDaoSuccess';
export interface PassiveEffect { attribute: EffectAttribute; flatPerLevel: number; pctPerLevel: number; }
```

- Validate (`congphap.validate.ts`): key thuộc `AttributeSet` → rule cũ; key đặc biệt → `flatPerLevel === 0 && pctPerLevel > 0`.
- `computeAttributes(base, passives)` giữ nguyên signature và kết quả `{base, final}` (key đặc biệt bị bỏ qua ở đây vì `OwnedPassive.effects` của chúng không thuộc `AttributeSet`). Thêm hàm riêng trong `attributes.calc.ts`:
  ```ts
  export function sumSystemBuffs(passives: { level: number; effects: PassiveEffect[] }[]): { linhKhiRatePct: number; danDaoSuccessPct: number }
  ```
  gom `pctPerLevel × level` cho hai key đặc biệt. Tách hàm thay vì đổi shape `computeAttributes` để call-site cũ không động vào.

### 5.2 Học môn qua Bí Tịch

Endpoint mới `POST /cong-phap/:id/learn`:

1. Tải `CongPhap` (kèm check `active = true`; môn không có `biTichMaterialId` → 400 `CONGPHAP_NOT_LEARNABLE` — môn cũ chỉ học qua redeem).
2. `realmMajor >= minRealmMajor` else `CONGPHAP_REALM_GATE` (409).
3. Serializable tx: guard Bí Tịch `updateMany … where quantity >= 1` (count 0 → `CONGPHAP_MISSING_BITICH` 409), guard Linh Thạch `>= 300` (count 0 → `INSUFFICIENT_LINH_THACH` 409), `create OwnedCongPhap level 1` (P2002 → `CONGPHAP_ALREADY_OWNED` 409); `runSerializable` map P2034 → `CONCURRENT_MODIFICATION` 409.
4. Redeem/grant giữ nguyên: grant trực tiếp `OwnedCongPhap`, **không** tiêu thụ Bí Tịch/Linh Thạch (vai trò quà). Admin `GrantUseCase` không đổi.

### 5.3 Tiêu thụ buff

- **Tu Luyện**: mọi nơi đọc `cultivationRate` cho nhân vật (lazy recompute trong `computeLinhKhi` call-sites — `GetCultivationStateUseCase`, đột phá, v.v.) nhân `rate × (1 + linhKhiRatePct/100)`. Pill `cultivationBuff` vẫn nhân riêng qua `buff.multiplier` như hiện tại (nhân chồng, không cộng).
- **Đan Đạo**: `GetAlchemyProfileUseCase`/preview + settle đọc `sumSystemBuffs(owned).danDaoSuccessPct`, truyền vào `computeSuccessPct(tier, recipe, rank, furnace, danDaoPct)` — tham số hook đã tồn tại từ Phase 1, chỉ nối dây. Quy tắc `base >= 100 → 100%` và clamp 5..95 không đổi.
- **Chiến Đạo**: dùng đường attribute cũ (không code mới ngoài validate).

## 6. Nội dung seed tier 2 (Linh Giai, `minRealmMajor = 3`, `maxLevel = 10`)

Material nâng cấp mới (tier 2, rarity 3): `linh-tai-tu-luyen`, `linh-tai-dan-dao`.

| Môn | Tên | Glyph | Nhánh | Loại | Hiệu ứng | baseCost/Growth | Material nâng cấp | Bí Tịch |
|---|---|---|---|---|---|---|---|---|
| `vong-coc-quyet` | Vong Cốc Quyết | 忘 | tuLuyen | passive | linhKhiRate +2%/lv (max +20%) | 300 / 1.6 | linh-tai-tu-luyen (3, ×1.6) | bi-tich-vong-coc |
| `tieu-chu-thien-cong` | Tiểu Chu Thiên Công | 周 | tuLuyen | passive | linhKhiRate +3%/lv (max +30%) | 400 / 1.6 | linh-tai-tu-luyen (3, ×1.6) | bi-tich-tieu-chu-thien |
| `dai-chu-thien-cong` | Đại Chu Thiên Công | 天 | tuLuyen | passive | linhKhiRate +5%/lv (max +50%) | 500 / 1.6 | linh-tai-tu-luyen (4, ×1.6) | bi-tich-dai-chu-thien |
| `kim-cang-the` | Kim Cang Thể | 金 | chienDao | passive | khiHuyet +200 flat/lv; phongThu +5%/lv | 350 / 1.6 | linh-tai-khi-huyet (3, ×1.6) | bi-tich-kim-cang |
| `ngu-kiem-thuat` | Ngự Kiếm Thuật | 剑 | chienDao | passive | congVatLy +8%/lv | 400 / 1.6 | linh-tai-hoa-luc (3, ×1.6) | bi-tich-ngu-kiem |
| `thien-loi-chi` | Thiên Lôi Chỉ | 雷 | chienDao | active | power 250/lv, chanNguyen 40, cooldown 3 | 450 / 1.6 | linh-tai-hoa-luc (4, ×1.6) | bi-tich-thien-loi |
| `dieu-hoa-tan-quyet` | Điều Hỏa Tán Quyết | 炭 | danDao | passive | danDaoSuccess +1%/lv (max +10%) | 300 / 1.6 | linh-tai-dan-dao (3, ×1.6) | bi-tich-dieu-hoa |
| `ninh-dan-kinh` | Ngưng Đan Kinh | 凝 | danDao | passive | danDaoSuccess +1.5%/lv (max +15%) | 400 / 1.6 | linh-tai-dan-dao (3, ×1.6) | bi-tich-ninh-dan |
| `van-linh-lo-quyet` | Vạn Linh Lô Quyết | 炉 | danDao | passive | danDaoSuccess +2%/lv (max +20%) | 500 / 1.6 | linh-tai-dan-dao (4, ×1.6) | bi-tich-van-linh-lo |

Ngân sách cộng dồn tối đa khi sở hữu full: Tu Luyện +100% tốc độ tu luyện (×2); Đan Đạo +45% (clamp 95% của `computeSuccessPct` tự xử). `dupRefundLinhThach`: null (mặc định = baseCost) cho tất cả. Học: 1 Bí Tịch + 300 Linh Thạch mỗi môn.

## 7. API, admin, frontend

- `GET /cong-phap`: mỗi entry thêm `tier`, `branch`, `minRealmMajor`, `biTichMaterialId`, `biTichOwned` (số Bí Tịch user đang có; 0 nếu môn không cần). Shape cũ không đổi (additive field).
- `GET /cong-phap`: ngoài field theo môn ở trên, response thêm top-level `system: { linhKhiRatePct, danDaoSuccessPct }` (kết quả `sumSystemBuffs` trên mọi môn user sở hữu) để drawer/breakdown đọc từ một chỗ; payload `attributes` của endpoint nhân vật giữ nguyên shape.
- `POST /cong-phap/:id/learn`: 200 `{ owned }`; lỗi: 400 `CONGPHAP_NOT_LEARNABLE`, 404 môn không tồn tại, 409 `CONGPHAP_REALM_GATE | CONGPHAP_MISSING_BITICH | INSUFFICIENT_LINH_THACH | CONGPHAP_ALREADY_OWNED | CONCURRENT_MODIFICATION`. Rate-limit như các mutation endpoint hiện có.
- **Admin**: CongPhap editor thêm 4 field mới (tier select 1–3, branch select + trống, minRealmMajor int ≥ 0, biTichMaterialId select Material). Validation admin: `tier ∈ 1..3`; tier ≥ 2 ⇒ branch và biTich bắt buộc; gợi ý default minRealmMajor theo tier (1→0, 2→3, 3→5) nhưng cho sửa. `validateCongPhap({...record, active: true})` khi lưu (pattern recipe từ Phase 1) để sửa được môn đang tắt. Bí Tịch quản qua Materials editor sẵn có.
- **Frontend player**: drawer công pháp group theo nhánh (Tu Luyện / Chiến Đạo / Đan Đạo; môn branch null vào mục chung). Môn tier 2 chưa học hiển thị mờ + nút "Học · 1 Bí Tịch + 300 LT" disabled kèm `<small class="alchemy-recipe-lock">` lý do (thiếu cảnh giới `<tên cảnh giới>` / thiếu Bí Tịch / thiếu Linh Thạch) — pattern Phase 1. Breakdown popup thêm hai dòng: "Tốc độ tu luyện +x%", "Hiệu suất luyện đan +y%" (ẩn khi bằng 0). Toast success "Đã học <tên môn>".
- **Redeem**: không đổi; admin gắn `bi-tich-*` như reward vật phẩm ngay (đã là Material).

## 8. Error handling & concurrency

| Code | HTTP | Khi |
|---|---|---|
| `CONGPHAP_NOT_LEARNABLE` | 400 | môn không có biTichMaterialId (chỉ học qua redeem) |
| `CONGPHAP_REALM_GATE` | 409 | realmMajor < minRealmMajor |
| `CONGPHAP_MISSING_BITICH` | 409 | không đủ 1 Bí Tịch trong kho |
| `INSUFFICIENT_LINH_THACH` | 409 | không đủ 300 LT |
| `CONGPHAP_ALREADY_OWNED` | 409 | đã sở hữu (P2002) |
| `CONCURRENT_MODIFICATION` | 409 | P2034 tx conflict |

- Trừ Bí Tịch/Linh Thạch bằng `updateMany` có guard `gte` trong một Serializable tx — không có đường race "check rồi trừ".
- `GET /cong-phap` là read-only (không lazy-create gì). Không có timer mới; buff Tu Luyện tác động lazy recompute sẵn có nên đúng khi offline (không cần persist).

## 9. Tiêu chí nghiệm thu

1. Migration additive, `prisma migrate deploy` trước deploy; 3 môn cũ + mọi owned giữ nguyên hành vi (test diff snapshot trước/sau seed).
2. Người chơi Kết Đan (major 3) có 1 `bi-tich-dieu-hoa` + ≥300 LT học được `dieu-hoa-tan-quyet`: `POST /learn` 200, kho trừ đúng, gọi lại → `CONGPHAP_ALREADY_OWNED`.
3. Các nhánh lỗi đúng mã: thiếu cảnh giới / thiếu Bí Tịch / thiếu LT / môn redeem-only → đúng 4xx tương ứng; hai request learn đồng thời chỉ 1 thành công (cái còn lại 409).
4. Sở hữu `dieu-hoa-tan-quyet` cấp 5 → preview recipe tier 2 tăng đúng +5 điểm % so với trước khi học (và clamp 95 vẫn giữ).
5. Sở hữu `vong-coc-quyet` cấp 10 → tốc độ tích lũy linh khí ×1.2, kể cả khi recompute offline; pill buff vẫn nhân chồng độc lập.
6. `computeAttributes` giữ nguyên kết quả `{base, final}` cho catalog cũ (không drift); `sumSystemBuffs` trả 0/0 khi chưa sở hữu môn nhánh mới.
7. Admin tạo/sửa môn tier 2 mới không cần đổi code; validation chặn tier ≥ 2 thiếu branch/biTich và key đặc biệt sai hình (`flatPerLevel ≠ 0`).
8. Seed idempotent: chạy lại seed không đổi dữ liệu admin đã chỉnh ngoài catalog reset (giữ semantic upsert hiện có).
9. Backend `npm test` xanh, frontend `pnpm test`/`lint`/`build` xanh.

## 10. Phụ thuộc và bước tiếp theo

- Phụ thuộc: Phase 1 (`AlchemyProfile`, hook `computeSuccessPct(..., danDaoPct)`), bảng `MaterialInventory`, redeem reward vật phẩm.
- Sau Phase 2: Phase 3 (Bí Cảnh 2.0) bật drop `bi-tich-*` ở boss tầng 2+, khi đó gỡ phát tặng định kỳ qua redeem nếu muốn.
