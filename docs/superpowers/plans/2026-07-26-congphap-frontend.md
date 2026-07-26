# Công Pháp & Thuộc tính — Frontend Implementation Plan

**Goal:** Đưa hệ công pháp + 6 thuộc tính (đã xong backend) lên UI: thuộc tính/Chiến lực/Linh Thạch trong Tu Hành Bảng, modal Công Pháp (4 slot chủ động + bị động + nâng cấp), trang admin `/admin/congphap` + cấp thưởng, và 6 ô base thuộc tính trong `/admin/realms`.

**Spec:** `docs/superpowers/specs/2026-07-24-congphap-attributes-design.md` mục 5 (người chơi) + 6 (admin).

**Quyết định đã chốt với người dùng:**
- Thuộc tính **gộp vào Tu Hành Bảng** (`StatsPanel`), không tách panel riêng.
- Admin chọn người chơi qua **`GET /admin/users` mới** (search theo username) — chấp nhận phát sinh việc backend.

## Global Constraints

- **Server-authoritative.** Mọi thay đổi đi qua POST rồi refetch; FE chỉ mirror công thức để hiển thị, không tự quyết.
- **Layering FE:** `lib/` (thuần, không framework) → `hooks/` → `components/` → `app/`. Test chỉ cho pure logic (`environment: "node"`, `include: src/**/*.test.ts`); UI động = human-observation gate.
- **Backend giữ Clean Architecture** cho phần bổ sung: domain port → use case → infra → presentation, `errorHandler` là nguồn duy nhất map lỗi.
- **Biome a11y**: backdrop overlay phải là `<button>`, không dùng `role="switch"`.
- **`ctx7` trước khi dùng API thư viện** (Next.js 16, GSAP 3.15, zod) theo version pin.
- **Commit tiếng Việt, KHÔNG kèm trailer Co-Authored-By.**
- **Cập nhật `CLAUDE.md`** (core facts + test counts) sau khi xong.
- Gate cuối: `pnpm lint` + `npx tsc --noEmit` + `pnpm test` + `pnpm build` (frontend), `npm test` (backend).

## Gotcha đã phát hiện khi khảo sát

1. **`CongPhap.rarity` là `Int` không chặn khoảng**, trong khi `RARITY_META` chỉ có 0–4 → cần accessor clamp (`getCongPhapRarityMeta`) nếu không sẽ `undefined.color` khi admin đặt rarity 7.
2. **`RedeemRewardDTO` FE đang khai `pillId`** nhưng backend giờ trả `{ kind, id, name, glyph, quantity }` → type đang nói dối, phải sửa.
3. **Admin chưa tạo được code thưởng công pháp/Linh Thạch**: `redeem.schemas.ts` (backend) mới chỉ nhận `pillId`, dù DB + use case đã hỗ trợ 3 loại. Không sửa thì "nguồn công pháp = redeem code" trong spec không dùng được qua UI.
4. **`owned` có thể chứa def `active: false`** (backend cố ý giữ) → UI phải hiện "đã vô hiệu" và chặn nâng/trang bị.

---

## Task 1: Backend — `GET /admin/users` (chọn người chơi để cấp thưởng)

**Files:**
- Create: `backend/src/domain/ports/AdminUserRepository.ts`
- Create: `backend/src/infrastructure/repositories/PrismaAdminUserRepository.ts`
- Create: `backend/src/application/SearchUsersUseCase.ts` + `backend/src/application/searchUsers.test.ts`
- Modify: `backend/src/presentation/schemas/admin.schemas.ts`, `routes/admin.routes.ts`, `src/app.ts`
- Test: `backend/tests/integration/admin.users.test.ts`

