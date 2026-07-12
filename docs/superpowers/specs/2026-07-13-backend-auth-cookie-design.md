# Thiết kế: Backend Auth Cookie Upgrade (Phase 2)

**Ngày:** 2026-07-13
**Phạm vi:** Phase 2 trong 3 phase của việc xây dựng lại backend + frontend cho Tu Tiên Chi Lộ. Phase này nâng cấp cơ chế xác thực từ JWT access-token-qua-header (Phase 1) sang cặp access + refresh token qua httpOnly cookie, cộng thêm CORS cho frontend Phase 3.

## 0. Bối cảnh

Phase 1 (đã merge vào `master`) issue một access token JWT sống 7 ngày trong body response của `POST /auth/login` (`{ token }`), caller phải tự lưu và gắn `Authorization: Bearer <token>` thủ công. Spec này thay bằng cặp access token (15 phút) + refresh token (7 ngày), cả hai đều là httpOnly cookie (access token vẫn được chấp nhận qua header cho caller không phải trình duyệt), thêm endpoint refresh và logout — để frontend Phase 3 dựa vào cookie jar của trình duyệt thay vì tự quản lý token trong JavaScript.

**Ngoài phạm vi Phase 2** (không làm ở phase này): không có bảng session/refresh-token trong DB, không có danh sách thu hồi (revocation list), không có cơ chế phát hiện refresh-token-reuse. Refresh token là JWT thuần túy, cách duy nhất để vô hiệu hóa sớm là chờ hết hạn — chấp nhận được với threat model của dự án ở giai đoạn này. Không có CSRF protection ngoài `SameSite=Lax` — chấp nhận được vì các request thay đổi trạng thái đều đã yêu cầu auth, và `Lax` chặn cookie bị gửi kèm trong `POST` cross-site.

## 1. Stack, cấu hình & biến môi trường

**Thư viện mới:** `cookie-parser` (điền `req.cookies`) và `cors` (middleware CORS chuẩn) — nhỏ, đã kiểm chứng rộng rãi, tránh các lỗi vặt khi tự viết tay (quoting thuộc tính cookie, xử lý `OPTIONS` preflight).

**Biến môi trường** (`backend/.env.example` + `docker-compose.yml`):
- `PORT=5000` (đổi từ `3000` ở Phase 1, nhường port `3000` cho frontend Next.js ở Phase 3)
- `CORS_ORIGIN=http://localhost:3000`
- `JWT_REFRESH_SECRET=dev-refresh-secret-change-me` (mới, **bắt buộc khác** `JWT_SECRET` — nếu dùng chung secret, một refresh token có thể xác thực thành công như access token hoặc ngược lại)

**Hai cookie**, cả hai đều `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: process.env.NODE_ENV === 'production'` (vẫn hoạt động qua `http://localhost` khi dev, bắt buộc HTTPS ở production):

| Cookie | Nội dung | `maxAge` |
|---|---|---|
| `access_token` | access JWT | `15 * 60 * 1000` (15 phút) |
| `refresh_token` | refresh JWT | `7 * 24 * 60 * 60 * 1000` (7 ngày) |

**CORS:** `cors({ origin: process.env.CORS_ORIGIN, credentials: true })`. Origin dạng wildcard (`*`) không hợp lệ khi `credentials: true` được bật, nên bắt buộc phải là một origin cụ thể — đủ dùng cho setup 1 frontend của dự án này.

`cookieParser()` và `cors(...)` được thêm vào composition root (`app.ts`), trước khi mount route.

## 2. Thiết kế token

**Mở rộng port `TokenService` có sẵn** (`domain/ports/TokenService.ts`), giữ nguyên 2 method cũ, thêm 2 method mới:

```ts
export interface TokenService {
  signAccessToken(userId: string): string;
  verifyAccessToken(token: string): { userId: string };
  signRefreshToken(userId: string): string;
  verifyRefreshToken(token: string): { userId: string };
}
```

