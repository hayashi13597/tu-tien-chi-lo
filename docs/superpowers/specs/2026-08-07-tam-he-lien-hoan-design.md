# Tam hệ liên hoàn: khuôn khổ liên kết Luyện Đan – Công Pháp – Bí Cảnh

## 1. Tóm tắt

Ba hệ thống luyện đan, công pháp, bí cảnh hiện đã tồn tại nhưng vận hành rời rạc: kinh tế một chiều (bí cảnh đổ nguyên liệu → luyện đan → buff tu luyện), không progression riêng cho từng hệ, không gating chéo, nội dung mỏng (3 công pháp, 8 đan) và thiếu chiều sâu "chuẩn bị".

Spec này là **master spec thuần thiết kế**: nó chỉ định nghĩa phần "keo dán" — bản đồ kinh tế khép kín, mô hình tier chung, progression track ba hệ và quy tắc gating chéo. Chi tiết triển khai từng hệ nằm trong ba spec con:

1. **Phase 1 — Luyện Đan 2.0**: Đan Sư Cấp, Đan Khí, Đan Lô, tỉ lệ thành công/phẩm chất, công thức tier 2–3.
2. **Phase 2 — Công Pháp 2.0**: tier công pháp, ba nhánh (Tu Luyện / Chiến Đạo / Đan Đạo), nội dung mở rộng, hook Bí Tịch.
3. **Phase 3 — Bí Cảnh 2.0**: tầng bí cảnh, gating cảnh giới + chiến lực, loadout đan dược, boss rơi Bí Tịch và Đan Hỏa Tủy.

Định hướng gameplay: **idle-first** — chiều sâu chiến thuật nằm ở chuẩn bị (build công pháp, loadout đan, chọn công thức) chứ không ở quyết định thời gian thực. Combat vẫn tự động và settle offline như hiện tại.

## 2. Mục tiêu và giới hạn

### Mục tiêu

- Khép kín vòng lặp kinh tế: mỗi hệ trong ba hệ đều vừa "cho" vừa "nhận", không còn dòng tài nguyên một chiều.
- Tạo progression riêng nhận diện được cho từng hệ (Đan Sư Cấp, tier công pháp, tầng bí cảnh) thay vì chỉ leo cảnh giới chính.
- Gating chéo làm người chơi buộc phải quay vòng giữa ba hệ: hệ A muốn lên cần output của hệ B và C.
- Định nghĩa một đơn vị tier chung để mọi gating chéo đọc từ một chỗ, admin dễ cân bằng.
- Chuẩn bị chỗ (hook) cho nội dung mới mà không phá catalog/cơ chế hiện có; migration chỉ additive.

### Không nằm trong phạm vi

- Chi tiết công thức, con số cân bằng, UI và API của từng phase (thuộc spec con).
- Combat realtime, minigame thủ công, PvP — trái định hướng idle-first.
- Hủy/refund hàng đợi luyện đan hay chuyến bí cảnh (giữ nguyên quyết định spec 2026-07-27).
- Nhiều lò luyện/nhiều chuyến bí cảnh đồng thời.
- Guild, gacha, linh thú, pháp bảo, leaderboard.
- Hệ `ItemDefinition` tổng quát thay thế `Pill`/`InventoryItem`/`OwnedCongPhap` (vẫn từ chối như spec 2026-07-27).

## 3. Bản đồ vòng lặp kinh tế khép kín

```text
                    ┌──────────────────────────────────────────────┐
                    │            TU LUYỆN (cảnh giới chính)         │
                    └──────┬───────────────────────────────▲────────┘
     mở tầng bí cảnh, +attr gốc → chiến lực               │ đan buff tốc độ,
                           │                               │ boost đột phá
                           ▼                               │
   ┌──────────────┐  nguyên liệu, linh thạch,      ┌──────┴───────┐
   │  BÍ CẢNH      │───────Bí Tịch, Đan Hỏa Tủy────▶│  LUYỆN ĐAN    │
   │ (tầng 1–3)    │                                 │(Đan Sư Cấp)   │
   └──────┬────────┘                                  └──────▲───────┘
          │  gate bởi chiến lực; hao tổn đan dược            │ buff success/tốc độ
          │  (loadout mang theo)                             │ từ nhánh Đan Đạo
          ▼                                                  │
   ┌──────────────┐    mở bằng cảnh giới + Bí Tịch drop ┌────┴──────────┐
   │  CÔNG PHÁP    │────────────────────────────────────▶│ nhánh Đan Đạo │
   │  (tier 1–3)   │    nhánh Chiến Đạo → chiến lực      └───────────────┘
   └──────────────┘
```

