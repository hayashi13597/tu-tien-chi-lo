# Admin Redesign — Đồng bộ visual với game

**Ngày:** 2026-07-21
**Phạm vi:** Visual + UX polish cho toàn bộ trang admin (`/admin`, `/admin/realms`, `/admin/pills`) và khung `admin/layout.tsx`. Không đổi API, không đổi luồng dữ liệu, không thêm dependency.

## Bối cảnh

Khu admin hiện tại cố ý để trơn: nền phẳng `var(--bg)`, bảng viền mỏng, nút phẳng, placeholder `Đang tải…` bằng text trơ. Trong khi đó phần game (`/`, `/login`) là một thế giới cosmic/glass: nền gradient tím-ngọc-vàng + starfield, glass surface (`backdrop-filter: blur`), accent gold/jade/purple, GSAP. Mục tiêu: admin trông như một phần liền mạch của thế giới game, giữ nguyên toàn bộ logic và luồng thao tác.

## Nguyên tắc

- **Tái sử dụng token sẵn có** trong `globals.css`: `--surface`, `--surface-2`, `--surface-elevated`, `--gold`, `--gold-deep`, `--gold-glow`, `--jade`, `--purple`, `--red`, `--border`, `--border-bright`, `--focus-ring`, spacing `--space-*`, radius, `--shadow-panel`, `--shadow-pop`, `--ease-out`, `--dur`, `--dur-fast`. Không định nghĩa token màu mới.
- **CSS-first.** Ưu tiên sửa `globals.css` (khối `.admin-*` từ dòng ~1386). Markup chỉ chỉnh khi cần thêm icon SVG, skeleton, hoặc wrapper cho empty/error state.
- **Không đổi API/logic.** Mọi `fetch*`, validation, draft/undo/save, guard, beforeunload giữ nguyên. Không đụng `lib/api.ts`, `lib/*-validation.ts`, `auth-context`.
- **YAGNI.** Không chuyển sang sidebar (giữ nav ngang), không thêm biểu đồ mới, không thêm thư viện.

## Chi tiết theo khu vực

### 1. Khung chung — `admin/layout.tsx` + CSS

- **Nền cosmic:** thêm lớp nền `cosmic-bg` (tái dùng class/gradient sẵn có) cho `.admin-shell`, nhưng giảm cường độ (opacity/độ đậm gradient thấp hơn trang game) để không nhiễu số liệu. Không bắt buộc starfield canvas — có thể chỉ dùng gradient tĩnh để tránh thêm JS; quyết định cuối ở bước plan, mặc định **chỉ gradient tĩnh** (không mount `ParticleCanvas`/starfield) cho đơn giản và nhẹ.
- **Header glass:** `.admin-header` thành glass bar — `background: var(--surface)`, `backdrop-filter: blur(10px)`, viền dưới `--border`, `--shadow-panel`. `.admin-title` giữ màu gold, thêm text-glow nhẹ.
- **Tabs nav:** `.admin-nav a` có transition màu + underline; active (`aria-current="page"`) có underline glow gold. Thêm icon SVG nhỏ cạnh mỗi nhãn (Thống kê / Cảnh giới / Đan dược / Về game). Icon lấy từ `components/icons.tsx`; thiếu icon nào thì thêm SVG mới vào file đó (stroke-based, cùng phong cách `ShieldIcon`). Không dùng emoji.
- **Loading placeholder:** `.admin-loading` (`Đang tải…`) nâng thành khối glass nhẹ căn giữa (có thể giữ chữ + thêm khung/spinner CSS đơn giản). Không dùng animated loading screen của game.

### 2. Trang Thống kê — `admin/page.tsx`

