# Tu Tiên Chi Lộ (修仙之路)

Game tu tiên idle chạy trên web: tích lũy **linh khí** theo thời gian thực, **đột phá cảnh giới** vượt thiên kiếp, leo từ Phàm Nhân tới Thái Ất — 12 đại cảnh giới × 5 tiểu cảnh giới (Sơ Kỳ, Trung Kỳ, Hậu Kỳ, Đại Thành, Viên Mãn).

## Tính năng

- **Tu luyện idle** — linh khí tự tích lũy kể cả khi offline (công thức lazy accumulation, server là nguồn sự thật; client nội suy mỗi giây cho mượt).
- **Đột phá cảnh giới** — tỉ lệ thành công giảm dần theo cảnh giới, có **cơ chế pity** (mỗi lần thất bại tăng tỉ lệ lần sau) và **hình phạt** khóa đột phá có đếm ngược khi độ kiếp thất bại.
- **Đan dược** — kho đan dược cấp cho tân thủ khi đăng ký; dùng đan tăng linh khí, buff tốc độ tu luyện có hạn giờ, tăng tỉ lệ đột phá một lần, hoặc giải trừng phạt. Toàn bộ trạng thái do server nắm giữ (buff/boost sống sót qua reload).
- **Đan điền pháp trận** — vòng Hán tự xoay 3D (GSAP), hạt linh khí bay vào đan điền (canvas), hiệu ứng thiên kiếp sấm sét khi đột phá, parallax theo chuột.
- **Xác thực bằng cookie httpOnly** — access token 15 phút + refresh token 7 ngày (sliding renewal), client tự động refresh khi gặp 401 rồi phát lại request; JS không bao giờ chạm vào token.
- **Trang quản trị** (`/admin`, chỉ role `admin`) — thống kê người chơi, chỉnh cấu hình cảnh giới và catalog đan dược tại runtime (không cần deploy lại).
- **Bảo mật** — rate limit trên endpoint auth, thu hồi refresh token khi logout (`tokenVersion`), pin thuật toán JWT (HS256), header bảo mật qua `helmet`, và loạt boot guard (CORS bắt buộc, chặn secret mặc định ở production).

## Kiến trúc

```text
tu-tien-chi-lo/
├── backend/    Express + TypeScript + Prisma + PostgreSQL (Clean Architecture)
│   └── src/
│       ├── domain/          # công thức linh khí, pity, chuyển cảnh giới, đan dược — thuần, không framework
│       ├── application/     # use case: Register, Login, GetCultivationState, AttemptBreakthrough, ConsumePill…
│       ├── infrastructure/  # Prisma repo, JWT, bcrypt, seed cảnh giới/đan dược
│       └── presentation/    # routes, middleware (auth, admin, rate limit), cookies, error handler
├── frontend/   Next.js 16 (App Router) + React 19 + Tailwind 4 + GSAP
│   └── src/
│       ├── lib/         # types, api (fetch + silent refresh), auth-context, format, realm-constants
│       ├── hooks/       # use-cultivation-state (poll + nội suy), use-pill-inventory, use-toast
│       ├── components/  # dantian-formation, particle-canvas, breakthrough-overlay, pill-modal, header-menu…
│       └── app/         # /login, / (dashboard), /admin (+ /realms, /pills), globals.css
└── docs/superpowers/    # spec thiết kế + kế hoạch triển khai từng phase
```

Backend tuân thủ **Clean Architecture** nghiêm ngặt: phụ thuộc chỉ hướng vào trong, `domain/` không import framework. Ghi đè đồng thời được chặn bằng optimistic concurrency (`updateMany` theo `lastUpdateAt`) — hai request đột phá đua nhau thì một cái nhận 409.

## Chạy dự án

Yêu cầu: Docker + Docker Compose, Node.js 20+, pnpm. Frontend cần mạng khi build/dev (tải Google Fonts).

**1. Backend (API `:5000` + PostgreSQL):**

```bash
cd backend
cp .env.example .env        # đổi 2 secret khi deploy thật
docker compose up -d --build
curl http://localhost:5000/health   # → {"status":"ok"}
```

**2. Frontend (dev server `:3000`):**

```bash
cd frontend
pnpm install
echo 'NEXT_PUBLIC_API_BASE=http://localhost:5000' > .env.local
pnpm dev
```

Mở http://localhost:3000 → đăng ký tài khoản (tên 3–32 ký tự, mật khẩu ≥ 8) → bắt đầu tu luyện.

## API

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/auth/register` | Đăng ký (đồng thời đăng nhập, set cookie, cấp đan tân thủ) |
| `POST` | `/auth/login` | Đăng nhập, set cookie `access_token`/`refresh_token` |
| `POST` | `/auth/refresh` | Cấp cặp token mới (sliding, chỉ dùng cookie) |
| `POST` | `/auth/logout` | Xóa cookie + thu hồi refresh token (bump `tokenVersion`) |
| `GET` | `/auth/me` | Thông tin tài khoản hiện tại (`id`, `username`, `role`) |
| `GET` | `/cultivation/state` | Trạng thái tu luyện hiện tại (cần đăng nhập) |
| `POST` | `/cultivation/breakthrough` | Thử đột phá (server tự kiểm tra lại điều kiện) |
| `GET` | `/pills/inventory` | Kho đan dược của người chơi |
| `POST` | `/pills/consume` | Dùng một viên đan |
| `GET` | `/admin/stats` | Thống kê người chơi (chỉ admin) |
| `GET`/`PUT` | `/admin/realms` | Xem/ghi đè cấu hình cảnh giới (chỉ admin) |
| `GET`/`POST` | `/admin/pills` | Xem/tạo đan dược (chỉ admin) |
| `PUT` | `/admin/pills/:id` | Sửa/bật-tắt một đan dược (chỉ admin) |

Lỗi trả về dạng `{ "error": { "code", "message" } }`. Endpoint `/admin/*` cần role `admin` — cấp bằng SQL (`UPDATE "User" SET role='admin' WHERE username='<tên>';`) rồi đăng nhập lại để access token mang role mới.

## Kiểm thử

```bash
cd backend && npm test     # 228 test: unit (fake in-memory) + integration (Postgres thật)
cd frontend && pnpm test   # 48 test logic thuần: format, realm-constants, luồng refresh của api, validation
pnpm lint                  # Biome (frontend)
```

Hiệu ứng động (pháp trận, thiên kiếp, particle) được nghiệm thu bằng mắt người, không snapshot test.

## Tài liệu

- `CLAUDE.md` — quy tắc kiến trúc bắt buộc + nhật ký tiến độ từng task.
- `docs/superpowers/specs/` — spec thiết kế đã duyệt của từng phase (đọc trước khi sửa game logic).
- `docs/superpowers/plans/` — kế hoạch triển khai chi tiết từng bước.