- [ ] **Step 1:** Port `AdminUserRepository`:
```ts
export interface AdminUserEntry {
  id: string; username: string; role: string;
  realmMajor: number; realmSub: number; linhThach: number;
}
export interface AdminUserRepository {
  // Tìm theo username (contains, không phân biệt hoa thường); rỗng => trang đầu.
  search(query: string, limit: number): Promise<AdminUserEntry[]>;
}
```
- [ ] **Step 2:** `SearchUsersUseCase.execute({ q, limit })` — clamp `limit` vào [1, 50] (mặc định 20), trim `q`. Test unit với fake repo: clamp trên/dưới, truyền query đã trim.
- [ ] **Step 3:** `PrismaAdminUserRepository` — `user.findMany({ where: { username: { contains: q, mode: 'insensitive' } }, include: { character: true }, take: limit, orderBy: { username: 'asc' } })`, map sang `AdminUserEntry` (character có thể null → realm 0/0, linhThach 0).
- [ ] **Step 4:** zod `searchUsersQuerySchema` (`q` optional string, `limit` optional coerce int) + route `GET /admin/users` trong `admin.routes.ts` (đã sau `requireAuth + requireAdmin`), trả `{ users: [...] }`. Wire `app.ts`.
- [ ] **Step 5:** Integration test: admin search thấy user, lọc đúng theo `q`, non-admin → 403.
- [ ] **Step 6:** `npm test` xanh → commit `feat(api): admin tìm người chơi cho cấp thưởng`.

---

## Task 2: Backend — redeem code hỗ trợ thưởng công pháp / Linh Thạch (schema presentation)

**Files:** Modify `backend/src/presentation/schemas/redeem.schemas.ts`; Test `backend/tests/integration/redeem.routes.test.ts`

- [ ] **Step 1:** Đổi `rewardSchema` thành union 3 loại, mỗi phần tử đúng một khóa:
```ts
const rewardSchema = z.object({
  pillId: z.string().min(1).optional(),
  congPhapId: z.string().regex(/^[a-z0-9-]+$/).optional(),
  linhThach: z.number().int().min(1).optional(),
  quantity: z.number().int().min(1),
});
```
Bất biến "đúng một loại" **đã có** ở domain `validateRedeemCodeDefinition` → không nhân đôi rule ở zod, chỉ nới shape.
- [ ] **Step 2:** Integration test: tạo code thưởng công pháp qua `POST /admin/codes`, người chơi `POST /redeem` nhận được công pháp (`kind: 'congphap'`); tạo code Linh Thạch → nhận `kind: 'linhThach'`; reward 2 loại cùng lúc → 400 `INVALID_REDEEM_CODE`.
- [ ] **Step 3:** `npm test` xanh → commit `feat(api): code thưởng công pháp và Linh Thạch`.

---

## Task 3: FE — types + api client

**Files:** Modify `frontend/src/lib/types.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/api.test.ts`

- [ ] **Step 1:** `types.ts`:
  - `AttributeKey = "khiHuyet" | "chanNguyen" | "congVatLy" | "congPhep" | "phongThu" | "tocDo"`; `AttributeSet = Record<AttributeKey, number>`.
  - `CultivationState` += `linhThach: number`, `attributes: { base: AttributeSet; final: AttributeSet }`, `battlePower: number`.
  - `PassiveEffectDTO { attribute: AttributeKey; flatPerLevel: number; pctPerLevel: number }`.
  - `CongPhapDTO` (khớp `CongPhapRecord`: id, name, glyph, rarity:number, category, desc, active, maxLevel, baseCost, costGrowth, effects, powerPerLevel, chanNguyenCost, dupRefundLinhThach).
  - `OwnedCongPhapDTO { def: CongPhapDTO; level: number; equippedSlot: number | null }`.
  - `CongPhapListResult { owned: OwnedCongPhapDTO[]; catalog: CongPhapDTO[] }`; `LevelUpResult { level: number; linhThach: number }`.
  - `AdminUserDTO { id; username; role; realmMajor; realmSub; linhThach }`.
  - **Sửa** `RedeemRewardDTO` → `{ kind: "pill" | "congphap" | "linhThach"; id: string; name: string; glyph: string; quantity: number }`.
  - `AdminRedeemCodeDTO.rewards` → `Array<{ pillId?: string; congPhapId?: string; linhThach?: number; quantity: number }>`.
  - `SubStageConfigDTO` += 6 trường `baseKhiHuyet … baseTocDo`.
