# Đồng bộ UI/UX ba trang admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa `/admin/pills`, `/admin/congphap`, `/admin/realms` về cùng ngôn ngữ thị giác với `/admin/codes`, và gom khung CSS dùng chung về bộ lớp trung tính.

**Architecture:** Trước hết đổi tên bộ lớp `.admin-code-*` mang tính khung chung thành tên trung tính (`.admin-master-*`, `.admin-detail*`, `.admin-form*`, `.admin-row*`) — thuần đổi tên, không đổi hình. Sau đó thêm hai hàm hiển thị thuần có test (`curveHeights`, `rarityPipCount`) và hai component gauge (`RarityPips`, `RealmCurve`). Cuối cùng viết lại phần render của ba trang để dùng khung mới. Không đụng API, không đụng module kiểm tra dữ liệu.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · CSS thuần trong `src/app/globals.css` · Biome · Vitest (`environment: "node"`, chỉ test logic thuần).

## Global Constraints

- Thư mục làm việc của mọi lệnh: `/home/hayashi/working/tu-tien-chi-lo/frontend`.
- Commit message tiếng Việt, **không** kèm trailer `Co-Authored-By`.
- Không đổi bất kỳ lời gọi API nào, không đổi `realm-validation.ts` / `pill-validation.ts` / `congphap-validation.ts`, không đổi cơ chế draft / dirty / `beforeunload` / `window.confirm`, không đổi ngữ nghĩa lưu.
- Không đổi backend.
- Test chỉ viết cho logic thuần (`src/**/*.test.ts`). Component và CSS **không** test tự động — Vitest cấu hình `environment: "node"` và chỉ nhận `src/**/*.test.ts`.
- Sắc thái trạng thái dùng đúng bốn tên: `ok` (`var(--jade)`) · `warn` (`var(--gold)`) · `danger` (`#f6b8b8` cho chữ, `var(--red)` cho viền) · `off` (`var(--muted)`).
- Quy ước nhãn: ở ba trang mới, ô **bắt buộc để trơn**, ô **tùy chọn** ghi "(tùy chọn)" trong dòng hint. Trang `/admin/codes` giữ nguyên dấu `*`.
- Cổng chạy sau mỗi task: `pnpm lint` · `npx tsc --noEmit` · `pnpm test` · `pnpm build` — cả bốn phải xanh trước khi commit.
- Spec: `docs/superpowers/specs/2026-07-26-admin-ui-parity-design.md`.

## File Structure

**Tạo mới**

| File | Trách nhiệm |
| --- | --- |
| `src/lib/realm-curve.ts` | Chuẩn hóa dãy `linhKhiRequired` thành chiều cao cột 0–1 (thang log) |
| `src/lib/realm-curve.test.ts` | Test cho trên |
| `src/lib/pill-constants.test.ts` | Test cho `rarityPipCount` |
| `src/components/rarity-pips.tsx` | Gauge 5 pip độ hiếm, dùng chung cho đan dược + công pháp |
| `src/components/realm-curve.tsx` | Gauge đường cong linh khí cho trang cảnh giới |

**Sửa**

| File | Thay đổi |
| --- | --- |
| `src/app/globals.css` | Đổi tên khung chung thành lớp trung tính; thêm chip/tab/curve/glyph dùng chung; xóa lớp chết |
| `src/lib/pill-constants.ts` | Thêm `RARITY_PIPS`, `rarityPipCount` |
| `src/app/admin/codes/page.tsx` | Đổi tên lớp; sắc thái trạng thái; `--detail-tone` |
| `src/app/admin/pills/page.tsx` | Danh sách thẻ rời + form chia section |
| `src/app/admin/congphap/page.tsx` | Như trên + editor hiệu ứng kiểu hàng + đóng khung khối cấp thưởng |
| `src/app/admin/realms/page.tsx` | Thẻ rời + đường cong + tab tiểu cảnh giới + footer |
| `CLAUDE.md` | Cập nhật mục frontend admin + số test |

---

## Task 1: Đổi tên bộ lớp CSS thành trung tính

Bước này **không được làm đổi hình** trang `/admin/codes`. Đó là bài kiểm tra hồi quy của cả kế hoạch: sau task này trang redeem code phải trông y hệt trước.

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/admin/codes/page.tsx`

**Interfaces:**
- Consumes: không có.
- Produces: bộ lớp CSS trung tính mà Task 3–5 dùng — `.admin-master-detail`, `.admin-master-list`, `.admin-master-empty`, `.admin-master-item` (+ `-top`, `-foot`), `.admin-status` + `--ok|--warn|--danger|--off`, `.admin-meter` (+ `--lg`, `-fill` + `.warn`/`.off`), `.admin-pips` (+ `--lg`), `.admin-pip` (+ `.filled` + `.warn`/`.off`), `.admin-detail` (đọc biến `--detail-tone`), `.admin-detail-head`, `.admin-detail-title`, `.admin-detail-id`, `.admin-detail-gauge`, `.admin-detail-gauge-label`, `.admin-detail-empty`, `.admin-form`, `.admin-form-section` (+ `-head`, `-title`, `-hint`), `.admin-form-grid`, `.admin-field`, `.admin-field-label`, `.admin-field-hint`, `.admin-req`, `.admin-switch` (+ `-input`, `-track`, `-text`, `-title`), `.admin-form-footer`, `.admin-row-list`, `.admin-row-empty`, `.admin-row`, `.admin-row-glyph`, `.admin-row-grow`, `.admin-row-remove`, `.admin-row-add`.

- [ ] **Step 1: Thay toàn bộ khối CSS của redeem code bằng khối trung tính**

Trong `src/app/globals.css`, xóa toàn bộ đoạn bắt đầu từ dòng comment

```css
/* ==== Redeem code: voucher ledger (master/detail, own identity) ==== */
```

cho tới hết khối `@media (max-width: 768px)` ngay sau `.admin-code-form-footer` (khối chứa `.admin-code-layout { grid-template-columns: 1fr; }`), rồi chèn vào đúng chỗ đó đoạn dưới đây:

```css
/* ============================================================
   Khung master/detail dùng chung cho mọi trang admin CRUD
   (redeem code, đan dược, công pháp, cảnh giới). Phần nhấn
   riêng của từng trang nằm ở khối CSS của trang đó; ở đây
   không có gì biết mình đang mô tả miền dữ liệu nào.
   ============================================================ */
.admin-master-detail {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: var(--space-5);
  align-items: start;
}

.admin-master-list {
  position: sticky;
  top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: calc(100vh - 2 * var(--space-4));
  overflow-y: auto;
  padding-right: 2px;
}

.admin-master-empty {
  color: var(--muted);
  font-size: 0.85rem;
  padding: var(--space-4);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  text-align: center;
}

/* Một "vé": danh tính + trạng thái ở trên, gauge ở giữa, siêu dữ liệu ở chân.
   Mọi danh sách master đều dùng đúng hình này; chỉ nội dung ba hàng đổi. */
.admin-master-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3);
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--fg);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease-out),
    background var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}

.admin-master-item:hover {
  border-color: var(--border-bright);
  background: rgba(251, 191, 36, 0.05);
}

.admin-master-item[aria-current="true"] {
  border-color: var(--gold);
  box-shadow:
    inset 3px 0 0 var(--gold),
    0 0 14px var(--gold-glow);
}

.admin-master-item.inactive {
  opacity: 0.72;
}

.admin-master-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.admin-master-item-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 0.78rem;
  color: var(--muted);
}

/* Nhãn trạng thái — bốn sắc thái trung tính. Mỗi trang tự ánh xạ trạng thái
   miền của mình vào ok/warn/danger/off; CSS không cần biết chúng nghĩa là gì. */
.admin-status {
  flex: none;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  border: 1px solid currentColor;
  white-space: nowrap;
}

.admin-status--ok {
  color: var(--jade);
}
.admin-status--warn {
  color: var(--gold);
}
.admin-status--danger {
  color: #f6b8b8;
}
.admin-status--off {
  color: var(--muted);
}

/* Gauge dạng thanh liền — dùng khi số ô quá nhiều để đếm bằng mắt. */
.admin-meter {
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.admin-meter--lg {
  height: 8px;
  border-radius: 4px;
}

.admin-meter-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--jade);
  min-width: 2px;
  transition: width var(--dur) var(--ease-out);
}

.admin-meter-fill.warn {
  background: linear-gradient(90deg, var(--gold), var(--gold-deep));
}

.admin-meter-fill.off {
  background: var(--muted-dim);
}

/* Gauge dạng pip: mỗi ô một suất. Các ô co giãn để mọi số lượng đều trải hết
   chiều ngang và so sánh được với nhau. */
.admin-pips {
  display: flex;
  gap: 3px;
}

.admin-pip {
  flex: 1 1 0;
  height: 6px;
  border-radius: 2px;
  background: transparent;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
  transition: background var(--dur) var(--ease-out);
}

.admin-pips--lg .admin-pip {
  height: 10px;
  border-radius: 3px;
}

.admin-pip.filled {
  background: var(--jade);
  box-shadow: 0 0 5px var(--jade-glow);
}

.admin-pip.filled.warn {
  background: var(--gold);
  box-shadow: 0 0 5px var(--gold-glow);
}

.admin-pip.filled.off {
  background: var(--muted-dim);
  box-shadow: none;
}

/* Khung chi tiết. Viền trên nhận màu từ biến --detail-tone đặt inline — cùng
   khuôn với --rarity ở danh sách, nên một quy tắc phục vụ mọi cách nhuộm. */
.admin-detail {
  position: relative;
  border: 1px solid var(--border);
  border-top: 3px solid var(--detail-tone, var(--border-bright));
  border-radius: var(--radius);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-panel);
  padding: var(--space-6);
}

.admin-detail-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-5);
  margin-bottom: var(--space-3);
  border-bottom: 1px solid var(--border);
}

.admin-detail-title {
  font-size: 1.2rem;
  color: var(--fg);
}

.admin-detail-id {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.admin-detail-gauge {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.admin-detail-gauge-label {
  font-size: 0.82rem;
  color: var(--muted);
}

.admin-detail-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  color: var(--muted);
  text-align: center;
}

/* ===== Biểu mẫu chia section, dùng chung cho cả bốn trang ===== */
.admin-form {
  padding-top: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Mỗi khối là một section có tiêu đề và đường kẻ, để form đọc thành từng nhóm
   rời chứ không phải một lưới ô không phân biệt. */
.admin-form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.admin-form-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border);
}

.admin-form-section-title {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gold);
}

.admin-form-section-hint {
  font-size: 0.78rem;
  color: var(--muted);
}

/* Lưới ô hai cột, ngưỡng rộng hơn lưới đan dược cũ để ô ngày giờ và ô số không
   bị ép thành 3–4 cột lởm chởm. */
.admin-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-5);
}

.admin-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.admin-field-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--fg-dim);
}

.admin-req {
  color: var(--gold);
}

.admin-field-hint {
  font-size: 0.74rem;
  color: var(--muted);
  line-height: 1.35;
}

/* Công tắc bật/tắt tự vẽ — một điều khiển "sống", khác hẳn checkbox mặc định. */
.admin-switch {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  cursor: pointer;
}