Bốn feedback loop được thêm so với trạng thái hiện tại:

1. **Đan Khí tự nuôi luyện đan**: mọi mẻ (kể cả hỏng) sinh Đan Khí → nâng Đan Sư/Đan Lô → success và tốc độ tốt hơn → luyện nhanh hơn/tốt hơn.
2. **Bí Tịch khép vòng bí cảnh ↔ công pháp**: công pháp mới chủ yếu mở bằng Bí Tịch rơi từ boss bí cảnh thay vì redeem code → chiến lực/đan đạo tăng → đi tầng cao hơn → rơi Bí Tịch cao hơn.
3. **Đan dược là tài nguyên tiêu hao của bí cảnh**: loadout đan trước khi xuất phát tạo sink mới cho đan → nuôi lại nhu cầu luyện đan → nuôi lại nhu cầu nguyên liệu từ bí cảnh.
4. **Cảnh giới gate cả ba hệ**: tầng bí cảnh, Đan Sư rank-up và công pháp tier cao đều yêu cầu mốc cảnh giới → ba hệ phụ quay vòng quanh trục tu luyện chính.

## 4. Mô hình tier chung

Một đơn vị **`tier: 1 | 2 | 3`** gắn vào catalog của cả ba hệ và map với cột mốc cảnh giới:

| Tier | Tên gọi | Mốc cảnh giới | Nội dung tương ứng |
|---|---|---|---|
| 1 | Phàm Giai | Luyện Khí → Trúc Cơ | Đan thường (8 viên hiện có), công pháp Nhất phẩm, bí cảnh tầng 1 |
| 2 | Linh Giai | Kết Đan → Nguyên Anh | 8 đan mới (hiệu ứng mạnh/nhóm combat), công pháp Trung phẩm (mở nhánh Đan Đạo), bí cảnh tầng 2 (rơi nguyên liệu Linh Giai, Bí Tịch Trung phẩm) |
| 3 | Thiên Giai | Hóa Thần trở lên | 8 đan cao cấp, công pháp Thượng phẩm, bí cảnh tầng 3, Đan Hỏa Tủy từ boss |

Quy tắc sử dụng:

- Mọi gating chéo trong ba spec con **phải** đọc `tier` + cảnh giới từ bảng chung này, không tự định nghĩa mốc riêng.
- Giá trị hiện có (8 đan, 3 công pháp, 8 nhánh) được gán `tier = 1` trong migration, giữ nguyên hành vi cho người chơi cũ.
- Admin chỉnh mốc qua catalog endpoints hiện có (mở rộng trong spec con), không hard-code trong domain ngoài giá trị seed.

## 5. Progression track từng hệ

### 5.1 Luyện đan — Đan Sư Cấp 1→9

- Tài nguyên progression: **Đan Khí**. Mọi mẻ hoàn tất đều sinh Đan Khí; thành công nhiều, hỏng ít; công thức tier cao cho nhiều hơn.
- Mỗi cấp tăng: +success% nền cho mọi công thức, −thời gian luyện, mở công thức tier cao hơn.
- Rank-up yêu cầu thêm: **cảnh giới tối thiểu** (theo tier mục tiêu) + vật phẩm đặc biệt **Đan Hỏa Tủy** (boss bí cảnh tầng 2+).
- **Đan Lô**: thực thể nâng cấp riêng, 5 cấp, nâng bằng Đan Khí + Linh Thạch; mỗi cấp +success% và −duration%. Vẫn giữ một lò, hàng đợi tuần tự.

### 5.2 Công pháp — tier + ba nhánh

- Giữ cơ chế level/hiệu ứng hiện có; thêm **tier** (1–3) và **nhánh**: Tu Luyện (buff idle/thu thập), Chiến Đạo (thuộc tính/kỹ năng combat), Đan Đạo (buff luyện đan).
- Nhận môn mới chủ yếu qua **Bí Tịch** rơi ở boss bí cảnh; redeem code chỉ còn vai trò quà tặng/sự kiện.
- 3 công pháp hiện có thuộc tier 1 (Nhất phẩm). Phase 2 thêm khoảng 9 môn trải ba nhánh/tier 2–3; số lượng chính xác do spec con quyết.

