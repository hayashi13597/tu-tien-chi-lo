# Đồng bộ UI/UX ba trang admin theo khuôn redeem code

**Ngày:** 2026-07-26
**Phạm vi:** `/admin/pills`, `/admin/congphap`, `/admin/realms` (và đổi tên lớp CSS ở `/admin/codes`)
**Loại thay đổi:** trình bày — không đổi API, không đổi quy tắc nghiệp vụ

## Vấn đề

Bốn trang admin hiện không cùng một ngôn ngữ thị giác.

`/admin/codes` được làm sau cùng và có hai tầng riêng mà ba trang kia không có:

- **Tầng A — khung biểu mẫu.** Form chia thành `<section>` có tiêu đề và câu gợi ý; mỗi ô có nhãn riêng, dấu bắt buộc, dòng hint và lỗi nội tuyến; công tắc bật/tắt kiểu switch thay cho checkbox trần; hàng nút nằm trên một đường kẻ riêng; có empty state khi chưa chọn bản ghi nào.
- **Tầng B — bản sắc riêng.** Cột trái là các thẻ rời cuộn được, dính top; mã code là nhân vật chính; gauge đếm lượt đổi (pip khi giới hạn nhỏ, thanh liền khi lớn); nhãn trạng thái bốn màu; viền trên khung chi tiết nhuộm theo trạng thái.

Ba trang còn lại:

- `/admin/pills` — cột trái là các hàng dính liền trong một khung, form là một lưới `auto-fit` phẳng không chia nhóm, không hint, checkbox trần, không empty state ở danh sách.
- `/admin/congphap` — dùng lại nguyên bộ lớp `.admin-pill-*`, và mượn tạm `.admin-code-section-*` cho khối hiệu ứng lẫn khối cấp thưởng. Tên lớp "code" xuất hiện ở trang công pháp đọc lệch nghĩa.
- `/admin/realms` — khác hẳn: chọn một cảnh giới thì cột phải đổ ra cả 5 tiểu cảnh giới xếp chồng, mỗi thẻ 12 ô số, tổng khoảng 60 ô nhập trên một màn hình.

## Mục tiêu

1. Ba trang dùng chung bộ khung biểu mẫu của trang redeem code (tầng A).
2. Mỗi trang có chỉ báo trực quan riêng đóng vai trò như gauge của redeem code (tầng B), lấy từ **số liệu cân bằng thật** chứ không phải hình trang trí.
3. CSS gom về một bộ lớp trung tính, không còn tên lớp mang nghĩa sai miền.

## Ngoài phạm vi

- Giao diện người chơi (modal Đan Phòng, modal Công Pháp). Yêu cầu nhắm vào ba trang quản trị; "cảnh giới" vốn chỉ tồn tại ở phía quản trị.
- Tách khối **Cấp thưởng** ra trang riêng. Nó hơi lạc chỗ trên một trang danh mục, nhưng dời đi là thay đổi điều hướng nằm ngoài yêu cầu; ghi nhận lại để cân nhắc sau.
- Thêm tìm kiếm/sắp xếp/nhân bản bản ghi. Danh sách hiện tối đa 12 mục, chưa cần.
- Mọi thay đổi backend.

## Quyết định thiết kế

### 1. Trích bộ lớp CSS trung tính

Đổi tên các lớp `.admin-code-*` mang tính khung chung thành tên trung tính, dùng cho cả bốn trang. Đây là **đổi tên thuần**: quy tắc CSS giữ nguyên, JSX chỉ đổi chuỗi `className`.