/* Ẩn checkbox gốc nhưng vẫn để nó trong cây a11y/focus (nó điều khiển track). */
.admin-switch-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.admin-switch-track {
  position: relative;
  flex: none;
  width: 40px;
  height: 22px;
  margin-top: 1px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid var(--border);
  transition:
    background var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

/* Núm gạt. */
.admin-switch-track::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--muted);
  transition:
    transform var(--dur-fast) var(--ease-out),
    background var(--dur-fast) var(--ease-out);
}

.admin-switch-input:checked + .admin-switch-track {
  background: rgba(93, 217, 177, 0.25);
  border-color: var(--jade);
}

.admin-switch-input:checked + .admin-switch-track::after {
  transform: translateX(18px);
  background: var(--jade);
}

.admin-switch-input:focus-visible + .admin-switch-track {
  box-shadow: 0 0 0 3px var(--jade-glow);
}

.admin-switch-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.admin-switch-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg);
}

/* Editor dạng hàng: danh sách phần thưởng của redeem code và danh sách hiệu ứng
   bị động của công pháp cùng dùng bộ này. */
.admin-row-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.admin-row-empty {
  font-size: 0.82rem;
  color: var(--muted);
  padding: var(--space-4);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  text-align: center;
}

.admin-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  transition: border-color var(--dur-fast) var(--ease-out);
}

.admin-row:hover {
  border-color: var(--border-bright);
}

/* Glyph riêng của hàng, tô màu độ hiếm — giúp quét danh sách bằng mắt. */
.admin-row-glyph {
  flex: none;
  width: 2rem;
  text-align: center;
  font-size: 1.3rem;
  line-height: 1;
  filter: drop-shadow(0 0 5px currentColor);
}

/* Điều khiển chính của hàng: giãn ra lấp chỗ trống nhưng giữ bề rộng dùng được
   thay vì co về 0 — hàng còn mang glyph, ô loại, ô số lượng và nút xóa cố định,
   nên `min-width: 0` không chặn sẽ bóp nó mất hút trong cột chi tiết vốn hẹp.
   Hẹp hơn ngưỡng thì cả hàng xuống dòng. */
.admin-row-grow {
  flex: 1 1 200px;
  min-width: 0;
}

/* Nút xóa chỉ có icon — vuông, chuyển sắc cảnh báo khi rê chuột. */
.admin-row-remove {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  padding: 0;
  color: var(--muted);
}

.admin-row-remove:hover:not(:disabled) {
  border-color: var(--red);
  background: rgba(239, 68, 68, 0.12);
  color: #f6b8b8;
}

.admin-row-add {
  align-self: flex-start;
  margin-top: var(--space-1);
}

/* Hàng nút nằm trên đường kẻ riêng, kết thúc biểu mẫu một cách dứt khoát. */
.admin-form-footer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding-top: var(--space-5);
  border-top: 1px solid var(--border);
}

/* ==== Redeem code: phần riêng của trang mã đổi thưởng ==== */

/* Chuỗi mã là nhân vật chính — mono chữ số đều, giãn chữ, màu vàng. */
.admin-code-string {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--gold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-code-string--lg {
  font-size: 1.5rem;
  letter-spacing: 0.12em;
}

/* Ô chọn loại phần thưởng, đứng trước ô chọn giá trị trong mỗi hàng. */
.admin-code-reward-kind {
  flex: 0 0 auto;
  width: 130px;
}

/* Cụm "× N" để con số đọc ra là hệ số nhân chứ không phải một ô rời rạc. */
.admin-code-reward-qty-wrap {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.admin-code-reward-times {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  color: var(--muted);
}

.admin-code-reward-qty {
  width: 72px;
}

@media (max-width: 768px) {
  .admin-master-detail {
    grid-template-columns: 1fr;
  }
  .admin-master-list {
    position: static;
    max-height: none;
  }
}
```

- [ ] **Step 2: Xóa quy tắc `.admin-code-reward-kind` cũ bị bỏ lại**

Quy tắc này đã được chuyển vào khối mới ở Step 1. Xóa bản cũ nằm sau khối `.admin-congphap-*`:

```css
/* Reward-kind selector sits before the value control in a code's reward row. */
.admin-code-reward-kind {
  flex: 0 0 auto;
  width: 130px;
}
```

- [ ] **Step 3: Đổi tên lớp trong `src/app/admin/codes/page.tsx`**

Thay từng chuỗi sau (đúng thứ tự liệt kê, mỗi chuỗi thay hết mọi lần xuất hiện):

| Chuỗi cũ | Chuỗi mới |
| --- | --- |
| `admin-code-layout` | `admin-master-detail` |
| `admin-code-list-empty` | `admin-master-empty` |
| `admin-code-list` | `admin-master-list` |
| `admin-code-row-top` | `admin-master-item-top` |
| `admin-code-row-foot` | `admin-master-item-foot` |
| `admin-code-row` | `admin-master-item` |
| `admin-code-pips--` | `admin-pips--` |
| `admin-code-pips` | `admin-pips` |
| `admin-code-pip` | `admin-pip` |
| `admin-code-meter-fill` | `admin-meter-fill` |
| `admin-code-meter--` | `admin-meter--` |
| `admin-code-meter` | `admin-meter` |
| `admin-code-detail-head` | `admin-detail-head` |
| `admin-code-detail-title` | `admin-detail-title` |
| `admin-code-detail-id` | `admin-detail-id` |
| `admin-code-detail-empty` | `admin-detail-empty` |
| `admin-code-gauge-label` | `admin-detail-gauge-label` |
| `admin-code-gauge` | `admin-detail-gauge` |
| `admin-code-form-grid` | `admin-form-grid` |
| `admin-code-form-footer` | `admin-form-footer` |
| `admin-code-form` | `admin-form` |
| `admin-code-section-head` | `admin-form-section-head` |
| `admin-code-section-title` | `admin-form-section-title` |
| `admin-code-section-hint` | `admin-form-section-hint` |
| `admin-code-section` | `admin-form-section` |
| `admin-code-field` | `admin-field` |
| `admin-code-label` | `admin-field-label` |
| `admin-code-hint` | `admin-field-hint` |
| `admin-code-toggle-input` | `admin-switch-input` |
| `admin-code-toggle-text` | `admin-switch-text` |
| `admin-code-toggle-title` | `admin-switch-title` |
| `admin-code-switch` | `admin-switch-track` |
| `admin-code-toggle` | `admin-switch` |
| `admin-code-reward-list` | `admin-row-list` |
| `admin-code-rewards-empty` | `admin-row-empty` |
| `admin-code-reward-row` | `admin-row` |
| `admin-code-reward-glyph` | `admin-row-glyph` |
| `admin-code-reward-select` | `admin-row-grow` |
| `admin-code-reward-remove` | `admin-row-remove` |
| `admin-code-add-reward` | `admin-row-add` |

Giữ nguyên: `admin-code-string`, `admin-code-string--lg`, `admin-code-reward-kind`, `admin-code-reward-qty-wrap`, `admin-code-reward-times`, `admin-code-reward-qty`.

Lưu ý thứ tự: `admin-code-pips` phải thay trước `admin-code-pip` (một chuỗi là tiền tố của chuỗi kia); `admin-code-list-empty` trước `admin-code-list`; `admin-code-toggle-*` trước `admin-code-toggle`; `admin-code-section-*` trước `admin-code-section`; `admin-code-form-*` trước `admin-code-form`.

- [ ] **Step 4: Đổi `meterClass` sang tên sắc thái mới**

Thay hàm `meterClass` (khoảng dòng 77–81) bằng:

```ts
// Màu gauge theo trạng thái: vàng khi hết lượt, xám khi tắt/hết hạn, ngọc khi
// còn khỏe — cùng bảng sắc thái với nhãn trạng thái.
function meterClass(status: CodeStatus): string {
  if (status === "exhausted") return "warn";
  if (status === "off" || status === "expired") return "off";
  return "";
}
```

- [ ] **Step 5: Thêm bảng ánh xạ trạng thái → sắc thái và dùng cho nhãn**

Ngay dưới `const STATUS_LABEL` (khoảng dòng 54–59), thêm:

```ts
// Bốn trạng thái của mã ánh xạ vào bốn sắc thái trung tính dùng chung cho mọi
// trang admin. CSS chỉ biết ok/warn/danger/off, không biết "hết hạn" là gì.
type Tone = "ok" | "warn" | "danger" | "off";

const STATUS_TONE: Record<CodeStatus, Tone> = {
  active: "ok",
  exhausted: "warn",
  expired: "danger",
  off: "off",
};

// Màu viền trên khung chi tiết, đặt qua biến --detail-tone.
const TONE_COLOR: Record<Tone, string> = {
  ok: "var(--jade)",
  warn: "var(--gold)",
  danger: "var(--red)",
  off: "var(--muted-dim)",
};
```

Rồi thay cả hai chỗ dựng className của nhãn trạng thái:

```tsx
className={`admin-status admin-status--${STATUS_TONE[status]}`}
```

và ở khung chi tiết:

```tsx
className={`admin-status admin-status--${STATUS_TONE[editingStatus]}`}
```

- [ ] **Step 6: Thay 4 lớp con của khung chi tiết bằng biến `--detail-tone`**

Thêm import kiểu ở đầu file:

```tsx
import type { CSSProperties } from "react";
```

Thay khối `<div className={...admin-detail...}>` mở khung chi tiết bằng:

```tsx
<div
  className="admin-detail"
  style={
    editingStatus
      ? ({
          "--detail-tone": TONE_COLOR[STATUS_TONE[editingStatus]],
        } as CSSProperties)
      : undefined
  }
>
```

Khi chưa chọn mã nào, không đặt biến — CSS tự rơi về `var(--border-bright)`, đúng như hành vi cũ.

- [ ] **Step 7: Kiểm tra không còn lớp cũ nào sót**

Chạy:

```bash
cd /home/hayashi/working/tu-tien-chi-lo/frontend && grep -n "admin-code-" src/app/admin src/components src/lib -r
```

Kết quả mong đợi: chỉ còn `admin-code-string`, `admin-code-string--lg`, `admin-code-reward-kind`, `admin-code-reward-qty-wrap`, `admin-code-reward-times`, `admin-code-reward-qty`. Bất kỳ tên nào khác là sót.

```bash
cd /home/hayashi/working/tu-tien-chi-lo/frontend && grep -n "admin-code-" src/app/globals.css
```

Mọi dòng khớp phải nằm trong khối `/* ==== Redeem code: phần riêng ==== */` và chỉ thuộc sáu tên trên (kể cả dòng comment). Nếu còn tên khung chung nào mang tiền tố `admin-code-`, đó là chỗ sót ở Step 1.

- [ ] **Step 8: Chạy cổng**

```bash
cd /home/hayashi/working/tu-tien-chi-lo/frontend && pnpm lint && npx tsc --noEmit && pnpm test && pnpm build
```

Mong đợi: lint không báo lỗi, `tsc` im lặng, `Tests 91 passed (91)`, build `✓ Compiled successfully`.

- [ ] **Step 9: Cổng con người — trang redeem code phải y hệt**

Chạy `pnpm dev`, mở `/admin/codes`, đối chiếu bằng mắt ở 375 / 768 / 1024 / 1440px: danh sách vé, nhãn trạng thái bốn màu, pip đếm lượt, viền trên khung chi tiết đổi màu theo trạng thái, form chia section, công tắc kích hoạt, hàng phần thưởng ba loại. **Bất kỳ khác biệt nào cũng là lỗi của bước đổi tên** — sửa xong mới đi tiếp.

- [ ] **Step 10: Commit**

```bash
cd /home/hayashi/working/tu-tien-chi-lo && git add frontend/src/app/globals.css frontend/src/app/admin/codes/page.tsx && git commit -m "refactor(fe): đổi khung CSS admin sang lớp trung tính dùng chung"
```

---

## Task 2: Hai hàm hiển thị thuần + test

**Files:**
- Create: `src/lib/realm-curve.ts`
- Create: `src/lib/realm-curve.test.ts`
- Create: `src/lib/pill-constants.test.ts`
- Modify: `src/lib/pill-constants.ts`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `curveHeights(values: number[]): number[]` — chiều cao 0–1 cho từng cột.
  - `CURVE_MIN_HEIGHT: number` — chiều cao của cột thấp nhất khi dãy có chênh lệch.
  - `RARITY_PIPS: number` (= 5) và `rarityPipCount(rarity: number): number` (1–5).

- [ ] **Step 1: Viết test cho `curveHeights`**

Tạo `src/lib/realm-curve.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CURVE_MIN_HEIGHT, curveHeights } from "./realm-curve";

describe("curveHeights", () => {
  it("trả về dãy rỗng cho đầu vào rỗng", () => {
    expect(curveHeights([])).toEqual([]);
  });

  it("một giá trị thì cột đầy", () => {
    expect(curveHeights([100])).toEqual([1]);
  });

  it("mọi giá trị bằng nhau thì mọi cột đều đầy (không chia cho 0)", () => {
    expect(curveHeights([500, 500, 500])).toEqual([1, 1, 1]);
  });

  it("dãy tăng theo cấp số nhân cho các bước đều nhau trên thang log", () => {
    const h = curveHeights([100, 200, 400, 800]);
    expect(h[0]).toBeCloseTo(CURVE_MIN_HEIGHT, 6);
    expect(h[3]).toBeCloseTo(1, 6);
    // Cấp số nhân → khoảng cách giữa các cột liên tiếp bằng nhau.
    expect(h[1] - h[0]).toBeCloseTo(h[2] - h[1], 6);
    expect(h[2] - h[1]).toBeCloseTo(h[3] - h[2], 6);
  });

  it("giá trị NaN hoặc không dương thành cột 0 mà không làm hỏng dãy", () => {
    const h = curveHeights([100, Number.NaN, 400]);
    expect(h[1]).toBe(0);
    expect(h[0]).toBeCloseTo(CURVE_MIN_HEIGHT, 6);
    expect(h[2]).toBeCloseTo(1, 6);
  });

  it("giá trị 0 thành cột 0, phần còn lại vẫn chuẩn hóa được", () => {
    expect(curveHeights([0, 100])).toEqual([0, 1]);
  });

  it("không có giá trị nào dùng được thì mọi cột bằng 0", () => {
    expect(curveHeights([Number.NaN, 0, -5])).toEqual([0, 0, 0]);
  });
});
```

- [ ] **Step 2: Viết test cho `rarityPipCount`**

Tạo `src/lib/pill-constants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rarityPipCount, RARITY_PIPS } from "./pill-constants";