**`JwtTokenService`** (`infrastructure/auth/JwtTokenService.ts`) implement cả 4 method, cần secret thứ hai trong constructor:

```ts
constructor(
  private readonly accessSecret: string,
  private readonly refreshSecret: string,
) {}
```

- `signAccessToken`: cơ chế không đổi, nhưng `expiresIn` rút từ `'7d'` xuống `'15m'`.
- `signRefreshToken`: ký bằng `refreshSecret`, `expiresIn: '7d'`.
- `verifyRefreshToken`: chỉ xác thực bằng `refreshSecret` — token ký bằng `accessSecret` (hoặc ngược lại) sẽ xác thực thất bại vì sai secret. Đây chính là cơ chế đảm bảo access token bị lộ không thể dùng làm refresh token và ngược lại.
- Cả hai method `verify*` giữ nguyên cách trích xuất chỉ `{ userId }` từ payload đã giải mã (không trả nguyên payload gồm `iat`/`exp`), đúng theo fix đã áp dụng ở Phase 1.

**Composition root** (`app.ts`) khởi tạo `JwtTokenService` với 2 biến môi trường: `new JwtTokenService(process.env.JWT_SECRET as string, process.env.JWT_REFRESH_SECRET as string)`.

## 3. Thay đổi use case

**`RegisterUserUseCase`** giờ cũng đăng nhập luôn cho user (đăng ký xong có phiên ngay, không cần gọi login riêng). Cần thêm dependency `TokenService`:

```ts
export interface RegisterUserOutput {
  id: string;
  username: string;
  accessToken: string;
  refreshToken: string;
}
```

Route dùng `accessToken`/`refreshToken` để set cookie, nhưng vẫn trả về đúng `{ id, username }` trong response body — không đổi so với Phase 1, nên caller không dùng cookie của `/auth/register` không bị ảnh hưởng bởi response shape.

**`LoginUserUseCase`** thêm field `refreshToken`:

```ts
export interface LoginUserOutput {
  token: string;        // access token — response body vẫn là { token } cho caller dùng header
  refreshToken: string; // chỉ dùng để set cookie, không bao giờ xuất hiện trong JSON body
}
```

**`RefreshAccessTokenUseCase` mới** (`application/RefreshAccessTokenUseCase.ts`):

```ts
export class RefreshAccessTokenUseCase {
  constructor(private readonly tokenService: TokenService) {}

  execute(refreshToken: string): { token: string; refreshToken: string } {
    // ném DomainError('INVALID_REFRESH_TOKEN', ...) nếu verifyRefreshToken throw
    // nếu không: issue một cặp access + refresh MỚI (sliding renewal — mỗi lần
    // refresh thành công gia hạn phiên thêm 7 ngày tính từ thời điểm đó)
  }
}
```

Không phụ thuộc `UserRepository` — refresh token là JWT thuần túy, không có bảng DB/danh sách thu hồi (khớp với mục "ngoài phạm vi" ở mục 0).

**Không có use case cho logout.** Không có business logic nào cả — không đọc DB, không validate, thậm chí không cần verify token (idempotent, luôn thành công). Xử lý trực tiếp trong route handler bằng cách xóa cả hai cookie.

## 4. Endpoints, `requireAuth`, và cookie helper

**`presentation/cookies.ts` (mới)** tập trung hóa thuộc tính cookie để 4 điểm gọi (register/login/refresh/logout) luôn đồng bộ:

```ts
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void { ... }
export function clearAuthCookies(res: Response): void { ... }
```

**`POST /auth/register`** — thay đổi hành vi: tạo `User`+`Character` (không đổi), giờ gọi thêm `signAccessToken`/`signRefreshToken` qua use case rồi set cả hai cookie. Response body không đổi: `201 { id, username }`.

**`POST /auth/login`** — thay đổi hành vi: response body vẫn đúng `200 { token }` (access token, cho caller dùng header), nhưng route giờ cũng set cả hai cookie trước khi trả response.