| Hiện tại | Tên mới |
| --- | --- |
| `.admin-code-layout` | `.admin-master-detail` |
| `.admin-code-list` | `.admin-master-list` |
| `.admin-code-row` (+ `-top`, `-foot`) | `.admin-master-item` (+ `-top`, `-foot`) |
| `.admin-code-list-empty` | `.admin-master-empty` |
| `.admin-code-status` + biến thể | `.admin-status` + biến thể |
| `.admin-code-meter` / `-fill` | `.admin-meter` / `-fill` |
| `.admin-code-pips` / `.admin-code-pip` | `.admin-pips` / `.admin-pip` |
| `.admin-code-detail` (+ `-head`, `-title`, `-id`, `-empty`) | `.admin-detail` (+ tương ứng) |
| `.admin-code-gauge` / `-label` | `.admin-detail-gauge` / `-label` |
| `.admin-code-form` | `.admin-form` |
| `.admin-code-section` (+ `-head`, `-title`, `-hint`) | `.admin-form-section` (+ tương ứng) |
| `.admin-code-form-grid` | `.admin-form-grid` |
| `.admin-code-field` | `.admin-field` |
| `.admin-code-label` | `.admin-field-label` |
| `.admin-code-hint` | `.admin-field-hint` |
| `.admin-code-toggle` / `-input` / `-switch` / `-text` / `-title` | `.admin-switch` / `-input` / `-track` / `-text` / `-title` |
| `.admin-code-form-footer` | `.admin-form-footer` |

Giữ nguyên tên riêng cho thứ chỉ thuộc về redeem code: `.admin-code-string`, `.admin-code-string--lg`, và cụm phần thưởng (`.admin-code-reward-*`, `.admin-code-rewards-empty`, `.admin-code-add-reward`).

Các lớp `.admin-pill-*` chỉ còn giữ phần thật sự riêng của danh mục (glyph lớn, hàng chip). Những lớp bị thay thế hoàn toàn thì xóa, không để lại lớp chết.

`.admin-req` giữ nguyên tên.

### 2. Bảng sắc thái trạng thái

Bốn biến thể trạng thái cũ của redeem code gom thành bốn sắc thái trung tính:

| Sắc thái | Màu | Redeem code | Đan dược / Công pháp | Cảnh giới |
| --- | --- | --- | --- | --- |
| `ok` | `--jade` | Hoạt động | Hoạt động | (không dùng) |
| `warn` | `--gold` | Hết lượt | (không dùng) | (không dùng) |
| `danger` | `--red` | Hết hạn | (không dùng) | Lỗi |
| `off` | `--muted` | Đã tắt | Đang tắt | (không dùng) |

Trang redeem code nhìn không đổi: bốn trạng thái cũ ánh xạ 1–1 vào bốn sắc thái này.

Đan dược và công pháp chỉ có hai trạng thái thật (bật/tắt) nên chỉ dùng `ok` và `off`. Thông tin bổ sung — "Tân thủ ×2", "Bị động"/"Chủ động" — là **chip**, không phải trạng thái. Cảnh giới không có trạng thái vận hành; nhãn duy nhất là `Lỗi` khi kiểm tra dữ liệu không qua.

### 3. Viền trên khung chi tiết dùng biến CSS

Thay bốn lớp con `.admin-code-detail--*` bằng một biến `--detail-tone` đặt inline, mặc định `var(--border-bright)`:

```css
.admin-detail { border-top: 3px solid var(--detail-tone, var(--border-bright)); }
```

Cách này lặp lại đúng khuôn `--rarity` mà danh sách đan dược đang dùng. Nhờ đó redeem code nhuộm theo trạng thái, đan dược/công pháp nhuộm theo **màu độ hiếm**, cảnh giới nhuộm đỏ khi lỗi — mà CSS chỉ có một quy tắc.

### 4. Quy ước đánh dấu ô bắt buộc

Dấu `*` chỉ mang thông tin khi ô tùy chọn là số đông. Ở đan dược và công pháp gần như ô nào cũng bắt buộc; gắn sao khắp nơi thì sao mất tác dụng.

- **Redeem code:** giữ nguyên dấu `*` trên ô bắt buộc (ở đó ô tùy chọn mới là số đông).
- **Ba trang mới:** ô bắt buộc để trơn; ô tùy chọn ghi rõ "(tùy chọn)" trong dòng hint.

## Bố cục từng trang

### `/admin/pills` — Đan dược

Đan dược và công pháp là cùng một loại vật: danh mục định nghĩa có độ hiếm, glyph, cờ bật/tắt. Hai trang dùng chung một khuôn là kết luận đúng của thiết kế, không phải sự tiện tay.

**Cột trái** — thẻ rời:

- Dòng trên: glyph tô màu độ hiếm + tên + nhãn `Hoạt động` / `Đang tắt`.
- Gauge: **5 pip độ hiếm**, số pip sáng = `rarity + 1`, tô bằng màu độ hiếm. Dùng lại `.admin-pips` / `.admin-pip`.
- Chân thẻ: dòng mono tóm tắt hiệu ứng (`+50 linh khí`, `×1.5 trong 60s`) kèm chip `Tân thủ ×N` khi có.
- Empty state khi danh mục rỗng.

**Cột phải** — đầu khung giữ glyph lớn + tên + hàng chip như hiện tại, thêm dải pip độ hiếm và một câu tóm tắt (`Hiếm · Buff tốc độ tu · phát tân thủ ×2`). `--detail-tone` = màu độ hiếm.

**Section của form:**

1. **Nhận dạng** — ID (hint: định danh nội bộ, không đổi được sau khi tạo) · Tên · Glyph (hint: một ký tự Hán hiển thị trên viên đan) · Độ hiếm.
2. **Hiệu ứng** — chọn loại hiệu ứng + các ô số đổi theo loại. Câu gợi ý của section mô tả loại đang chọn.
3. **Phát hành** — Phát tân thủ (hint: 0 = không phát cho người chơi mới) · Mô tả · công tắc Kích hoạt.

Nút Lưu / Hoàn tác chuyển từ `.admin-toolbar` sang `.admin-form-footer`.

### `/admin/congphap` — Công pháp

**Cột trái và cột phải:** giống hệt đan dược. Chân thẻ tóm tắt là chuỗi hiệu ứng thuộc tính (`Khí huyết +10/cấp`) hoặc `Sức mạnh 100/cấp`, kèm chip `Bị động` / `Chủ động`.

**Section của form:**

1. **Nhận dạng** — ID · Tên · Glyph · Độ hiếm · Loại.
2. **Thăng cấp** — Cấp tối đa · Chi phí gốc · Hệ số tăng chi phí · Quy đổi khi trùng (tùy chọn). Dòng preview chi phí sẵn có trở thành câu gợi ý của section.
3. **Hiệu ứng bị động** *hoặc* **Kỹ năng chủ động**, hiện theo `category`:
   - Bị động: editor `effects[]` chuyển sang đúng kiểu hàng của phần thưởng redeem — chọn thuộc tính + hai ô số (cộng phẳng/cấp, cộng %/cấp) + nút xóa icon vuông.
   - Chủ động: Sức mạnh mỗi cấp · Chân nguyên tiêu hao (tùy chọn).
4. **Phát hành** — Mô tả · công tắc Kích hoạt.

**Khối Cấp thưởng** giữ nguyên vị trí cuối trang và nguyên hành vi, chỉ đóng lại trong `.admin-panel` + `.admin-form-section` chuẩn thay cho `.admin-code-section-*` mượn tạm.

### `/admin/realms` — Cảnh giới

Trang này là trình soạn hàng loạt: `PUT /admin/realms` ghi đè toàn bộ cấu hình, nên không có khái niệm "lưu một cảnh giới". Bố cục đổi, ngữ nghĩa lưu giữ nguyên.

**Cột trái** — thẻ rời mỗi cảnh giới:

- Dòng trên: `#0 Luyện Khí` + nhãn `Lỗi` (sắc thái `danger`) khi cảnh giới đó có lỗi kiểm tra; không có lỗi thì không hiện nhãn.
- Gauge: **cột đường cong linh khí** — mỗi tiểu cảnh giới một cột, chiều cao theo `linhKhiRequired` chuẩn hóa.
- Chân thẻ: `5 tiểu cảnh giới · 1.000 → 15.000`.

**Cột phải:**

- Đầu khung: đường cong cỡ lớn + ô nhập tên cảnh giới kiểu hero + nút Xóa cảnh giới. Tên cảnh giới nằm ở đầu khung chứ không trong form vì nó là danh tính của bản ghi đang xem — khác với redeem code chỗ danh tính chỉ để đọc.
- **Thanh tab tiểu cảnh giới**: `Sơ Kỳ … Viên Mãn`, tab có lỗi kiểm tra hiện chấm đỏ, cuối hàng là nút `+` thêm tiểu cảnh giới.
- Form của **tiểu cảnh giới đang chọn**, 3 section:
  1. **Tu luyện** — Linh khí cần (hint: mốc tích đủ mới được phép đột phá) · Tốc độ tu.
  2. **Đột phá** — Tỉ lệ gốc (%) · Cộng dồn mỗi lần thất bại (%) · Tỉ lệ tối đa (%) · Phạt (giây).
  3. **Thuộc tính nền** — 6 ô (hint: công pháp bị động cộng thêm lên trên các số này).
  - Nút Xóa tiểu cảnh giới ở cuối form.