describe("rarityPipCount", () => {
  it("bậc 0 sáng 1 pip, bậc 4 sáng đủ 5", () => {
    expect(rarityPipCount(0)).toBe(1);
    expect(rarityPipCount(4)).toBe(RARITY_PIPS);
  });

  it("kẹp bậc vượt khoảng — công pháp có rarity là Int không chặn", () => {
    expect(rarityPipCount(7)).toBe(RARITY_PIPS);
    expect(rarityPipCount(-3)).toBe(1);
  });

  it("làm tròn xuống bậc thập phân", () => {
    expect(rarityPipCount(2.7)).toBe(3);
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận FAIL**

```bash
cd /home/hayashi/working/tu-tien-chi-lo/frontend && pnpm test
```

Mong đợi: FAIL — `Failed to resolve import "./realm-curve"` và `rarityPipCount is not a function` (hoặc lỗi import tương đương).

- [ ] **Step 4: Viết `src/lib/realm-curve.ts`**

```ts
/**
 * Chiều cao cột (0–1) cho đường cong linh khí của một cảnh giới.
 *
 * `linhKhiRequired` tăng theo cấp số nhân giữa các tiểu cảnh giới, nên vẽ trên
 * thang tuyến tính sẽ dí bốn cột đầu xuống sát đáy và đường cong mất hết thông
 * tin. Vẽ trên thang log biến tỉ lệ tăng không đổi thành bước nhảy không đổi —
 * đó chính là thứ người cân bằng game muốn nhìn.
 */

/** Cột thấp nhất vẫn phải nhìn thấy được, không tụt về 0. */
export const CURVE_MIN_HEIGHT = 0.12;

export function curveHeights(values: number[]): number[] {
  if (values.length === 0) return [];

  // Ô admin đang gõ dở (input rỗng → NaN) hoặc số không dương thì không có
  // logarit. Cột đó vẽ bằng 0 thay vì đầu độc min/max của cả dãy.
  const usable = (v: number) => Number.isFinite(v) && v > 0;
  const logs = values.filter(usable).map((v) => Math.log(v));
  if (logs.length === 0) return values.map(() => 0);

  const min = Math.min(...logs);
  const max = Math.max(...logs);

  // Một cột, hoặc mọi cột bằng nhau: không có biên độ để chuẩn hóa — cho đầy.
  if (max === min) return values.map((v) => (usable(v) ? 1 : 0));

  return values.map((v) => {
    if (!usable(v)) return 0;
    const t = (Math.log(v) - min) / (max - min);
    return CURVE_MIN_HEIGHT + t * (1 - CURVE_MIN_HEIGHT);
  });
}
```

- [ ] **Step 5: Thêm `rarityPipCount` vào `src/lib/pill-constants.ts`**

Chèn vào cuối file:

```ts
/** Số ô của gauge độ hiếm — một ô cho mỗi bậc. */
export const RARITY_PIPS = 5;

/**
 * Số pip sáng cho một bậc độ hiếm: bậc 0 sáng 1, bậc 4 sáng đủ 5.
 * `CongPhap.rarity` phía backend là `Int` không chặn khoảng (khác `Pill`), nên
 * kẹp trước khi đếm — cùng lý do `getCongPhapRarityMeta` phải kẹp trước khi tra
 * `RARITY_META`.
 */
export function rarityPipCount(rarity: number): number {
  return Math.min(Math.max(Math.floor(rarity), 0), 4) + 1;
}
```

- [ ] **Step 6: Chạy test để xác nhận PASS**

```bash
cd /home/hayashi/working/tu-tien-chi-lo/frontend && pnpm test
```

Mong đợi: `Test Files 12 passed (12)` · `Tests 101 passed (101)`.

- [ ] **Step 7: Chạy cổng còn lại**

```bash
cd /home/hayashi/working/tu-tien-chi-lo/frontend && pnpm lint && npx tsc --noEmit && pnpm build
```

Mong đợi: cả ba xanh.

- [ ] **Step 8: Commit**

```bash
cd /home/hayashi/working/tu-tien-chi-lo && git add frontend/src/lib/realm-curve.ts frontend/src/lib/realm-curve.test.ts frontend/src/lib/pill-constants.ts frontend/src/lib/pill-constants.test.ts && git commit -m "feat(fe): hàm thuần cho gauge độ hiếm và đường cong linh khí"
```

---

## Task 3: `/admin/pills` sang khuôn mới

**Files:**
- Create: `src/components/rarity-pips.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/admin/pills/page.tsx`

**Interfaces:**
- Consumes: `rarityPipCount`, `RARITY_PIPS` (Task 2); lớp `.admin-master-*`, `.admin-detail*`, `.admin-form*`, `.admin-status*`, `.admin-pips`, `.admin-pip` (Task 1).
- Produces: component `RarityPips({ rarity: number; color: string; size?: "sm" | "lg" })`, dùng lại ở Task 4. Lớp CSS `.admin-chips`, `.admin-chip`, `.admin-chip--tint`, `.admin-chip--ok`, `.admin-chip--danger`, `.admin-master-item-name`, `.admin-detail-glyph`, `.admin-detail-head--row`, `.admin-detail-head-main`, `.admin-field--wide`, `.admin-pip.filled.tint` — Task 4 và 5 dùng lại.

- [ ] **Step 1: Thêm CSS dùng chung mới**

Chèn vào `src/app/globals.css`, ngay trước dòng comment `/* ==== Redeem code: phần riêng của trang mã đổi thưởng ==== */`:

```css
/* Cụm danh tính ở hàng trên của một thẻ: glyph (nếu có) + tên bản ghi. */
.admin-master-item-name {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  font-weight: 600;
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Pip tô theo màu đặt inline (độ hiếm) — một quy tắc phục vụ cả năm bậc. */
.admin-pip.filled.tint {
  background: currentColor;
  box-shadow: 0 0 5px currentColor;
}

/* Chip: dữ kiện phụ, không phải trạng thái (độ hiếm, phân loại, phát tân thủ). */
.admin-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.admin-chip {
  font-size: 0.75rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--border-bright);
  color: var(--fg-dim);
  white-space: nowrap;
}

/* Nhận màu từ thuộc tính `color` đặt inline (màu độ hiếm). */
.admin-chip--tint {
  border-color: currentColor;
}

.admin-chip--ok {
  color: var(--jade);
  border-color: currentColor;
}

.admin-chip--danger {
  color: #f6b8b8;
  border-color: currentColor;
}

/* Đầu khung nằm ngang: glyph lớn bên trái, danh tính bên phải. */
.admin-detail-head--row {
  flex-direction: row;
  align-items: flex-start;
  gap: var(--space-4);
}

.admin-detail-head-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
  flex: 1;
}

/* Glyph lớn định danh bản ghi; màu độ hiếm đặt inline, quầng sáng lấy theo
   currentColor nên bậc càng cao trông càng rực. */
.admin-detail-glyph {
  flex: none;
  font-size: 2.4rem;
  line-height: 1;
  filter: drop-shadow(0 0 6px currentColor);
}

/* Ô chiếm trọn chiều ngang lưới (mô tả dài, textarea). */
.admin-field--wide {
  grid-column: 1 / -1;
}
```

- [ ] **Step 2: Tạo component `RarityPips`**

Tạo `src/components/rarity-pips.tsx`:

```tsx
"use client";

import { RARITY_PIPS, rarityPipCount } from "@/lib/pill-constants";

interface RarityPipsProps {
  /** Bậc độ hiếm từ backend; công pháp dùng Int không chặn nên sẽ được kẹp. */
  rarity: number;
  /** Màu độ hiếm lấy từ RARITY_META — pip sáng tô theo currentColor. */
  color: string;
  size?: "sm" | "lg";
}

// Gauge của hai trang danh mục: năm ô, mỗi ô một bậc độ hiếm, sáng tới bậc của
// bản ghi. Cùng hình với gauge lượt đổi của trang redeem code nên hai trang đọc
// ra là anh em.
export function RarityPips({ rarity, color, size = "sm" }: RarityPipsProps) {
  const filled = rarityPipCount(rarity);
  return (
    <div
      className={`admin-pips${size === "lg" ? " admin-pips--lg" : ""}`}
      style={{ color }}
      aria-hidden
    >
      {Array.from({ length: RARITY_PIPS }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: năm ô cố định theo vị trí
          key={i}
          className={`admin-pip${i < filled ? " filled tint" : ""}`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Thêm bảng gợi ý hiệu ứng vào `src/app/admin/pills/page.tsx`**

Chèn ngay sau `const RARITIES: PillRarity[] = [0, 1, 2, 3, 4];`:

```ts
// Câu gợi ý của section Hiệu ứng, đổi theo loại đang chọn — nói rõ hiệu ứng
// hành xử thế nào, thứ mà tên loại không nói được.
const EFFECT_HINTS: Record<PillEffectKind, string> = {
  linhKhi: "cộng thẳng một lần vào linh khí khi dùng",
  cultivationBuff:
    "nhân tốc độ tu luyện trong một khoảng thời gian; dùng lại thì làm mới, không cộng dồn",
  breakthroughBoost: "cộng tỉ lệ cho lần đột phá kế tiếp, dùng một lần rồi mất",
  clearPunishment: "gỡ trạng thái trọng thương ngay lập tức",
};
```

- [ ] **Step 4: Thay thân `PillForm` bằng biểu mẫu chia section**

Trong `src/app/admin/pills/page.tsx`, thay toàn bộ khối `return (...)` của `PillForm` (từ `return (` sau `const statFields = ...` cho tới `);` đóng hàm) bằng:

```tsx
  return (
    <div className="admin-form">
      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Nhận dạng</h4>
        </div>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span className="admin-field-label">ID</span>
            <input
              className={`admin-input${idError ? " invalid" : ""}`}
              value={draft.id}
              onChange={(e) => set("id", e.target.value)}
              readOnly={!isNew}
              disabled={saving}
              aria-label="ID đan dược"
            />
            <span className="admin-field-hint">
              Định danh nội bộ, không đổi được sau khi tạo
            </span>
            {idError && (
              <span className="admin-field-error">{idError.message}</span>
            )}
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Tên</span>
            <input
              className={`admin-input${findPillError(errors, "name") ? " invalid" : ""}`}
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={saving}
              aria-label="Tên đan dược"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Glyph</span>
            <input
              className={`admin-input${findPillError(errors, "glyph") ? " invalid" : ""}`}
              value={draft.glyph}
              onChange={(e) => set("glyph", e.target.value)}
              disabled={saving}
              aria-label="Glyph đan dược"
            />
            <span className="admin-field-hint">
              Một ký tự Hán hiển thị trên viên đan
            </span>
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Độ hiếm</span>
            <select
              className="admin-input"
              value={draft.rarity}
              onChange={(e) =>
                set("rarity", Number(e.target.value) as PillRarity)
              }
              disabled={saving}
              aria-label="Độ hiếm"
            >
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {getRarityMeta(r).name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Hiệu ứng</h4>
          <span className="admin-form-section-hint">
            {EFFECT_HINTS[draft.effectKind]}
          </span>
        </div>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span className="admin-field-label">Loại hiệu ứng</span>
            <select
              className="admin-input"
              value={draft.effectKind}
              onChange={(e) => setKind(e.target.value as PillEffectKind)}
              disabled={saving}
              aria-label="Loại hiệu ứng"
            >
              {EFFECT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {statFields.map((key) => {
            const err = findPillError(errors, key);
            return (
              <label className="admin-field" key={key}>
                <span className="admin-field-label">{STAT_LABELS[key]}</span>
                <input
                  type="number"
                  className={`admin-input admin-num${err ? " invalid" : ""}`}
                  value={numericValue(draft[key])}
                  onChange={(e) =>
                    set(
                      key,
                      e.target.value === ""
                        ? Number.NaN
                        : Number(e.target.value),
                    )
                  }
                  disabled={saving}
                  aria-label={STAT_LABELS[key]}
                />
                {err && (
                  <span className="admin-field-error">{err.message}</span>
                )}
              </label>
            );
          })}
        </div>
      </section>

      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Phát hành</h4>
        </div>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span className="admin-field-label">Phát tân thủ</span>
            <input
              type="number"
              className={`admin-input admin-num${findPillError(errors, "starterQuantity") ? " invalid" : ""}`}
              value={numericValue(draft.starterQuantity)}
              onChange={(e) =>
                set(
                  "starterQuantity",
                  e.target.value === "" ? Number.NaN : Number(e.target.value),
                )
              }
              disabled={saving}
              aria-label="Số lượng phát cho người chơi mới"
            />
            <span className="admin-field-hint">
              0 = không phát cho người chơi mới
            </span>
            {findPillError(errors, "starterQuantity") && (
              <span className="admin-field-error">
                {findPillError(errors, "starterQuantity")?.message}
              </span>
            )}
          </label>
          <label className="admin-field admin-field--wide">
            <span className="admin-field-label">Mô tả</span>
            <textarea
              className={`admin-input${findPillError(errors, "desc") ? " invalid" : ""}`}
              value={draft.desc}
              onChange={(e) => set("desc", e.target.value)}
              rows={2}
              disabled={saving}
              aria-label="Mô tả đan dược"
            />
          </label>
        </div>
        <label className="admin-switch">
          <input
            type="checkbox"
            className="admin-switch-input"
            checked={draft.active}
            onChange={(e) => set("active", e.target.checked)}
            disabled={saving}
            aria-label="Đang kích hoạt"
          />
          <span className="admin-switch-track" aria-hidden="true" />
          <span className="admin-switch-text">
            <span className="admin-switch-title">Kích hoạt</span>
            <span className="admin-field-hint">
              Tắt để ẩn khỏi người chơi — túi đồ được giữ nguyên
            </span>
          </span>
        </label>
      </section>

      {saveError && <p className="admin-error">{saveError}</p>}

      <div className="admin-form-footer">
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={save}
          disabled={saving || errors.length > 0 || (!dirty && !isNew)}
        >
          {saving ? "Đang lưu…" : "Lưu"}
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={onCancel}
          disabled={saving}
        >
          {dirty ? "Hoàn tác" : "Đóng"}
        </button>
      </div>
    </div>
  );
```

Lưu ý: bản mới thêm `disabled={saving}` cho mọi ô nhập. Đây là chỉnh nhỏ có chủ đích cho khớp quy ước đã ghi trong `CLAUDE.md` ("Draft editors disable all mutating controls while saving") mà trang đan dược đang thiếu; nó không đụng cơ chế draft/dirty.

- [ ] **Step 5: Thay phần render danh sách + khung chi tiết của `AdminPillsPage`**

Thay toàn bộ khối `return (...)` cuối hàm `AdminPillsPage` bằng:

```tsx
  return (
    <section>
      <div className="admin-topbar">
        <h2>Đan dược ({pills.length})</h2>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => requestOpen("new")}
          disabled={openId === "new"}
        >
          + Thêm đan dược
        </button>
      </div>

      <div className="admin-master-detail">
        {/* Master: mỗi đan dược một thẻ — glyph + tên + trạng thái, gauge độ
            hiếm, chân thẻ là hiệu ứng dạng mono. */}
        <div className="admin-master-list">
          {pills.length === 0 && (
            <p className="admin-master-empty">
              Chưa có đan dược nào. Thêm viên đầu tiên để người chơi có thứ mà
              dùng.
            </p>
          )}
          {pills.map((pill) => {
            const meta = getRarityMeta(pill.rarity);
            return (
              <button
                key={pill.id}
                type="button"
                className={`admin-master-item${pill.active ? "" : " inactive"}`}
                aria-current={openId === pill.id}
                onClick={() => requestOpen(openId === pill.id ? null : pill.id)}
              >
                <div className="admin-master-item-top">
                  <span className="admin-master-item-name">
                    <span
                      className="admin-row-glyph"
                      style={{ color: meta.color }}
                      aria-hidden="true"
                    >
                      {pill.glyph}
                    </span>
                    {pill.name}
                  </span>
                  <span
                    className={`admin-status admin-status--${pill.active ? "ok" : "off"}`}
                  >
                    {pill.active ? "Hoạt động" : "Đang tắt"}
                  </span>
                </div>
                <RarityPips rarity={pill.rarity} color={meta.color} />
                <div className="admin-master-item-foot">
                  <span className="admin-num">{headlineStat(pill)}</span>
                  <span>
                    {pill.starterQuantity > 0
                      ? `Tân thủ ×${pill.starterQuantity}`
                      : meta.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail: đầu khung + biểu mẫu, hoặc lời mời chọn. */}
        <div
          className="admin-detail"
          style={
            headerMeta
              ? ({ "--detail-tone": headerMeta.color } as CSSProperties)
              : undefined
          }
        >
          {isEditing && headerPill ? (
            <>
              <div className="admin-detail-head admin-detail-head--row">
                <span
                  className="admin-detail-glyph"
                  style={{ color: headerMeta?.color }}
                  aria-hidden="true"
                >
                  {headerPill.glyph || "丹"}
                </span>
                <div className="admin-detail-head-main">
                  <h3 className="admin-detail-title">
                    {openId === "new"
                      ? "Thêm đan dược mới"
                      : headerPill.name || "(chưa có tên)"}
                  </h3>
                  <div className="admin-chips">
                    <span
                      className="admin-chip admin-chip--tint"
                      style={{ color: headerMeta?.color }}
                    >
                      {headerMeta?.name}
                    </span>
                    <span className="admin-chip">
                      {effectLabel(headerPill.effectKind)}
                    </span>
                    {headerPill.starterQuantity > 0 && (
                      <span className="admin-chip admin-chip--ok">
                        Tân thủ ×{headerPill.starterQuantity}
                      </span>
                    )}
                    {!headerPill.active && (
                      <span className="admin-chip admin-chip--danger">
                        Đang tắt
                      </span>
                    )}
                  </div>
                  <div className="admin-detail-gauge">
                    <RarityPips
                      rarity={headerPill.rarity}
                      color={headerMeta?.color ?? "var(--muted)"}
                      size="lg"
                    />
                    {/* Chip đã nói loại hiệu ứng; câu này nói giá trị của nó. */}
                    <span className="admin-detail-gauge-label">
                      <span className="admin-num">
                        {headlineStat(headerPill)}
                      </span>{" "}
                      · {headerMeta?.name}
                    </span>
                  </div>
                </div>
              </div>
              <PillForm
                key={openId}
                initial={
                  openId === "new" ? emptyPill() : (editingPill as AdminPillDTO)
                }
                isNew={openId === "new"}
                onSaved={onSaved}
                onCancel={() => setOpenId(null)}
                onDirtyChange={setDirtyOpen}
              />
            </>
          ) : (
            <div className="admin-detail-empty">
              <p>Chọn một đan dược để chỉnh sửa, hoặc thêm đan dược mới.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
```

- [ ] **Step 6: Cập nhật import của trang đan dược**

Đầu file phải có:

```tsx
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RarityPips } from "@/components/rarity-pips";
import { createAdminPill, fetchAdminPills, updateAdminPill } from "@/lib/api";
import { getRarityMeta } from "@/lib/pill-constants";
import {
  findPillError,
  PILL_KIND_FIELDS,
  validatePillDraft,
} from "@/lib/pill-validation";
import type { AdminPillDTO, PillEffectKind, PillRarity } from "@/lib/types";
```

Nhóm CSS `.admin-pill-*` cũ **chưa xóa ở task này** — `/admin/congphap` vẫn đang dùng nó cho tới hết Task 4. Việc dọn nằm ở Task 6.

- [ ] **Step 7: Chạy cổng**

```bash
cd /home/hayashi/working/tu-tien-chi-lo/frontend && pnpm lint && npx tsc --noEmit && pnpm test && pnpm build
```

Mong đợi: cả bốn xanh, `Tests 101 passed (101)`.

- [ ] **Step 8: Cổng con người**

`pnpm dev` → `/admin/pills` ở 375 / 768 / 1024 / 1440px. Kiểm: thẻ rời cuộn được, pip độ hiếm đúng số ô sáng, viền trên khung chi tiết đổi màu theo độ hiếm khi chọn viên khác, ba section, công tắc kích hoạt gạt được, ô mô tả chiếm trọn hàng.

- [ ] **Step 9: Commit**

```bash
cd /home/hayashi/working/tu-tien-chi-lo && git add frontend/src/components/rarity-pips.tsx frontend/src/app/globals.css frontend/src/app/admin/pills/page.tsx && git commit -m "feat(fe): trang đan dược dùng khuôn master/detail chung"
```

---

## Task 4: `/admin/congphap` sang khuôn mới

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/admin/congphap/page.tsx`

**Interfaces:**
- Consumes: `RarityPips` (Task 3); toàn bộ lớp trung tính (Task 1) và lớp chip/glyph (Task 3).
- Produces: lớp CSS `.admin-row-field`, `.admin-row-num` (editor hàng có nhãn) — Task 5 không dùng, nhưng giữ tên trung tính để trang admin sau này dùng lại.

- [ ] **Step 1: Thêm CSS cho ô số có nhãn trong hàng editor**

Chèn vào `src/app/globals.css` ngay sau quy tắc `.admin-row-grow`:

```css
/* Ô số có nhãn nằm trong một hàng editor (hiệu ứng bị động của công pháp). */
.admin-row-field {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.72rem;
  color: var(--muted);
}

.admin-row-num {
  width: 96px;
}
```

- [ ] **Step 2: Thay thân `CongPhapForm` bằng biểu mẫu chia section**

Trong `src/app/admin/congphap/page.tsx`, thay toàn bộ khối `return (...)` của `CongPhapForm` bằng:

```tsx
  return (
    <div className="admin-form">
      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Nhận dạng</h4>
        </div>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span className="admin-field-label">ID</span>
            <input
              className={`admin-input${err("id") ? " invalid" : ""}`}
              value={draft.id}
              onChange={(e) => set("id", e.target.value)}
              readOnly={!isNew}
              disabled={saving}
              aria-label="ID công pháp"
            />
            <span className="admin-field-hint">
              Định danh nội bộ, không đổi được sau khi tạo
            </span>
            {err("id") && (
              <span className="admin-field-error">{err("id")?.message}</span>
            )}
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Tên</span>
            <input
              className={`admin-input${err("name") ? " invalid" : ""}`}
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={saving}
              aria-label="Tên công pháp"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Glyph</span>
            <input
              className={`admin-input${err("glyph") ? " invalid" : ""}`}
              value={draft.glyph}
              onChange={(e) => set("glyph", e.target.value)}
              disabled={saving}
              aria-label="Glyph công pháp"
            />
            <span className="admin-field-hint">
              Một ký tự Hán hiển thị trên thẻ công pháp
            </span>
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Độ hiếm</span>
            <select
              className="admin-input"
              value={draft.rarity}
              onChange={(e) => set("rarity", Number(e.target.value))}
              disabled={saving}
              aria-label="Độ hiếm"
            >
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {getCongPhapRarityMeta(r).name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Loại</span>
            <select
              className="admin-input"
              value={draft.category}
              onChange={(e) => setCategory(e.target.value as CongPhapCategory)}
              disabled={saving}
              aria-label="Loại công pháp"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="admin-field-hint">
              Đổi loại sẽ đặt lại các ô riêng của loại cũ
            </span>
          </label>
        </div>
      </section>

      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Thăng cấp</h4>
          {costPreview && (
            <span className="admin-form-section-hint admin-num">
              {costPreview}
            </span>
          )}
        </div>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span className="admin-field-label">Cấp tối đa</span>
            <input
              type="number"
              className={`admin-input admin-num${err("maxLevel") ? " invalid" : ""}`}
              value={numericValue(draft.maxLevel)}
              onChange={(e) => set("maxLevel", numeric(e.target.value))}
              disabled={saving}
              aria-label="Cấp tối đa"
            />
            {err("maxLevel") && (
              <span className="admin-field-error">
                {err("maxLevel")?.message}
              </span>
            )}
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Chi phí gốc (Linh Thạch)</span>
            <input
              type="number"
              className={`admin-input admin-num${err("baseCost") ? " invalid" : ""}`}
              value={numericValue(draft.baseCost)}
              onChange={(e) => set("baseCost", numeric(e.target.value))}
              disabled={saving}
              aria-label="Chi phí gốc"
            />
            <span className="admin-field-hint">Chi phí lên cấp 1 → 2</span>
            {err("baseCost") && (
              <span className="admin-field-error">
                {err("baseCost")?.message}
              </span>
            )}
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Hệ số tăng chi phí</span>
            <input
              type="number"
              step="0.1"
              className={`admin-input admin-num${err("costGrowth") ? " invalid" : ""}`}
              value={numericValue(draft.costGrowth)}
              onChange={(e) => set("costGrowth", numeric(e.target.value))}
              disabled={saving}
              aria-label="Hệ số tăng chi phí"
            />
            <span className="admin-field-hint">
              Mỗi cấp nhân thêm bấy nhiêu lần
            </span>
            {err("costGrowth") && (
              <span className="admin-field-error">
                {err("costGrowth")?.message}
              </span>
            )}
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Quy đổi khi trùng</span>
            <input
              type="number"
              className={`admin-input admin-num${err("dupRefundLinhThach") ? " invalid" : ""}`}
              value={numericValue(draft.dupRefundLinhThach)}
              onChange={(e) =>
                set(
                  "dupRefundLinhThach",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              disabled={saving}
              aria-label="Linh Thạch quy đổi khi redeem trùng"
            />
            <span className="admin-field-hint">
              (tùy chọn) Linh Thạch trả lại khi đổi mã trúng công pháp đã có —
              bỏ trống thì lấy chi phí gốc
            </span>
            {err("dupRefundLinhThach") && (
              <span className="admin-field-error">
                {err("dupRefundLinhThach")?.message}
              </span>
            )}
          </label>
        </div>
      </section>

      {draft.category === "passive" ? (
        <section className="admin-form-section">
          <div className="admin-form-section-head">
            <h4 className="admin-form-section-title">Hiệu ứng bị động</h4>
            <span className="admin-form-section-hint">
              cộng phẳng trước, phần trăm sau — cả hai nhân với cấp
            </span>
          </div>
          {err("effects") && (
            <p className="admin-field-error">{err("effects")?.message}</p>
          )}
          {(draft.effects ?? []).length === 0 && !err("effects") && (
            <p className="admin-row-empty">
              Chưa có hiệu ứng. Công pháp bị động cần ít nhất một hiệu ứng.
            </p>
          )}
          <div className="admin-row-list">
            {(draft.effects ?? []).map((effect, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: hàng theo vị trí, không có id ổn định
                key={i}
                className="admin-row"
              >
                <select
                  className="admin-input admin-row-grow"
                  value={effect.attribute}
                  aria-label={`Thuộc tính hàng ${i + 1}`}
                  disabled={saving}
                  onChange={(e) =>
                    setEffect(i, { attribute: e.target.value as AttributeKey })
                  }
                >
                  {ATTRIBUTE_ORDER.map((key) => (
                    <option key={key} value={key}>
                      {ATTRIBUTE_LABELS[key]}
                    </option>
                  ))}
                </select>
                <label className="admin-row-field">
                  Cộng phẳng/cấp
                  <input
                    type="number"
                    className="admin-input admin-num admin-row-num"
                    value={numericValue(effect.flatPerLevel)}
                    aria-label={`Cộng phẳng hàng ${i + 1}`}
                    disabled={saving}
                    onChange={(e) =>
                      setEffect(i, { flatPerLevel: numeric(e.target.value) })
                    }
                  />
                </label>
                <label className="admin-row-field">
                  Cộng %/cấp
                  <input
                    type="number"
                    className="admin-input admin-num admin-row-num"
                    value={numericValue(effect.pctPerLevel)}
                    aria-label={`Cộng phần trăm hàng ${i + 1}`}
                    disabled={saving}
                    onChange={(e) =>
                      setEffect(i, { pctPerLevel: numeric(e.target.value) })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="admin-btn admin-row-remove"
                  aria-label={`Xóa hiệu ứng hàng ${i + 1}`}
                  disabled={saving}
                  onClick={() => removeEffect(i)}
                >
                  <CloseIcon width={16} height={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="admin-btn admin-row-add"
            onClick={addEffect}
            disabled={saving}
          >
            + Thêm hiệu ứng
          </button>
        </section>
      ) : (
        <section className="admin-form-section">
          <div className="admin-form-section-head">
            <h4 className="admin-form-section-title">Kỹ năng chủ động</h4>
            <span className="admin-form-section-hint">
              lưu sẵn cho phase combat — chưa áp dụng vào chiến lực
            </span>
          </div>
          <div className="admin-form-grid">
            <label className="admin-field">
              <span className="admin-field-label">Sức mạnh mỗi cấp</span>
              <input
                type="number"
                className={`admin-input admin-num${err("powerPerLevel") ? " invalid" : ""}`}
                value={numericValue(draft.powerPerLevel)}
                onChange={(e) => set("powerPerLevel", numeric(e.target.value))}
                disabled={saving}
                aria-label="Sức mạnh mỗi cấp"
              />
              {err("powerPerLevel") && (
                <span className="admin-field-error">
                  {err("powerPerLevel")?.message}
                </span>
              )}
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Chân nguyên tiêu hao</span>
              <input
                type="number"
                className={`admin-input admin-num${err("chanNguyenCost") ? " invalid" : ""}`}
                value={numericValue(draft.chanNguyenCost)}
                onChange={(e) =>
                  set(
                    "chanNguyenCost",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                disabled={saving}
                aria-label="Chân nguyên tiêu hao"
              />
              <span className="admin-field-hint">
                (tùy chọn) bỏ trống nếu kỹ năng không tốn chân nguyên
              </span>
              {err("chanNguyenCost") && (
                <span className="admin-field-error">
                  {err("chanNguyenCost")?.message}
                </span>
              )}
            </label>
          </div>
        </section>
      )}

      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Phát hành</h4>
        </div>
        <div className="admin-form-grid">
          <label className="admin-field admin-field--wide">
            <span className="admin-field-label">Mô tả</span>
            <textarea
              className={`admin-input${err("desc") ? " invalid" : ""}`}
              value={draft.desc}
              onChange={(e) => set("desc", e.target.value)}
              rows={2}
              disabled={saving}
              aria-label="Mô tả công pháp"
            />
          </label>
        </div>
        <label className="admin-switch">
          <input
            type="checkbox"
            className="admin-switch-input"
            checked={draft.active}
            onChange={(e) => set("active", e.target.checked)}
            disabled={saving}
            aria-label="Đang kích hoạt"
          />
          <span className="admin-switch-track" aria-hidden="true" />
          <span className="admin-switch-text">
            <span className="admin-switch-title">Kích hoạt</span>
            <span className="admin-field-hint">
              Tắt để ẩn khỏi người chơi — công pháp đã sở hữu vẫn còn trong túi
              nhưng ngừng có tác dụng
            </span>
          </span>
        </label>
      </section>

      {saveError && <p className="admin-error">{saveError}</p>}

      <div className="admin-form-footer">
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={save}
          disabled={saving || errors.length > 0 || (!dirty && !isNew)}
        >
          {saving ? "Đang lưu…" : "Lưu"}
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={onCancel}
          disabled={saving}
        >
          {dirty ? "Hoàn tác" : "Đóng"}
        </button>
      </div>
    </div>
  );
```

Dòng preview chi phí `<p className="admin-congphap-cost-preview">` cũ bị bỏ — nó đã thành câu gợi ý của section "Thăng cấp".

- [ ] **Step 3: Đổi khối `GrantPanel` sang lớp trung tính**

Trong `GrantPanel`, thay:

```tsx
      <div className="admin-code-section-head">
        <h3 className="admin-code-section-title">Cấp thưởng</h3>
        <span className="admin-code-section-hint">
```

bằng:

```tsx
      <div className="admin-form-section-head">
        <h3 className="admin-form-section-title">Cấp thưởng</h3>
        <span className="admin-form-section-hint">
```

- [ ] **Step 4: Thay phần render danh sách + khung chi tiết của `AdminCongPhapPage`**

Thay khối `<div className="admin-pill-layout"> … </div>` bằng:

```tsx
      <div className="admin-master-detail">
        <div className="admin-master-list">
          {list.length === 0 && (
            <p className="admin-master-empty">
              Chưa có công pháp nào. Thêm công pháp đầu tiên.
            </p>
          )}
          {list.map((def) => {
            const meta = getCongPhapRarityMeta(def.rarity);
            return (
              <button
                key={def.id}
                type="button"
                className={`admin-master-item${def.active ? "" : " inactive"}`}
                aria-current={openId === def.id}
                onClick={() => requestOpen(openId === def.id ? null : def.id)}
              >
                <div className="admin-master-item-top">
                  <span className="admin-master-item-name">
                    <span
                      className="admin-row-glyph"
                      style={{ color: meta.color }}
                      aria-hidden="true"
                    >
                      {def.glyph}
                    </span>
                    {def.name}
                  </span>
                  <span
                    className={`admin-status admin-status--${def.active ? "ok" : "off"}`}
                  >
                    {def.active ? "Hoạt động" : "Đang tắt"}
                  </span>
                </div>
                <RarityPips rarity={def.rarity} color={meta.color} />
                <div className="admin-master-item-foot">
                  <span className="admin-num">{headline(def)}</span>
                  <span>
                    {def.category === "passive" ? "Bị động" : "Chủ động"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div
          className="admin-detail"
          style={
            headerMeta
              ? ({ "--detail-tone": headerMeta.color } as CSSProperties)
              : undefined
          }
        >
          {openId !== null && headerDef ? (
            <>
              <div className="admin-detail-head admin-detail-head--row">
                <span
                  className="admin-detail-glyph"
                  style={{ color: headerMeta?.color }}
                  aria-hidden="true"
                >
                  {headerDef.glyph || "功"}
                </span>
                <div className="admin-detail-head-main">
                  <h3 className="admin-detail-title">
                    {openId === "new"
                      ? "Thêm công pháp mới"
                      : headerDef.name || "(chưa có tên)"}
                  </h3>
                  <div className="admin-chips">
                    <span
                      className="admin-chip admin-chip--tint"
                      style={{ color: headerMeta?.color }}
                    >
                      {headerMeta?.name}
                    </span>
                    <span className="admin-chip">
                      {headerDef.category === "passive"
                        ? "Bị động"
                        : "Chủ động"}
                    </span>
                    <span className="admin-chip">
                      Tối đa cấp {headerDef.maxLevel}
                    </span>
                    {!headerDef.active && (
                      <span className="admin-chip admin-chip--danger">
                        Đang tắt
                      </span>
                    )}
                  </div>
                  <div className="admin-detail-gauge">
                    <RarityPips
                      rarity={headerDef.rarity}
                      color={headerMeta?.color ?? "var(--muted)"}
                      size="lg"
                    />
                    <span className="admin-detail-gauge-label">
                      <span className="admin-num">{headline(headerDef)}</span> ·{" "}
                      {headerMeta?.name}
                    </span>
                  </div>
                </div>
              </div>
              <CongPhapForm
                key={openId}
                initial={
                  openId === "new" ? emptyCongPhap() : (editing as CongPhapDTO)
                }
                isNew={openId === "new"}
                onSaved={onSaved}
                onCancel={() => setOpenId(null)}
                onDirtyChange={setDirtyOpen}
              />
            </>
          ) : (
            <div className="admin-detail-empty">
              <p>Chọn một công pháp để chỉnh sửa, hoặc thêm công pháp mới.</p>
            </div>
          )}
        </div>
      </div>
```

- [ ] **Step 5: Cập nhật import của trang công pháp**

Đầu file phải có `CloseIcon` và `RarityPips`; bỏ `formatNum` nếu không còn dùng ngoài `costPreview` và `GrantPanel` (`GrantPanel` vẫn dùng, nên giữ):

```tsx
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { RarityPips } from "@/components/rarity-pips";
```

- [ ] **Step 6: Chạy cổng**

```bash
cd /home/hayashi/working/tu-tien-chi-lo/frontend && pnpm lint && npx tsc --noEmit && pnpm test && pnpm build
```

Mong đợi: cả bốn xanh, `Tests 101 passed (101)`.

- [ ] **Step 7: Cổng con người**

`/admin/congphap` ở 375 / 768 / 1024 / 1440px. Kiểm: đổi Loại từ Bị động sang Chủ động thì section thứ ba đổi hẳn nội dung; hàng hiệu ứng xuống dòng gọn ở màn hẹp; preview chi phí hiện ở đầu section Thăng cấp; khối Cấp thưởng vẫn tìm và cấp được.

- [ ] **Step 8: Commit**

```bash
cd /home/hayashi/working/tu-tien-chi-lo && git add frontend/src/app/globals.css frontend/src/app/admin/congphap/page.tsx && git commit -m "feat(fe): trang công pháp dùng khuôn master/detail chung"
```

---

## Task 5: `/admin/realms` sang tab tiểu cảnh giới

**Files:**
- Create: `src/components/realm-curve.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/admin/realms/page.tsx`

**Interfaces:**
- Consumes: `curveHeights`, `CURVE_MIN_HEIGHT` (Task 2); lớp trung tính (Task 1, 3).
- Produces: component `RealmCurve({ values: number[]; size?: "sm" | "lg" })`. Lớp CSS `.admin-curve`, `.admin-curve--lg`, `.admin-curve-bar`, `.admin-tabs`, `.admin-tab`, `.admin-err-dot`, `.admin-detail-name-input`, `.admin-substage-id`, `.admin-substage-name`, `.admin-dirty`.

- [ ] **Step 1: Thêm CSS đường cong, tab, chấm lỗi**

Chèn vào `src/app/globals.css` ngay sau khối `.admin-field--wide`:

```css
/* Đường cong linh khí — gauge của trang cảnh giới. Cột dùng cùng nhịp với pip
   (khe 3px, ô co giãn) để ba loại gauge của khu admin đọc ra là một họ. */
.admin-curve {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 22px;
}

.admin-curve--lg {
  height: 40px;
}

.admin-curve-bar {
  flex: 1 1 0;
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  background: linear-gradient(180deg, var(--jade), rgba(93, 217, 177, 0.25));
}

/* Tab tiểu cảnh giới — mỗi lúc chỉ một tiểu cảnh giới nằm trong khung chi tiết. */
.admin-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.admin-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--fg-dim);
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease-out),
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.admin-tab:hover:not(:disabled) {
  border-color: var(--border-bright);
  color: var(--fg);
}

.admin-tab[aria-current="true"] {
  border-color: var(--gold);
  background: rgba(251, 191, 36, 0.1);
  color: var(--gold);
}

.admin-tab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Chấm đỏ đánh dấu mục đang có lỗi kiểm tra — dùng cho cả thẻ và tab, nên lỗi
   luôn nhìn thấy dù đang mở tab nào. */
.admin-err-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--red);
  flex: none;
}

/* Tên cảnh giới là danh tính bản ghi nên nó là ô nhập cỡ hero, không phải một ô
   thường trong lưới. */
.admin-detail-name-input {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

/* Dải danh tính của tiểu cảnh giới đang chọn, ngay dưới thanh tab. */
.admin-substage-id {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-5);
}

.admin-substage-name {
  flex: 1 1 240px;
}

/* Dấu hiệu "có thay đổi chưa lưu" ở thanh tiêu đề — nút Lưu nằm dưới chân khung
   chi tiết nên thanh tiêu đề phải tự nói được là đang có gì chờ lưu. */
.admin-dirty {
  font-size: 0.8rem;
  color: var(--gold);
}
```

- [ ] **Step 2: Tạo component `RealmCurve`**

Tạo `src/components/realm-curve.tsx`:

```tsx
"use client";

import { curveHeights } from "@/lib/realm-curve";

interface RealmCurveProps {
  /** linhKhiRequired của từng tiểu cảnh giới, theo thứ tự. */
  values: number[];
  size?: "sm" | "lg";
}

// Gauge của trang cảnh giới: mỗi tiểu cảnh giới một cột, chiều cao theo mức
// linh khí trên thang log. Chiếm đúng vị trí mà gauge lượt đổi (redeem code) và
// pip độ hiếm (danh mục) chiếm ở hai trang kia.
export function RealmCurve({ values, size = "sm" }: RealmCurveProps) {
  const heights = curveHeights(values);
  return (
    <div
      className={`admin-curve${size === "lg" ? " admin-curve--lg" : ""}`}
      aria-hidden
    >
      {heights.map((h, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: mỗi cột là một tiểu cảnh giới theo vị trí
          key={i}
          className="admin-curve-bar"
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Thêm state tab và hàm phụ trợ vào `src/app/admin/realms/page.tsx`**

Ngay sau `const [selectedRealm, setSelectedRealm] = useState(0);` thêm:

```tsx
  // Tiểu cảnh giới đang mở trong khung chi tiết. Giữ nguyên chỉ số khi đổi cảnh
  // giới (tiện so cùng một bậc giữa các cảnh giới) và kẹp lại nếu cảnh giới mới
  // có ít bậc hơn — cùng cách selectedRealm tự vệ.
  const [selectedSub, setSelectedSub] = useState(0);
```

Ngay trước `export default function AdminRealmsPage()` thêm:

```tsx
// "1.0K → 15.0K": khoảng linh khí một cảnh giới trải qua, từ bậc đầu tới bậc
// cuối. Ô đang gõ dở (NaN) hiện "?" thay vì "NaN".
function rangeLabel(realm: RealmConfigDTO): string {
  const stages = realm.subStages;
  if (stages.length === 0) return "—";
  const fmt = (v: number) => (Number.isFinite(v) ? formatNum(v) : "?");
  const first = fmt(stages[0].linhKhiRequired);
  if (stages.length === 1) return first;
  return `${first} → ${fmt(stages[stages.length - 1].linhKhiRequired)}`;
}
```

Thêm import `formatNum`:

```tsx
import { formatNum } from "@/lib/format";
import { RealmCurve } from "@/components/realm-curve";
import type { CSSProperties } from "react";
```

- [ ] **Step 4: Cho `addSubStage` / `removeSubStage` cập nhật tab đang chọn**

Thay hai hàm này bằng:

```tsx
  const addSubStage = (ri: number) => {
    updateDraft((d) => {
      const stages = d[ri].subStages;
      const last = stages[stages.length - 1];
      const next = emptyStage();
      if (last) {
        // Bắt đầu từ giá trị của bậc trước để quy tắc tăng dần đúng ngay từ đầu
        // và admin chỉ phải chỉnh phần chênh.
        Object.assign(next, last, {
          name: "Tân Kỳ",
          linhKhiRequired: Math.round(last.linhKhiRequired * 1.5),
        });
      }
      stages.push(next);
      return d;
    });
    // Mở luôn bậc vừa thêm.
    setSelectedSub(draft?.[ri]?.subStages.length ?? 0);
  };

  const removeSubStage = (ri: number, si: number) => {
    updateDraft((d) => {
      d[ri].subStages.splice(si, 1);
      return d;
    });
    // Các bậc sau bậc bị xóa dịch xuống một; kẹp về bậc cuối còn lại.
    setSelectedSub((sel) => {
      const remaining = (draft?.[ri]?.subStages.length ?? 1) - 1;
      const next = sel > si ? sel - 1 : sel;
      return Math.max(0, Math.min(next, remaining - 1));
    });
  };
```

- [ ] **Step 5: Thêm biến dẫn xuất cho tiểu cảnh giới đang chọn**

Ngay sau `const noStagesError = realm ? findError(errors, ri, null, null) : null;` thêm:

```tsx
  // Kẹp phòng thủ: draft có thể co lại dưới chân chỉ số đang giữ.
  const si = realm ? Math.min(selectedSub, realm.subStages.length - 1) : 0;
  const sub = realm && si >= 0 ? realm.subStages[si] : undefined;
  const subNameError = sub ? findError(errors, ri, si, "name") : null;

  // Một tiểu cảnh giới có lỗi nếu bất kỳ lỗi nào trỏ vào cặp chỉ số của nó.
  const subHasError = (realmIndex: number, subIndex: number) =>
    errors.some((e) => e.realmIndex === realmIndex && e.subIndex === subIndex);
```

- [ ] **Step 6: Thay toàn bộ khối `return (...)` của `AdminRealmsPage`**

```tsx
  return (
    <section>
      <div className="admin-topbar">
        <h2>Cấu hình cảnh giới</h2>
        {dirty && <span className="admin-dirty">Có thay đổi chưa lưu</span>}
      </div>

      {saveError && (
        <div className="admin-error">
          <span>{saveError}</span>
        </div>
      )}
      {globalError && (
        <div className="admin-error">
          <span>{globalError.message}</span>
        </div>
      )}
      {savedAt && !dirty && (
        <p style={{ color: "var(--muted)", marginBottom: "var(--space-3)" }}>
          Đã lưu lúc {savedAt.toLocaleTimeString("vi-VN")}
        </p>
      )}

      <div className="admin-master-detail">
        <div className="admin-master-list">
          {draft.map((r, index) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: cảnh giới là draft có thứ tự, đánh địa chỉ bằng chỉ số — chỉ số CHÍNH LÀ danh tính backend lưu.
              key={index}
              type="button"
              className="admin-master-item"
              aria-current={index === ri}
              onClick={() => setSelectedRealm(index)}
              disabled={saving}
            >
              <div className="admin-master-item-top">
                <span className="admin-master-item-name">
                  #{index} — {r.name || "(chưa có tên)"}
                </span>
                {realmHasError(index) && (
                  <span className="admin-status admin-status--danger">Lỗi</span>
                )}
              </div>
              <RealmCurve
                values={r.subStages.map((s) => s.linhKhiRequired)}
              />
              <div className="admin-master-item-foot">
                <span>{r.subStages.length} tiểu cảnh giới</span>
                <span className="admin-num">{rangeLabel(r)}</span>
              </div>
            </button>
          ))}
          <button
            type="button"
            className="admin-btn"
            onClick={addRealm}
            disabled={saving}
          >
            + Thêm cảnh giới
          </button>
        </div>

        {realm && (
          <div
            className="admin-detail"
            style={
              {
                "--detail-tone": realmHasError(ri)
                  ? "var(--red)"
                  : "var(--jade)",
              } as CSSProperties
            }
          >
            <div className="admin-detail-head">
              <RealmCurve
                values={realm.subStages.map((s) => s.linhKhiRequired)}
                size="lg"
              />
              <div className="admin-detail-id">
                <input
                  className={`admin-input admin-detail-name-input${realmNameError ? " invalid" : ""}`}
                  value={realm.name}
                  onChange={(e) => setRealmName(ri, e.target.value)}
                  disabled={saving}
                  aria-label={`Tên cảnh giới #${ri}`}
                />
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => removeRealm(ri)}
                  disabled={saving}
                >
                  Xóa cảnh giới
                </button>
              </div>
              <span className="admin-detail-gauge-label">
                Cảnh giới #{ri} · {realm.subStages.length} tiểu cảnh giới ·{" "}
                <span className="admin-num">{rangeLabel(realm)}</span> linh khí
              </span>
            </div>
            {realmNameError && (
              <div className="admin-field-error">{realmNameError.message}</div>
            )}
            {noStagesError && (
              <div className="admin-field-error">{noStagesError.message}</div>
            )}

            <div className="admin-tabs">
              {realm.subStages.map((s, i) => (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: tiểu cảnh giới cũng đánh địa chỉ bằng chỉ số.
                  key={i}
                  type="button"
                  className="admin-tab"
                  aria-current={i === si}
                  onClick={() => setSelectedSub(i)}
                  disabled={saving}
                >
                  {s.name || `#${i}`}
                  {subHasError(ri, i) && <span className="admin-err-dot" />}
                </button>
              ))}
              <button
                type="button"
                className="admin-tab"
                onClick={() => addSubStage(ri)}
                disabled={saving}
                aria-label="Thêm tiểu cảnh giới"
              >
                +
              </button>
            </div>

            {sub && (
              <>
                <div className="admin-substage-id">
                  <label className="admin-field admin-substage-name">
                    <span className="admin-field-label">
                      Tên tiểu cảnh giới
                    </span>
                    <input
                      className={`admin-input${subNameError ? " invalid" : ""}`}
                      aria-label={`Tên — tiểu cảnh giới #${si}, cảnh giới #${ri}`}
                      value={sub.name}
                      onChange={(e) =>
                        setSubField(ri, si, "name", e.target.value)
                      }
                      disabled={saving}
                    />
                    {subNameError && (
                      <span className="admin-field-error">
                        {subNameError.message}
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    className="admin-btn"
                    aria-label={`Xóa tiểu cảnh giới #${si} của cảnh giới #${ri}`}
                    onClick={() => removeSubStage(ri, si)}
                    disabled={saving}
                  >
                    Xóa tiểu cảnh giới
                  </button>
                </div>

                {SECTIONS.map((section) => (
                  <section className="admin-form-section" key={section.title}>
                    <div className="admin-form-section-head">
                      <h4 className="admin-form-section-title">
                        {section.title}
                      </h4>
                      <span className="admin-form-section-hint">
                        {section.hint}
                      </span>
                    </div>
                    <div className="admin-form-grid">
                      {section.fields.map((f) => {
                        const err = findError(errors, ri, si, f.key);
                        const value = sub[f.key] as number;
                        return (
                          <label className="admin-field" key={f.key}>
                            <span className="admin-field-label">{f.label}</span>
                            <input
                              type="number"
                              className={`admin-input admin-num${err ? " invalid" : ""}`}
                              aria-label={`${f.label} — tiểu cảnh giới #${si}, cảnh giới #${ri}`}
                              value={Number.isNaN(value) ? "" : value}
                              onChange={(e) =>
                                setSubField(ri, si, f.key, e.target.value)
                              }
                              disabled={saving}
                            />
                            {err && (
                              <span className="admin-field-error">
                                {err.message}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </>
            )}

            <div className="admin-form-footer">
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => void save()}
                disabled={!dirty || errors.length > 0 || saving}
              >
                {saving ? "Đang lưu…" : "Lưu tất cả"}
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={undo}
                disabled={!dirty || saving}
              >
                Hoàn tác
              </button>
              <span className="admin-field-hint">
                Lưu ghi đè toàn bộ cấu hình cảnh giới, không riêng cảnh giới
                đang chọn.
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
```

- [ ] **Step 7: Thay `NUMERIC_FIELDS` bằng `SECTIONS`**

Thay hằng `NUMERIC_FIELDS` ở đầu file bằng:

```tsx
// 12 ô số của một tiểu cảnh giới, chia làm ba nhóm theo việc chúng điều khiển:
// tích lũy, đột phá, và sàn thuộc tính.
const SECTIONS: {
  title: string;
  hint: string;
  fields: { key: keyof SubStageConfigDTO; label: string }[];
}[] = [
  {
    title: "Tu luyện",
    hint: "mốc tích đủ mới được phép đột phá",
    fields: [
      { key: "linhKhiRequired", label: "Linh khí cần" },
      { key: "cultivationRate", label: "Tốc độ tu" },
    ],
  },
  {
    title: "Đột phá",
    hint: "tỉ lệ gốc cộng dồn sau mỗi lần thất bại, chặn ở tỉ lệ tối đa",
    fields: [
      { key: "baseSuccessRate", label: "Tỉ lệ gốc (%)" },
      { key: "pityIncrement", label: "Cộng dồn (%)" },
      { key: "maxSuccessRate", label: "Tỉ lệ tối đa (%)" },
      { key: "punishmentSeconds", label: "Phạt (giây)" },
    ],
  },
  {
    title: "Thuộc tính nền",
    hint: "công pháp bị động cộng thêm lên trên các số này",
    fields: [
      { key: "baseKhiHuyet", label: "Khí huyết nền" },
      { key: "baseChanNguyen", label: "Chân nguyên nền" },
      { key: "baseCongVatLy", label: "Công vật lý nền" },
      { key: "baseCongPhep", label: "Công phép nền" },
      { key: "basePhongThu", label: "Phòng thủ nền" },
      { key: "baseTocDo", label: "Tốc độ nền" },
    ],
  },
];
```

- [ ] **Step 8: Chạy cổng**

```bash
cd /home/hayashi/working/tu-tien-chi-lo/frontend && pnpm lint && npx tsc --noEmit && pnpm test && pnpm build
```

Mong đợi: cả bốn xanh, `Tests 101 passed (101)`.

- [ ] **Step 9: Cổng con người**

`/admin/realms` ở 375 / 768 / 1024 / 1440px. Kiểm:
- Đường cong cột trái vẽ đúng dáng tăng dần; sửa `Linh khí cần` thì đường cong đổi ngay.
- Xóa ô `Linh khí cần` (để trống → NaN) thì đúng một cột tụt về 0, các cột khác giữ nguyên.
- Đổi cảnh giới sang cảnh giới ít bậc hơn thì tab tự kẹp, không trắng khung.
- Đặt hai bậc cùng `Linh khí cần` → tab bậc sau hiện chấm đỏ, thẻ cảnh giới hiện nhãn `Lỗi`, nút `Lưu tất cả` mờ đi.
- Thanh tab xuống dòng gọn ở 375px.

- [ ] **Step 10: Commit**

```bash
cd /home/hayashi/working/tu-tien-chi-lo && git add frontend/src/components/realm-curve.tsx frontend/src/app/globals.css frontend/src/app/admin/realms/page.tsx && git commit -m "feat(fe): trang cảnh giới dùng tab tiểu cảnh giới và đường cong linh khí"
```

---

## Task 6: Dọn CSS chết, cập nhật CLAUDE.md, cổng cuối

**Files:**
- Modify: `src/app/globals.css`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: mọi thứ Task 1–5 tạo ra.
- Produces: không có.

- [ ] **Step 1: Liệt kê lớp còn được dùng**

```bash
cd /home/hayashi/working/tu-tien-chi-lo/frontend && grep -o "admin-[a-z-]*" -r src/app src/components --include="*.tsx" | sed 's/.*://' | sort -u > /tmp/used.txt && grep -o "^\.admin-[a-z-]*" src/app/globals.css | sed 's/^\.//' | sort -u > /tmp/defined.txt && comm -13 /tmp/used.txt /tmp/defined.txt
```

Kết quả là danh sách lớp đã định nghĩa trong CSS nhưng không tìm thấy chỗ dùng.

**Danh sách này có báo nhầm.** Lớp nào được ghép bằng template string — `admin-status--${tone}`, `admin-pips--${size}`, `admin-meter--${size}` — thì grep chỉ thấy phần tiền tố, nên các biến thể `--ok`, `--warn`, `--danger`, `--off`, `--lg` sẽ bị liệt kê nhầm là chết. Trước khi xóa bất cứ lớp nào có `--` trong tên, grep lại phần gốc:

```bash
cd /home/hayashi/working/tu-tien-chi-lo/frontend && grep -rn "admin-status--\|admin-pips--\|admin-meter--\|admin-chip--\|admin-detail-head--\|admin-field--\|admin-curve--" src/app src/components --include="*.tsx"
```

- [ ] **Step 2: Xóa các lớp chết**

Xóa khỏi `src/app/globals.css` mọi quy tắc trong danh sách ở Step 1. Dự kiến gồm:

- Toàn bộ khối `/* ---- Admin pill catalog: master/detail (list + detail pane) ---- */`: `.admin-pill-layout`, `.admin-pill-list`, `.admin-pill-list-item` (+ `:hover`, `[aria-current="true"]`, `.inactive`), `.admin-pill-list-glyph`, `.admin-pill-list-meta`, `.admin-pill-list-name`, `.admin-pill-list-effect`, `.admin-pill-list-dot` (+ `.starter`, `.off`), `.admin-pill-detail`, `.admin-pill-detail-head`, `.admin-pill-glyph`, `.admin-pill-detail-head .admin-pill-glyph`, `.admin-pill-detail-title` (+ `h3`), `.admin-pill-chips`, `.admin-pill-detail-empty`, `.admin-pill-rarity`, `.admin-pill-effect-chip`, `.admin-pill-starter`, `.admin-pill-off`, `.admin-pill-form`, `.admin-pill-form-grid` (+ `label`, `label.admin-pill-active`), `.admin-pill-desc`, và khối `@media` chỉ chứa `.admin-pill-layout` / `.admin-pill-list`.
- Khối cảnh giới cũ: `.admin-realm-layout`, `.admin-realm-list`, `.admin-realm-list-item` (+ `:hover`, `[aria-current="true"]`, `.count`, `.err-dot`), `.admin-realm-list-foot`, `.admin-realm-detail`, `.admin-substage-card`, `.admin-substage-card-head`, `.admin-substage-grid`, `.admin-substage-field`.
- `.admin-congphap-cost-preview`, `.admin-congphap-effects`, `.admin-congphap-effect-row` (+ `label`), và nhánh `.admin-congphap-effect-row` trong khối `@media (max-width: 768px)` cuối file (giữ lại `.admin-grant-form` trong khối đó).
- `.admin-toolbar` nếu Step 1 xác nhận không còn chỗ dùng.

Không xóa thứ nào **không** có trong danh sách Step 1 — danh sách đó là bằng chứng, các gạch đầu dòng trên chỉ là dự kiến.

- [ ] **Step 3: Chạy cổng đầy đủ**

```bash
cd /home/hayashi/working/tu-tien-chi-lo/frontend && pnpm lint && npx tsc --noEmit && pnpm test && pnpm build
```

Mong đợi: cả bốn xanh, `Tests 101 passed (101)`.

- [ ] **Step 4: Cổng con người trên cả bốn trang**

Mở lần lượt `/admin/codes`, `/admin/pills`, `/admin/congphap`, `/admin/realms` ở 375 / 768 / 1024 / 1440px sau khi đã xóa CSS, xác nhận không trang nào mất kiểu.

- [ ] **Step 5: Cập nhật `CLAUDE.md`**

Trong mục **Admin dashboard (frontend)**, thay đoạn mô tả các trang bằng:

```markdown
- `/admin` inside the Next.js app, sidebar-rail **pro-dashboard** register (flat `.admin-panel`s, `--font-mono`/`.admin-num` for numerics, gold accents; rail collapses to top strip ≤768px). `admin/layout.tsx` = client-side guard (UX only — real enforcement is backend).
- **Cả bốn trang CRUD dùng chung một bộ khung trung tính** trong `globals.css`: `.admin-master-detail` (lưới 2 cột) · `.admin-master-list`/`-item`/`-empty` (thẻ rời cuộn được) · `.admin-status--ok|warn|danger|off` (mỗi trang tự ánh xạ trạng thái miền của mình vào 4 sắc thái) · `.admin-detail` (viền trên lấy màu từ biến inline `--detail-tone`) · `.admin-form` + `-section*` + `.admin-field*` + `.admin-switch*` + `.admin-form-footer` · `.admin-row*` (editor dạng hàng). Tên lớp mang nghĩa miền chỉ còn `.admin-code-string`, `.admin-code-reward-kind|qty*`.
- Gauge của từng trang lấy từ số liệu cân bằng thật: redeem code = lượt đã đổi (`.admin-pips`/`.admin-meter`), đan dược + công pháp = 5 pip độ hiếm (`RarityPips`, `rarityPipCount`), cảnh giới = đường cong linh khí thang log (`RealmCurve`, `curveHeights` trong `lib/realm-curve.ts`).
- `/admin/realms` sửa **một tiểu cảnh giới mỗi lúc** qua thanh tab (`.admin-tabs`/`.admin-tab`, chấm đỏ `.admin-err-dot` khi bậc đó lỗi); 12 ô số chia 3 section (Tu luyện · Đột phá · Thuộc tính nền). Nút `Lưu tất cả`/`Hoàn tác` nằm ở `.admin-form-footer` cuối cột phải — PUT vẫn là ghi đè toàn bộ.
- Quy ước nhãn ô: `/admin/codes` đánh dấu `*` cho ô bắt buộc; ba trang kia làm ngược lại — ô bắt buộc để trơn, ô tùy chọn ghi "(tùy chọn)" trong hint, vì ở đó gần như ô nào cũng bắt buộc.
- Backend: `GET /auth/me` (`requireAuth`, role from the **verified token**, not DB — mirrors what `requireAdmin` enforces this session), `GET /admin/stats` (`StatsRepository` port + `GetAdminStatsUseCase`; realm deleted from config labeled `"Realm #N"`).
- Frontend: `auth-context` probes `/auth/me` on mount, exposes `me`; `HeaderMenu` shows "Quản trị" when `me.role === "admin"`. Pure validation mirrors: `lib/realm-validation.ts`, `lib/pill-validation.ts`, `lib/redeem-validation.ts`, `lib/congphap-validation.ts` (pre-flight field errors; NaN from empty numeric input blocks Save). Draft editors disable all mutating controls while saving; index-keyed UI state is remapped on remove.
```

Trong mục **Commands & Environment**, sửa dòng test thành:

```markdown
- Current test counts: **backend 353, frontend 101**.
```

- [ ] **Step 6: Commit**

```bash
cd /home/hayashi/working/tu-tien-chi-lo && git add frontend/src/app/globals.css CLAUDE.md && git commit -m "chore(fe): dọn CSS admin không còn dùng + cập nhật CLAUDE.md"
```

---

## Ghi chú lệch so với spec

Hai điểm kế hoạch làm khác spec, đều theo hướng phục vụ đúng mục tiêu spec đặt ra:

1. **Cụm lớp phần thưởng được trích thành `.admin-row*` chứ không giữ nguyên tên riêng.** Spec liệt kê `.admin-code-reward-*` vào nhóm "giữ nguyên", nhưng cũng yêu cầu editor `effects[]` của công pháp "chuyển sang đúng kiểu hàng của phần thưởng redeem" — nghĩa là hai trang phải dùng chung kiểu hàng đó. Chỉ những lớp thật sự riêng của phần thưởng ở lại tên cũ: `.admin-code-reward-kind`, `-qty-wrap`, `-times`, `-qty`.

2. **Tên và nút xóa của tiểu cảnh giới nằm trong dải `.admin-substage-id` ngay dưới thanh tab, không nằm trong section nào.** Spec nói form có đúng 3 section (Tu luyện · Đột phá · Thuộc tính nền) và "nút Xóa tiểu cảnh giới ở cuối form"; nhét ô Tên vào một trong ba section đó thì section nào cũng đọc sai nghĩa. Dải danh tính riêng giữ đúng 3 section như spec, và đặt nút xóa cạnh thứ nó xóa.
