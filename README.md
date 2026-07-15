# Tu Tiên Chi Lộ (修仙之路)

Game tu tiên idle chạy trên web: tích lũy **linh khí** theo thời gian thực, **đột phá cảnh giới** vượt thiên kiếp, leo từ Phàm Nhân tới Thái Ất — 12 đại cảnh giới × 4 tiểu cảnh giới.

## Tính năng

- **Tu luyện idle** — linh khí tự tích lũy kể cả khi offline (công thức lazy accumulation, server là nguồn sự thật; client nội suy mỗi giây cho mượt).
- **Đột phá cảnh giới** — tỉ lệ thành công giảm dần theo cảnh giới, có **cơ chế pity** (mỗi lần thất bại tăng tỉ lệ lần sau) và **hình phạt** khóa đột phá có đếm ngược khi độ kiếp thất bại.
- **Đan điền pháp trận** — vòng Hán tự xoay 3D (GSAP), hạt linh khí bay vào đan điền (canvas), hiệu ứng thiên kiếp sấm sét khi đột phá, parallax theo chuột.
- **Xác thực bằng cookie httpOnly** — access token 15 phút + refresh token 7 ngày (sliding renewal), client tự động refresh khi gặp 401 rồi phát lại request; JS không bao giờ chạm vào token.

## Kiến trúc

```
tu-tien-chi-lo/
├── backend/    Express + TypeScript + Prisma + PostgreSQL (Clean Architecture)
│   └── src/
│       ├── domain/          # công thức linh khí, pity, chuyển cảnh giới — thuần, không framework
│       ├── application/     # use case: Register, Login, GetCultivationState, AttemptBreakthrough…
│       ├── infrastructure/  # Prisma repo, JWT, bcrypt, config cảnh giới
│       └── presentation/    # routes, middleware, cookies, error handler
├── frontend/   Next.js 16 (App Router) + React 19 + Tailwind 4 + GSAP
│   └── src/
│       ├── lib/         # types, api (fetch + silent refresh), auth-context, format, realm-constants
│       ├── hooks/       # use-cultivation-state (poll + nội suy), use-toast
│       ├── components/  # dantian-formation, particle-canvas, breakthrough-overlay…
│       └── app/         # /login, / (dashboard), globals.css
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
| `POST` | `/auth/register` | Đăng ký (đồng thời đăng nhập, set cookie) |
| `POST` | `/auth/login` | Đăng nhập, set cookie `access_token`/`refresh_token` |
| `POST` | `/auth/refresh` | Cấp cặp token mới (sliding, chỉ dùng cookie) |
| `POST` | `/auth/logout` | Xóa cookie |
| `GET` | `/cultivation/state` | Trạng thái tu luyện hiện tại (cần đăng nhập) |
| `POST` | `/cultivation/breakthrough` | Thử đột phá (server tự kiểm tra lại điều kiện) |

Lỗi trả về dạng `{ "error": { "code", "message" } }`.

## Kiểm thử

```bash
cd backend && npm test     # 100 test: unit (fake in-memory) + integration (Postgres thật)
cd frontend && pnpm test   # 19 test logic thuần: format, realm-constants, luồng refresh của api
pnpm lint                  # Biome (frontend)
```

Hiệu ứng động (pháp trận, thiên kiếp, particle) được nghiệm thu bằng mắt người, không snapshot test.

## Tài liệu

- `CLAUDE.md` — quy tắc kiến trúc bắt buộc + nhật ký tiến độ từng task.
- `docs/superpowers/specs/` — spec thiết kế đã duyệt của từng phase (đọc trước khi sửa game logic).
- `docs/superpowers/plans/` — kế hoạch triển khai chi tiết từng bước.