- `.admin-form-footer`: **Lưu tất cả** + **Hoàn tác**, dời xuống từ thanh tiêu đề để cả bốn trang cùng một quy tắc "nút hành động nằm cuối cột phải". Nhãn giữ chữ "tất cả" vì phạm vi lưu là toàn bộ cấu hình.
- Thanh tiêu đề còn tên trang + dấu hiệu "có thay đổi chưa lưu" và dòng "Đã lưu lúc …".

**Đánh đổi đã chấp nhận:** mỗi lúc chỉ sửa được một tiểu cảnh giới, nên không còn đặt cạnh nhau 5 tiểu cảnh giới để so 11 chỉ số còn lại. Đường cong linh khí bù lại cho chỉ số quan trọng nhất; các chỉ số khác so bằng cách chuyển tab.

## Trạng thái và logic

**Trạng thái mới duy nhất:** chỉ số tiểu cảnh giới đang chọn ở `/admin/realms`, kẹp vào khoảng hợp lệ y như `selectedRealm` đang làm. Khi đổi cảnh giới, giữ nguyên chỉ số nếu còn hợp lệ (giúp so cùng một bậc giữa các cảnh giới), ngược lại kẹp về mục cuối.

**Giữ nguyên hoàn toàn:** mọi lời gọi API; `realm-validation.ts`, `pill-validation.ts`, `congphap-validation.ts`; cơ chế draft / dirty / `beforeunload` / xác nhận khi bỏ thay đổi; ngữ nghĩa lưu của cả bốn trang; `getRarityMeta`, `getCongPhapRarityMeta`.

**Logic mới duy nhất:** `src/lib/realm-curve.ts` thuần — chuẩn hóa dãy `linhKhiRequired` thành dãy chiều cao trong `[0, 1]`.

- Thang log, vì `linhKhiRequired` tăng theo cấp số nhân giữa các bậc; thang tuyến tính sẽ dí bốn cột đầu xuống sát đáy.
- Dãy rỗng → dãy rỗng. Một phần tử → `[1]`.
- Mọi giá trị bằng nhau → tất cả `1` (tránh chia cho 0).
- `NaN` hoặc `≤ 0` (admin đang gõ dở) → cột đó cao `0`, không làm hỏng cả dãy.

## Kiểm chứng

- **Unit test:** `realm-curve.test.ts` phủ các trường hợp trên. Đây là phần duy nhất có logic thật; phần còn lại là JSX và CSS.
- **Cổng tự động:** `pnpm lint` · `npx tsc --noEmit` · `pnpm test` · `pnpm build`.
- **Cổng con người:** đối chiếu hình ở 375 / 768 / 1024 / 1440px cho cả bốn trang. Theo quy ước dự án, phần nhìn và chuyển động không kiểm tự động.
- **Kiểm tra hồi quy quan trọng nhất:** `/admin/codes` phải trông y hệt trước khi đổi tên lớp. Bất kỳ khác biệt thị giác nào ở trang đó đều là lỗi của bước đổi tên.

## Rủi ro

| Rủi ro | Giảm thiểu |
| --- | --- |
| Đổi tên lớp làm vỡ `/admin/codes` | Đổi tên trong một bước riêng, không kèm thay đổi nào khác, rồi xem trang trước khi làm tiếp |
| Bỏ sót lớp cũ, còn CSS chết | Sau khi xong, `grep` từng lớp `.admin-code-*` còn lại phải khớp với một chỗ dùng thật trong `/admin/codes` |
| Tab tiểu cảnh giới che mất lỗi kiểm tra ở tab khác | Chấm đỏ trên tab, và chấm đỏ trên thẻ cảnh giới ở cột trái — lỗi luôn nhìn thấy dù đang ở tab nào |
| Thanh tab tràn ở màn hẹp | Tab cho phép xuống dòng; kiểm ở 375px |