- **Stat cards** (`.admin-card`): glass surface (`--surface`), số `.value` lớn màu gold + text-glow nhẹ, thêm icon SVG và màu trạng thái phân biệt: Tổng người chơi = jade, Quản trị viên = gold, Đang chịu phạt = red. Cần thêm modifier class (vd `.admin-card--jade/--gold/--red`) hoặc data-attr trong markup để tô accent — thay đổi markup tối thiểu ở `admin/page.tsx`.
- **Reveal animation:** cards xuất hiện stagger khi load (~300ms, `--ease-out`, KHÔNG overshoot/bounce — data UI cần gọn). Ưu tiên CSS animation thuần (delay tăng dần) để khỏi thêm JS; nếu cần chính xác hơn có thể dùng GSAP đã có sẵn. Mặc định **CSS**.
- **Phân bố cảnh giới** (`.admin-table` + `.admin-bar`): giữ bảng và logic `maxCount`. Bar chuyển gradient tông game (gold→gold-deep đã có, tinh chỉnh). Hover row sáng nhẹ. Hiển thị `%` cạnh bar (dữ liệu đã có, chỉ format thêm — chỉnh markup nhỏ hoặc thuần CSS `::after`; mặc định thêm text `%` trong JSX). Empty state (`Chưa có nhân vật nào.`) trình bày trong khung thống nhất.
- **Error state** (`.admin-error`): giữ nguyên cấu trúc, đồng bộ style glass + màu red.

### 3. Trang Cảnh giới — `admin/realms/page.tsx`

- **Accordion realm** (`.admin-realm`, `.admin-realm-head`, `.admin-realm-body`): thành glass card. Header có chevron (▾/▸ hiện tại) — có thể thay bằng icon SVG xoay mượt (`transition: transform`), badge số tiểu cảnh giới nổi bật hơn. Toolbar (`.admin-toolbar`) có thể sticky nhẹ khi cuộn (tùy chọn, mặc định **không sticky** để đơn giản).
- **Input** (`.admin-input`): glass, focus ring gold (đã có global), `.invalid` viền đỏ rõ. `.admin-field-error` giữ đỏ.
- **Nút** (`.admin-btn`, `.admin-btn-primary`): thêm hover/transition mượt (150–300ms), primary có nền gold mờ + glow nhẹ khi hover.
- Bảng cuộn ngang (`.admin-realm-table-wrap`) giữ nguyên.

### 4. Trang Đan dược — `admin/pills/page.tsx`

- **Pill card** (`.admin-pill-card`, `.admin-pill-head`): glass surface. `.admin-pill-glyph` giữ màu theo rarity (`getRarityMeta`), thêm glow nhẹ. Badge `.admin-pill-off` (Đang tắt) và `.admin-pill-starter` (Tân thủ ×N) bo tròn pill-shape, màu phân biệt. `.inactive` giữ mờ.
- **Form** (`.admin-pill-form`, `.admin-pill-form-grid`): mở/đóng có transition nhẹ. Input đồng bộ với style realms. Không đổi logic form.
- Rarity color không hardcode — tiếp tục lấy từ `getRarityMeta`.

## Accessibility & Motion

- Giữ focus ring `--focus-ring` toàn cục (đã có).
- Mọi animation mới bọc trong `@media (prefers-reduced-motion: reduce)` để tắt/giảm.
- Touch target ≥44px (nút/tab/pill head — nhiều chỗ đã đạt, kiểm lại tab nav và nút nhỏ).
- Contrast text ≥4.5:1 trên nền glass (kiểm `--muted`/`--fg-dim` trên `--surface`).
- Không dùng emoji làm icon; chỉ SVG stroke-based.

## Không làm (YAGNI)

- Không chuyển sidebar; giữ nav ngang.
- Không thêm biểu đồ/loại dữ liệu mới.
- Không đổi endpoint, DTO, validation, hay bất kỳ luồng dữ liệu nào.
- Không thêm dependency (không thêm thư viện chart/animation mới; GSAP nếu dùng là bản đã có).
- Không đổi `lib/`, `auth-context`, backend.

## Tiêu chí hoàn thành

- Cả 3 trang + layout mang visual glass/cosmic đồng bộ game, dùng token sẵn có.
- Không có regression logic: guard redirect, load/refresh, draft/undo/save (realms), create/edit/toggle (pills), beforeunload đều hoạt động như trước.
- Gate xanh: `pnpm lint`, `pnpm tsc`/typecheck, `pnpm test` (số test không giảm — đây là thay đổi presentational, không kỳ vọng test mới), `pnpm build`.
- Kiểm mắt (human-observation gate): 3 trang render đúng ở 375/768/1024/1440px, animation tôn trọng reduced-motion.