- [ ] **Step 2:** `api.ts` thêm: `fetchCongPhap()`, `equipCongPhap(congPhapId, slot)`, `unequipCongPhap(congPhapId)`, `levelUpCongPhap(congPhapId)`, `fetchAdminCongPhap()`, `createAdminCongPhap(def)`, `updateAdminCongPhap(id, body)`, `grantToUser({ userId, congPhapId?, linhThach? })`, `searchAdminUsers(q)`. Giữ đúng mẫu hiện có (dùng `apiFetch`, comment 1 dòng nêu endpoint).
- [ ] **Step 3:** `api.test.ts`: thêm case cho `fetchCongPhap` (GET `/congphap`), `levelUpCongPhap` (POST body đúng), `updateAdminCongPhap` (id chỉ ở URL, không trong body), `searchAdminUsers` (query string `q`); **sửa** case redeem hiện có sang shape `kind`/`id`.
- [ ] **Step 4:** `pnpm test` + `tsc` xanh → commit `feat(fe): types + api client công pháp, thuộc tính`.

---

## Task 4: FE — thư viện thuần + test (constants, display, validation)

**Files:** Create `frontend/src/lib/attribute-constants.ts`, `congphap-display.ts` (+ `.test.ts`), `congphap-validation.ts` (+ `.test.ts`)