**Lưu ý bảo mật khi implement 2 route trên:** vì `RegisterUserOutput`/`LoginUserOutput` giờ chứa cả `refreshToken` thô, route **phải chọn field tường minh** cho response body (`res.json({ id: result.id, username: result.username })` / `res.json({ token: result.token })`) — tuyệt đối không được `res.json(result)` nguyên object, vì sẽ làm lộ `refreshToken` (và với register là cả `accessToken`) vào JSON body, phá vỡ toàn bộ mục đích của httpOnly cookie.

**`POST /auth/refresh` (mới)** — chỉ đọc `req.cookies?.refresh_token`, không có fallback qua header (mục đích chính là hoạt động được khi access token đã hết hạn). Thiếu/sai/hết hạn → `401 { error: { code: 'INVALID_REFRESH_TOKEN', message } }`. Thành công: set cả hai cookie mới, trả `200 { token }` (access token mới, cùng shape với login).

**`POST /auth/logout` (mới)** — không cần auth, luôn `200 { message: 'Logged out' }`, luôn xóa cả hai cookie qua `clearAuthCookies` bất kể có phiên hay không.

**`requireAuth`** (`presentation/middleware/auth.ts`) — thay đổi hành vi: kiểm tra `req.cookies?.access_token` trước; nếu không có, fallback về kiểm tra header `Authorization: Bearer` hiện tại; nếu cả hai đều không cho access token hợp lệ, trả `401 UNAUTHORIZED` y như hiện tại. Hoàn toàn additive — không đổi hành vi của caller hiện có. Refresh token dù đưa qua cookie hay header đều xác thực thất bại (sai secret), bị từ chối như mọi token không hợp lệ khác.

## 5. Error handling

Một error code mới: `INVALID_REFRESH_TOKEN` (401), chỉ trả về bởi `POST /auth/refresh`, thêm vào bảng `STATUS_BY_CODE` của `errorHandler` (nơi duy nhất map code→status, theo pattern đã thiết lập ở Phase 1). Response `UNAUTHORIZED` hiện có của `requireAuth` không đổi — chỉ có thêm một đường vào nữa (cookie ngoài header) và giờ canh giữ một token sống ngắn hơn.

## 6. Testing

Theo đúng phân lớp test đã thiết lập ở Phase 1 (unit cho logic thuần/use case, integration cho Postgres thật + HTTP):

- **Unit (`JwtTokenService`):** roundtrip sign/verify cho cả hai loại token; refresh token đưa vào `verifyAccessToken` (hoặc ngược lại) phải throw (sai secret).
- **Unit (`RefreshAccessTokenUseCase`):** refresh token hợp lệ → cặp token mới; không hợp lệ/hết hạn → `DomainError('INVALID_REFRESH_TOKEN', ...)`. Test với `FakeTokenService`, không dùng JWT thật.
- **Unit (`requireAuth`):** chỉ có cookie access hợp lệ → pass; chỉ có header hợp lệ → pass (case hiện có); cookie ưu tiên hơn khi cả hai cùng có mặt và trỏ tới user khác nhau; không có gì cả → 401; refresh token đưa qua cookie hoặc header đều → 401 (sai secret).
- **Integration (`supertest.agent(app)`, giữ cookie xuyên suốt các request):** register set cả hai cookie, và một request xác thực tiếp theo trên cùng agent thành công mà không cần header `Authorization`. Tương tự cho login. `/auth/refresh` với cookie hợp lệ → 200 + cookie mới có giá trị khác cookie cũ, agent vẫn gọi được route bảo vệ sau đó. `/auth/refresh` không có cookie hoặc cookie bị sửa → 401. `/auth/logout` trên agent đã đăng nhập → 200, xóa cả hai cookie, request tiếp theo trên agent đó (không header) → 401, và `/auth/refresh` trên agent đó cũng → 401. `/auth/logout` không có phiên trước đó vẫn → 200 (idempotent).
- **CORS smoke test:** request với `Origin: http://localhost:3000` nhận lại `Access-Control-Allow-Origin: http://localhost:3000` và `Access-Control-Allow-Credentials: true`.