### 5.3 Bí cảnh — tầng 1–3 mỗi nhánh

- Mỗi nhánh có 3 tầng; unlock tầng N yêu cầu **cảnh giới tối thiểu** (theo tier) + **chiến lực đề xuất** (số do admin đặt).
- Tầng cao rơi nguyên liệu tier tương ứng, Bí Tịch tier tương ứng, Đan Hỏa Tủy (tầng 2+).
- **Loadout đan dược**: trước khi xuất phát chọn tối đa 2 đan vào 2 slot mới; đan combat auto kích hoạt trong mô phỏng theo trigger của từng loại.

## 6. Các quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Định hướng gameplay | idle-first: chiều sâu ở chuẩn bị, combat vẫn auto + settle offline |
| Kiến trúc progression | ba tuyến song song (Đan Sư / công pháp / tầng bí cảnh), gating chéo qua tier + cảnh giới |
| Đơn vị gating | `tier` 1–3 chung cho mọi catalog, map mốc cảnh giới bảng mục 4 |
| Success luyện đan | `clamp(base công thức + Đan Sư + Đan Lô + Đan Đạo, 5%..95%)`; thất bại mất nguyên liệu, hoàn 30% Linh Thạch và vẫn cho Đan Khí |
| Xuất sắc | trên mẻ thành công, 10% cho ×2 output |
| Số lò | vẫn một lò, queue tuần tự, không cancel/refund |
| Đan Lô | 5 cấp, nâng bằng Đan Khí + Linh Thạch |
| Công pháp mới | mở bằng Bí Tịch (boss bí cảnh); redeem chỉ làm quà |
| Loadout bí cảnh | tối đa 2 đan/slot mới, auto kích hoạt trong mô phỏng |
| Cột mốc tier 2/3 | tier 2: Kết Đan–Nguyên Anh; tier 3: Hóa Thần+ |
| Data model | chỉ additive; dữ liệu hiện có gán tier 1 |
| Tài liệu | mỗi phase một spec con + plan riêng trong `docs/superpowers/` |

## 7. Tác động data model (mức master)

Chỉ liệt kê khái niệm; field chính xác do spec con của từng phase chốt:

- `Material`, `Pill` (+`AlchemyRecipe`), `CongPhap`, `ExpeditionBranch`: thêm `tier`.
- `AlchemyRecipe`: thêm `minAlchemyRank`, `baseSuccessPct`.
- `CongPhap`: thêm nhánh (`tuLuyen | chienDao | danDao`).
- Bảng mới `AlchemyProfile` (theo user/character): `rank`, `danKhi`, `furnaceLevel`.
- Kết quả mô phỏng bí cảnh: mở rộng để ghi nhận buff từ loadout và drop Bí Tịch/Đan Hỏa Tủy.

Mọi migration phải additive, seed mới không được đổi hành vi catalog cũ (`tier = 1`).

## 8. Phân phase và phụ thuộc

| Phase | Spec con | Nội dung trung tâm | Phụ thuộc |
|---|---|---|---|
| 1 | Luyện Đan 2.0 | `AlchemyProfile`, Đan Khí, Đan Lô, success/phẩm chất, tier 2–3 công thức + nguyên liệu mới | — |
| 2 | Công Pháp 2.0 | tier + ba nhánh, ~9 công pháp mới, hook nhận Bí Tịch (chưa bật drop) | Phase 1 (Đan Đạo trỏ vào `AlchemyProfile`) |
| 3 | Bí Cảnh 2.0 | tầng 1–3, gate cảnh giới + chiến lực, loadout đan (cần đan combat từ Phase 1), boss drop Bí Tịch/Đan Hỏa Tủy (bật hook Phase 2) | Phase 1 + 2 |

Tiêu chí nghiệm thu chung của master spec: ba spec con triển khai xong thì người chơi mới từ Luyện Khí tới Hóa Thần phải tự nhiên đi qua vòng `bí cảnh → luyện đan → công pháp → bí cảnh tầng cao` mà không cần redeem code, và mọi timer/hàng đợi vẫn đúng khi offline.