- [ ] **Step 1:** `attribute-constants.ts` — thứ tự hiển thị + nhãn tiếng Việt + màu:
```ts
export const ATTRIBUTE_ORDER: AttributeKey[] = ["khiHuyet","chanNguyen","congVatLy","congPhep","phongThu","tocDo"];
export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  khiHuyet: "Khí huyết", chanNguyen: "Chân nguyên", congVatLy: "Công vật lý",
  congPhep: "Công phép", phongThu: "Phòng thủ", tocDo: "Tốc độ",
};
```
- [ ] **Step 2:** `congphap-display.ts` (mirror backend, thuần):
  - `levelUpCost(def, currentLevel)` = `Math.round(baseCost * costGrowth ** (currentLevel - 1))` — **mirror `congphap.calc.ts`**.
  - `passiveBonusAt(def, level): Partial<Record<AttributeKey, {flat:number; pct:number}>>` — bonus của riêng công pháp đó ở level hiện tại, để hiện "+100 Khí huyết / +4% Tốc độ" trên thẻ.
  - `skillPowerAt(def, level)` = `powerPerLevel * level` (chủ động).
  - `getCongPhapRarityMeta(rarity: number)` — **clamp 0–4** rồi tra `RARITY_META` (gotcha #1).
  - `attributeDelta(base, final)` → `Record<AttributeKey, number>` để tô vàng phần chênh.
- [ ] **Step 3:** `congphap-display.test.ts`: cost lũy tiến (level 1→2 = baseCost; 1.5^2 làm tròn), bonus theo level, clamp rarity ngoài khoảng (âm và > 4), delta base/final.
- [ ] **Step 4:** `congphap-validation.ts` — mirror `validateCongPhapDefinition` + zod admin: id slug (chỉ khi tạo mới), name/glyph/desc không rỗng, `maxLevel ≥ 1` nguyên, `baseCost ≥ 0` nguyên, `costGrowth ≥ 1`, `dupRefundLinhThach` null hoặc nguyên ≥ 0; passive: ≥1 effect + attribute hợp lệ + số hữu hạn + không `powerPerLevel`/`chanNguyenCost`; active: `powerPerLevel > 0`, không `effects`. NaN (ô số trống) fail. API: `validateCongPhapDraft(draft, { isNew })` → `CongPhapDraftError[]`, `findCongPhapError(errors, field)` (khớp `pill-validation.ts`).
- [ ] **Step 5:** `congphap-validation.test.ts`: mọi nhánh lỗi + 2 case hợp lệ.
- [ ] **Step 6:** `pnpm test` xanh → commit `feat(fe): thư viện thuần thuộc tính + công pháp`.

---

## Task 5: FE — thuộc tính trong Tu Hành Bảng

**Files:** Modify `frontend/src/components/stats-panel.tsx`, `frontend/src/app/globals.css`

- [ ] **Step 1:** `StatsPanel` thêm (sau "Trạng thái"), phân cách bằng `.stat-divider`:
  - **Chiến lực** (nổi bật, gold, `formatNum`), **Linh Thạch** (jade).
  - 6 dòng thuộc tính theo `ATTRIBUTE_ORDER`: hiện `final` làm tròn; nếu `final > base` thì hậu tố gold `(+N)` (chênh lệch làm tròn) — cùng ngôn ngữ với `(+N%)` của boost đột phá.
- [ ] **Step 2:** CSS `.stat-divider` (đường kẻ + nhãn "CHIẾN LỰC & THUỘC TÍNH"), `.stat-battle-power` (số lớn, gold glow). Giữ đúng token màu/space hiện có.
- [ ] **Step 3:** Human-observation gate: 375/768/1024/1440px — panel không tràn, số không xuống dòng xấu.
- [ ] **Step 4:** commit `feat(fe): thuộc tính, chiến lực, Linh Thạch trong Tu Hành Bảng`.

---

## Task 6: FE — hook `useCongPhap`

**Files:** Create `frontend/src/hooks/use-congphap.ts`

- [ ] **Step 1:** Theo đúng mẫu `use-pill-inventory.ts`:
```ts
export function useCongPhap(enabled: boolean): {
  owned: OwnedCongPhapDTO[]; catalog: CongPhapDTO[];
  loading: boolean; error: string | null;
  refetch: () => Promise<void>;
  equip: (id: string, slot: number) => Promise<void>;
  unequip: (id: string) => Promise<void>;
  levelUp: (id: string) => Promise<LevelUpResult>;
}
```
- [ ] **Step 2:** `enabled` gate lazy-fetch khi mở modal. Cả 3 mutation dùng `try { await POST } finally { await refetch() }` — đường lỗi cũng re-sync (mẫu `consume`).
- [ ] **Step 3:** commit cùng Task 7 (hook không đứng một mình).

---

## Task 7: FE — modal Công Pháp

**Files:** Create `frontend/src/components/congphap-modal.tsx`, `congphap-card.tsx`; Modify `components/icons.tsx`, `components/header-menu.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1:** `ScrollIcon` trong `icons.tsx` (mẫu SVG như `CauldronIcon`).
- [ ] **Step 2:** `header-menu.tsx` — thêm mục **Công Pháp** (desktop inline + mobile dropdown, `onOpenCongPhap`), giữ nguyên ARIA/Escape/outside-click.
- [ ] **Step 3:** `congphap-card.tsx` — thẻ dùng chung: glyph + viền theo rarity (`getCongPhapRarityMeta`), tên, độ hiếm, `Cấp N/Max`, mô tả, dòng hiệu ứng (bị động: bonus thuộc tính ở level hiện tại; chủ động: `Sức mạnh N` + nhãn "hiệu lực khi Combat"), nút **Nâng cấp** (hiện `levelUpCost` + biểu tượng Linh Thạch; disable + lý do khi: đạt max / thiếu Linh Thạch / def bị vô hiệu), nút **Trang bị/Gỡ** (chỉ chủ động). Badge "Đã vô hiệu" khi `!def.active` (gotcha #4).
- [ ] **Step 4:** `congphap-modal.tsx` — GSAP entrance + stagger + Escape + backdrop `<button>` (copy khung `pill-modal.tsx`), 3 khu:
  1. **4 slot chủ động** (`ACTIVE_SLOTS = 4`): slot trống hiện dấu `+`; bấm slot trống mở danh sách chủ động sở hữu để gán; slot có công pháp hiện thẻ rút gọn + nút Gỡ. Gán vào slot đã có = thay thế (backend `clearSlot` rồi `setSlot`).
  2. **Bị động** — luôn bật, lưới thẻ.
  3. **Chưa sở hữu** — `catalog` trừ `owned`, thẻ mờ, không hành động (biết mục tiêu để săn code).
- [ ] **Step 5:** `app/page.tsx` — state `congPhapModalOpen`, `useCongPhap(congPhapModalOpen)`, handler **wait-for-server**: `await levelUp()` → `await refetch()` (cultivation state, để Linh Thạch/thuộc tính/chiến lực cập nhật) → particle burst màu rarity + toast; lỗi → toast danger. Tương tự cho equip/unequip (toast nhẹ, không particle).
- [ ] **Step 6:** CSS `globals.css`: `.congphap-*` (panel, section title, slot grid 4 cột → 2 cột ≤768px, slot trống, card, cost chip, badge vô hiệu). Tái dùng token màu/space; không sửa class `pill-*` hiện có.
- [ ] **Step 7:** Human-observation gate 375/768/1024/1440px + thử: nâng cấp, thiếu Linh Thạch, gán/thay/gỡ slot, công pháp bị admin tắt.
- [ ] **Step 8:** commit `feat(fe): modal Công Pháp — slot chủ động, bị động, nâng cấp`.

---

## Task 8: FE — trang admin `/admin/congphap` + cấp thưởng

**Files:** Create `frontend/src/app/admin/congphap/page.tsx`; Modify `app/admin/layout.tsx`, `app/globals.css`

- [ ] **Step 1:** `admin/layout.tsx` — thêm link **Công pháp** vào rail (dùng `ScrollIcon`), `aria-current` như các mục khác.
- [ ] **Step 2:** Trang master/detail **theo đúng khuôn `/admin/pills`**: danh sách trái (glyph theo rarity, tên, tóm tắt hiệu ứng, chấm trạng thái khi tắt), form phải với `validateCongPhapDraft`, `structuredClone` draft, `dirty` + "Hoàn tác", `beforeunload`, disable control khi `saving`, `requestOpen` confirm khi bỏ draft.
- [ ] **Step 3:** Form đổi theo `category`:
  - **passive**: editor `effects[]` (thêm/xóa dòng; mỗi dòng: select thuộc tính + `flatPerLevel` + `pctPerLevel`), ẩn `powerPerLevel`/`chanNguyenCost` và set `null`.
  - **active**: `powerPerLevel`, `chanNguyenCost`, set `effects = null`.
  - Đổi category **reset** các trường chéo (mẫu `statsForKind` của pills) — tránh backend trả `INVALID_CONGPHAP_CONFIG`.
- [ ] **Step 4:** Khối **Cấp thưởng** cuối trang: ô tìm người chơi (debounce 300ms → `searchAdminUsers`), danh sách kết quả (username + cảnh giới + Linh Thạch hiện có) để chọn; chọn công pháp (select từ catalog) và/hoặc số Linh Thạch; nút Cấp → `grantToUser`; thành công hiện xác nhận, lỗi hiện `INVALID_GRANT`/message server. Chặn submit khi chưa chọn user hoặc không có gì để cấp.
- [ ] **Step 5:** CSS `.admin-congphap-*` (tái dùng `.admin-pill-*` khi trùng khuôn; chỉ thêm cho editor `effects[]` và khối grant).
- [ ] **Step 6:** Human-observation gate (≤768px rail thu gọn) + thử tạo passive/active, đổi category, tắt/bật, cấp thưởng.
- [ ] **Step 7:** commit `feat(fe): trang quản trị công pháp + cấp thưởng`.

---

## Task 9: FE — 6 ô base thuộc tính trong `/admin/realms` + reward đa loại ở `/admin/codes`

**Files:** Modify `frontend/src/app/admin/realms/page.tsx`, `lib/realm-validation.ts` (+ test), `app/admin/codes/page.tsx`, `lib/redeem-validation.ts` (+ test)

- [ ] **Step 1:** `realms/page.tsx` — `NUMERIC_FIELDS` += 6 mục base (nhãn: "Khí huyết nền", "Chân nguyên nền", "Công vật lý nền", "Công phép nền", "Phòng thủ nền", "Tốc độ nền"); `emptyStage()` thêm 6 giá trị mặc định (khớp `deriveBaseAttributes(cultivationRate=1)`: 40/30/6/6/4/2).
- [ ] **Step 2:** `realm-validation.ts` — 6 trường phải là số hữu hạn ≥ 0; cập nhật `realm-validation.test.ts`.
- [ ] **Step 3:** `admin/codes/page.tsx` — mỗi dòng reward thêm select **loại** (Đan dược / Công pháp / Linh Thạch); đổi loại thì xóa khóa cũ, set khóa mới (đúng-một-loại). Đan dược/Công pháp: nhập id; Linh Thạch: nhập số lượng.
- [ ] **Step 4:** `redeem-validation.ts` — dedupe theo khóa có loại (`pill:x` ≠ `congphap:x`), bắt buộc đúng một loại, `linhThach ≥ 1`; cập nhật test.
- [ ] **Step 5:** `pnpm test` xanh → commit `feat(fe): base thuộc tính trong editor cảnh giới + reward đa loại`.

---

## Task 10: Gate cuối + CLAUDE.md

- [ ] **Step 1:** Backend `npm test`; Frontend `pnpm lint` + `npx tsc --noEmit` + `pnpm test` + `pnpm build`. Ghi lại test counts mới.
- [ ] **Step 2:** Human-observation gate tổng: 375/768/1024/1440px cho dashboard + modal Công Pháp + 2 trang admin.
- [ ] **Step 3:** `CLAUDE.md` — cập nhật mục "Công Pháp & Thuộc tính": bỏ "Chưa có UI frontend", thêm: `StatsPanel` mang thuộc tính/chiến lực/Linh Thạch, `useCongPhap` + `CongPhapModal` (4 slot), `/admin/congphap` + cấp thưởng, `GET /admin/users`, redeem code đa loại, `getCongPhapRarityMeta` clamp rarity. Cập nhật test counts.
- [ ] **Step 4:** commit `docs: cập nhật CLAUDE.md cho frontend công pháp`.

---

## Self-Review

- **Spec coverage:** mục 5 — panel thuộc tính (T5), modal 4 slot + bị động + nâng cấp (T6,T7), mirror công thức FE (T4), api client (T3); mục 6 — `/admin/congphap` + form theo category + validation mirror (T8), cấp thưởng (T1,T8), 6 ô base realms (T9). ✔
- **Ngoài spec nhưng cần thiết:** `GET /admin/users` (spec giả định có cách chọn user mà chưa có API — đã hỏi và chốt), redeem schema đa loại (spec nói redeem là nguồn công pháp nhưng admin chưa tạo được code đó), sửa `RedeemRewardDTO` (type FE đang sai so với backend). Cả 3 đều được nêu rõ, không phải mở rộng ngầm.
- **Rủi ro:** CSS modal Công Pháp là phần lớn nhất và chỉ kiểm được bằng mắt — tách Task 7 riêng, không trộn với admin. Rarity ngoài 0–4 đã có clamp. Không đụng class `pill-*` để tránh hồi quy Đan Phòng.
- **Không làm ở phase này:** combat/áp dụng skill power, gacha, starter công pháp, trọng số chiến lực chỉnh qua DB (đúng mục 8 của spec).
