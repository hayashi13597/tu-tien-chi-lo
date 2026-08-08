# Rank Đan Sư 7–9 (Thiên Giai) — Design Spec

Ngày: 2026-08-07 · Nhánh: `feat/tam-he-lien-hoan` · Spec cha: `2026-08-07-luyen-dan-2-design.md` (Phase 1), `2026-08-07-tam-he-lien-hoan-design.md`

## 1. Bối cảnh & quyết định

Phase 1 mở tới cấp 6 (`MAX_RANK = 6`) và đã chừa hook: comment "rank 7–9 gate Hóa Thần + Đan Hỏa Tủy (vật phẩm boss bí cảnh tầng 2+)". Phase 3 đã có `dan-hoa-tuy` rơi từ boss tầng 2 (weight 0.3) / tầng 3 (weight 0.5) — chỉ tích lũy, chưa tiêu thụ. Mảnh này khép nốt mechanics.

Quyết định (đã chốt qua brainstorming):

| # | Vấn đề | Quyết định |
|---|---|---|
| Q1 | Gate cảnh giới | Cả rank 7/8/9 đều **Hóa Thần (realmMajor 5)**. Sửa comment sai Phase 1 (`Hóa Thần = 6` → thực tế `= 5`; gate `7: 6` trong `RANK_REALM_GATES` chưa từng chạy vì MAX_RANK=6) |
| Q2 | Đan Hỏa Tủy | **1 quả mỗi cấp** (tổng 3) |
| Q3 | Đan Khí | **3100 / 4300 / 5700** (tiếp tục quy luật diff +200: 100/300/700/1300/2100 → +1000/+1200/+1400) |

## 2. Thay đổi

**Domain** (`domain/alchemy/alchemy.profile.ts`):
- `MAX_RANK = 9`; `RANK_UP_COSTS` thêm `{7: 3100, 8: 4300, 9: 5700}`; `RANK_REALM_GATES = {4: 3, 7: 5, 8: 5, 9: 5}`; mới `RANK_DAN_HOA_TUY_COSTS: {7: 1, 8: 1, 9: 1}`.
- `rankUpCheck(profile, targetRank, realmMajor, danHoaTuyOwned = 0)`: thứ tự kiểm — rank target (400) → rank locked > MAX_RANK (409, message "Đan Sư đã đạt cấp tối đa 9") → realm gate (409, message mang `realmMajor` đúng giá trị gate, bỏ hardcode "Kết Đan") → Đan Khí (409) → Đan Hỏa Tủy (`RANK_DAN_HOA_TUY_COSTS[targetRank]`; thiếu → `ALCHEMY_MISSING_DAN_HOA_TUY` 409, message "cần N Đan Hỏa Tủy — rơi từ boss bí cảnh tầng 2+").
- Công thức buff giữ nguyên: `rankSuccessPct = (rank-1)*3`, `rankSpeedPct = (rank-1)*2` → rank 9: +24% success, +16% tốc; clamp 95/successPct logic không đổi.

**Repo** (`PrismaAlchemyRepository.rankUp`): bọc transaction serializable — (a) `alchemyProfile.updateMany` guard `{rank: target-1, danKhi: gte}` → `INSUFFICIENT_DAN_KHI`; (b) nếu `danHoaTuyCost > 0`: `materialInventory.updateMany` guard `{materialId: 'dan-hoa-tuy', quantity: gte}` → `ALCHEMY_MISSING_DAN_HOA_TUY`; P2034 → `CONCURRENT_MODIFICATION` (quy ước repo hiện có).

**Application**:
- `RankUpAlchemyUseCase`: +dep `MaterialRepository`; preflight đọc tồn kho `dan-hoa-tuy` rồi `rankUpCheck(..., owned)`; gọi repo với đủ 2 cost.
- `GetAlchemyProfileUseCase`: `nextRank` thêm `danHoaTuyCost: number`, `danHoaTuyOwned: number`, `affordableDanHoaTuy: boolean`.
- Error mapping: `ALCHEMY_MISSING_DAN_HOA_TUY: 409` ở errorHandler.

**Frontend**:
- Types: `AlchemyProfileDTO.nextRank` thêm 3 field trên.
- `alchemy-drawer` header nút rank-up: cấp 7+ hiện "ĐK {cost} + Tủy ×1 (có {owned})"; disable + hint khi thiếu Tủy hoặc chưa Hóa Thần; sửa nhãn cũ ám chỉ "cấp 7–9 mở phase sau" (nếu có trong drawer/profile text) → cap mới ở 9 ("Đã đạt cấp tối đa 9").

**Không đổi**: `MAX_RANK` ở những chỗ khác dùng compute/formula; `furnace` max 5 giữ nguyên; migration: **không cần** (không schema mới — Đan Hỏa Tủy là Material đã seed).

## 3. Testing & acceptance

1. Domain `rankUpCheck`: target ≠ rank+1 → `ALCHEMY_RANK_INVALID`; > 9 → `ALCHEMY_RANK_LOCKED`; 7 với realmMajor 4 → `ALCHEMY_REALM_GATE`; đủ realm nhưng thiếu ĐK → `INSUFFICIENT_DAN_KHI`; đủ ĐK nhưng 0 Tủy → `ALCHEMY_MISSING_DAN_HOA_TUY`; đủ hết → pass. Rank 1–6 hành vi cũ y nguyên (Tủy cost 0).
2. Repo integration: profile rank 6 + đủ ĐK + Tủy 1 → rank 7, Tủy 0; Tủy 0 → 409 + rollback (ĐK không trừ).
3. Route: POST /alchemy/rank-up ở rank 6: thiếu Tủy → 409 code đúng; đủ → 200 rank 7.
4. GET profile rank 6: `nextRank` = {target: 7, danKhiCost: 3100, realmGateMajor: 5, danHoaTuyCost: 1, ...}.
5. FE: tsc/lint/test/build sạch; nút rank 9 hiện cap.
6. Suites: backend `npm test` + build xanh; frontend test + lint + tsc + build xanh.

## 4. Out of scope

- Recipe Tier 3 (Thiên Giai) + Đan Hỏa Tủy làm nguyên liệu luyện — content sau.
- Cân bằng tỉ lệ drop Đan Hỏa Tủy (admin chỉnh được).
