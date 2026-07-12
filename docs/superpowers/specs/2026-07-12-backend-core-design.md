# Thiết kế: Backend Core (Phase 1) — Tu Luyện & Đột Phá Cảnh Giới

**Ngày:** 2026-07-12
**Phạm vi:** Phase 1 trong 3 phase của việc xây dựng lại toàn bộ backend + frontend cho Tu Tiên Chi Lộ. Phase này chỉ gồm phần backend cốt lõi: đăng ký/đăng nhập cơ bản (JWT qua header, chưa có cookie) và cơ chế tu luyện/đột phá cảnh giới.

## 0. Bối cảnh: 3 phase của dự án

1. **Phase 1 (spec này): Backend core** — data model, config cảnh giới, auth JWT cơ bản, tu luyện & đột phá.
2. **Phase 2 (spec riêng, sau khi Phase 1 xong): Backend auth nâng cấp** — chuyển sang JWT access + refresh token qua httpOnly cookie, CORS, `/auth/refresh`, `/auth/logout`.
3. **Phase 3 (spec riêng, sau khi Phase 2 xong): Frontend** — Next.js app: trang đăng nhập/đăng ký, dashboard tu luyện với đầy đủ hiệu ứng (dantian formation, particle canvas, breakthrough overlay, realm path, stats panel, toast, cosmic background), polling/interpolation, tự động refresh token.

Mỗi phase có chu trình spec → plan → implementation riêng. Spec này chỉ thiết kế Phase 1.

**Ngoài phạm vi toàn bộ dự án** (không làm ở bất kỳ phase nào): item, công pháp, PK, guild, leaderboard, admin panel chỉnh config qua UI.

## 1. Tổng quan tính năng (Phase 1)

Người chơi có một nhân vật duy nhất, tự động tích lũy **linh khí** theo thời gian (không cần thao tác gì). Khi đủ linh khí, người chơi có thể chủ động thử **đột phá** lên tiểu cảnh giới tiếp theo. Đột phá có tỉ lệ thành công, có thể thất bại và bị phạt một khoảng thời gian trước khi được thử lại — nhưng linh khí vẫn tiếp tục tích trong lúc bị phạt.

## 2. Hệ thống cảnh giới

12 đại cảnh giới, mỗi đại cảnh giới có 4 tiểu cấp: Sơ → Trung → Viên Mãn → Đại Viên Mãn.

Phàm Nhân → Luyện Khí → Trúc Cơ → Kết Đan → Nguyên Anh → Hóa Thần → Phá Hư → Đại Thừa → Độ Kiếp → Chân Tiên → Kim Tiên → Thái Ất

Tổng cộng 12 × 4 = 48 mốc tiểu cấp. Thái Ất - Đại Viên Mãn là mốc tối đa (không đột phá tiếp được).

Đột phá luôn là bước "tiểu cấp hiện tại → tiểu cấp kế tiếp" (kể cả bước chuyển đại cảnh giới, vd Luyện Khí - Đại Viên Mãn → Trúc Cơ - Sơ), dùng chung một cơ chế.

Toàn bộ số liệu cấu hình (`linhKhiRequired`, `cultivationRate`, `baseSuccessRate`, `pityIncrement`, `maxSuccessRate`, `punishmentSeconds` cho từng tiểu cấp) giữ đúng bộ số liệu cân bằng đã được thiết kế cho hệ thống 12 realms × 4 substages này — đây là quyết định đã chốt (không tinh chỉnh lại số liệu ở phase này).

## 3. Stack kỹ thuật & môi trường dev

- Runtime: Node.js + TypeScript
- Framework: Express
- ORM: Prisma
- Database: PostgreSQL
- Auth (Phase 1 — dạng cơ bản, sẽ nâng cấp ở Phase 2): JWT access token (`JWT_SECRET`, hết hạn 7 ngày) trả về trong body response `POST /auth/login` (`{ token }`), xác thực qua header `Authorization: Bearer <token>`. Mật khẩu hash bằng bcrypt.
- Validation: Zod ở boundary route/controller
- Môi trường dev: Docker Compose gồm service `api` (Node, hot-reload qua volume mount) và `db` (Postgres); migration chạy qua Prisma CLI
- Testing: Vitest (unit + integration) + Supertest; integration test dùng Postgres thật qua Docker
- Toàn bộ code backend nằm trong thư mục `backend/` ở gốc repo

### 3.1 Kiến trúc: Clean Architecture (rule bắt buộc dự án)

Backend được tổ chức theo Clean Architecture, dependency luôn hướng vào trong:

```
backend/
  src/
    domain/            # entities + pure business logic, KHÔNG phụ thuộc framework/thư viện nào
      entities/         # Character, User (plain TS types)
      cultivation/       # computeLinhKhi (công thức tích lũy lazy)
      breakthrough/      # computeSuccessRate, rollSuccess, nextStage, isMaxStage
      ports/             # interfaces: UserRepository, CharacterRepository, PasswordHasher, TokenService
    application/        # use cases, chỉ phụ thuộc domain/ports, KHÔNG phụ thuộc infrastructure cụ thể
      RegisterUserUseCase.ts
      LoginUserUseCase.ts
      GetCultivationStateUseCase.ts
      AttemptBreakthroughUseCase.ts
    infrastructure/      # implement các port của domain
      config/realms.ts    # dữ liệu 12 realms x 4 substages (literal, tunable)
      db/prisma.ts         # Prisma client singleton
      repositories/         # PrismaUserRepository, PrismaCharacterRepository (có optimistic-concurrency guard)
      auth/                  # BcryptPasswordHasher, JwtTokenService
    presentation/        # Express: routes, controllers, middleware
      routes/auth.routes.ts
      routes/cultivation.routes.ts
      middleware/auth.ts       # requireAuth
      middleware/errorHandler.ts
      schemas/                  # Zod schemas cho request validation
    app.ts               # composition root: wire infrastructure → use cases → controllers, mount routes
    server.ts            # load env, app.listen
  prisma/
    schema.prisma
  docker-compose.yml
  Dockerfile
```

Quy tắc bắt buộc:

- `domain/` không được import bất kỳ thứ gì từ `infrastructure/` hoặc `presentation/`.
- `application/` chỉ phụ thuộc interface (port) khai báo trong `domain/`, không phụ thuộc trực tiếp Prisma/Express/jsonwebtoken.
- `infrastructure/` implement các port của `domain/`.
- `presentation/` dịch HTTP request/response ↔ input/output của use case; không chứa business logic.
- Composition root (`app.ts`) là nơi duy nhất khởi tạo instance cụ thể (Prisma client, bcrypt hasher, jwt service) và inject vào use case/controller.
- Toàn bộ logic nghiệp vụ không tầm thường (công thức tích linh khí, công thức pity, chuyển tiểu cấp/đại cảnh giới, optimistic-concurrency guard) phải có comment giải thích rõ _lý do_ và _cơ chế_ — không được để logic phức tạp mà không có comment.
- Trước khi viết code dùng API của bất kỳ thư viện nào (Express, Prisma, jsonwebtoken, zod, vitest...), tra cứu tài liệu qua `ctx7` CLI (context7) và đối chiếu đúng version ghi trong `package.json`.
- Sau khi hoàn thành mỗi task trong implementation plan, phải cập nhật `CLAUDE.md` để phản ánh kiến trúc/lệnh/ghi chú mới phát sinh từ task đó.

**Request flow:** `server.ts` (load env, listen) → `app.ts` (`createApp()` — composition root, lắp middleware/route, dùng trực tiếp trong test qua Supertest) → route/controller (`presentation/`) → use case (`application/`) → domain logic + repository port → repository implementation (`infrastructure/`) → Prisma.

## 4. Data model (Prisma schema, trong `infrastructure/db`)

```prisma
model User {
  id           String     @id @default(uuid())
  username     String     @unique
  passwordHash String
  createdAt    DateTime   @default(now())
  character    Character?
}

model Character {
  id                String    @id @default(uuid())
  userId            String    @unique
  user              User      @relation(fields: [userId], references: [id])

  realmMajor        Int       @default(0)   // 0 = Phàm Nhân ... 11 = Thái Ất
  realmSub          Int       @default(0)   // 0 Sơ, 1 Trung, 2 Viên Mãn, 3 Đại Viên Mãn
  linhKhi           Float     @default(0)   // Float, không Decimal — đủ độ chính xác cho ngưỡng lớn nhất (~88.5M)
  lastUpdateAt      DateTime  @default(now())

  breakthroughFails Int       @default(0)   // số lần thất bại liên tiếp tại tiểu cấp hiện tại (dùng cho pity)
  punishedUntil     DateTime?               // null = không bị trừng phạt

  createdAt         DateTime  @default(now())
}
```

Ghi chú thiết kế:

- `realmMajor`/`realmSub` là số nguyên thuần (không phải enum Postgres) để thêm cảnh giới mới trong tương lai không cần migration DB.
- `breakthroughFails` reset về 0 mỗi khi đột phá thành công.
- `punishedUntil` chỉ chặn hành động thử đột phá; linh khí vẫn tích bình thường bất kể giá trị này.
- Không có bảng config cảnh giới trong DB — toàn bộ nằm trong `infrastructure/config/realms.ts`.

## 5. Cơ chế tích linh khí (lazy calculation)

Không dùng cron/background job. Linh khí được tính lại mỗi khi có request cần đến nó (hàm thuần `computeLinhKhi` trong `domain/cultivation/`):

```
elapsedSeconds = min(now - lastUpdateAt, OFFLINE_CAP_SECONDS)  // OFFLINE_CAP_SECONDS = 24 * 3600
linhKhiHienTai = linhKhi (đã lưu) + elapsedSeconds * cultivationRate(realmMajor, realmSub)
```

- `GET /cultivation/state` **chỉ tính và trả kết quả, không ghi DB** mỗi lần gọi — tránh ghi DB liên tục khi client poll mỗi 10s.
- `POST /cultivation/breakthrough` **luôn ghi DB** (persist `linhKhi` + `lastUpdateAt` mới) như bước đầu tiên của xử lý, trên mọi nhánh xử lý kể cả khi bị từ chối, đảm bảo dữ liệu không bị mất giữa các lần đột phá.

## 6. Công thức đột phá (trong `domain/breakthrough/`)

```
successRate = min(baseSuccessRate + breakthroughFails * pityIncrement, maxSuccessRate)
```

- **Thành công:** tăng `realmSub` (hoặc `realmMajor+1, realmSub=0` nếu đang ở Đại Viên Mãn qua `nextStage()`); `linhKhi -= linhKhiRequired` (giữ phần dư, không reset về 0); `breakthroughFails = 0`; `punishedUntil = null`.
- **Thất bại:** `breakthroughFails += 1`; `punishedUntil = now + punishmentSeconds` (linh khí giữ nguyên, không bị trừ, vẫn tích bình thường trong lúc phạt).
- **Optimistic concurrency guard:** mọi write vào `Character` trong `AttemptBreakthroughUseCase` đi qua repository method dùng `updateMany` scoped theo giá trị `lastUpdateAt` đọc được ở đầu request — nếu request khác đã ghi trước, trả lỗi `409 CONCURRENT_MODIFICATION`. Ngăn hai lần đột phá đồng thời double-advance một nhân vật. `GetCultivationStateUseCase` không cần guard này vì không ghi DB.

## 7. API Endpoints

### Auth

- `POST /auth/register` — `{ username, password }` → `201 { id, username }`; tạo `User` + `Character` mặc định (Phàm Nhân - Sơ, `linhKhi=0`, `lastUpdateAt=now`)
- `POST /auth/login` — `{ username, password }` → `200 { token }` (JWT, hết hạn 7 ngày)

### Cultivation (yêu cầu JWT qua `requireAuth` middleware, header `Authorization: Bearer`)

- `GET /cultivation/state`:

  ```json
  {
    "realmMajor": 1,
    "realmSub": 2,
    "realmName": "Luyện Khí - Viên Mãn",
    "linhKhi": 1234.5,
    "linhKhiRequired": 2000,
    "canBreakthrough": false,
    "isMaxStage": false,
    "punishedUntil": null,
    "cultivationRate": 1.5
  }
  ```

- `POST /cultivation/breakthrough`:
  1. Tính linh khí hiện tại theo `computeLinhKhi`, ghi đè vào DB (`linhKhi`, `lastUpdateAt` mới) — luôn thực hiện trước, kể cả khi request sẽ bị từ chối ở bước sau.
  2. Validate: `linhKhi >= linhKhiRequired` và (`punishedUntil` là null hoặc đã qua) — nếu không thỏa, trả lỗi `400`.
  3. Nếu đã ở Thái Ất - Đại Viên Mãn (`isMaxStage`), trả lỗi `400` "đã đạt cảnh giới tối đa".
  4. Roll ngẫu nhiên theo `successRate` (mục 6).
  5. Áp dụng kết quả thành công/thất bại (mục 6), ghi qua repository với optimistic-concurrency guard.
  6. Trả về `{ success: true/false, character: {...} }`.

## 8. Error handling

- Validate input bằng Zod ở `presentation/schemas` → `400` kèm message rõ ràng khi input sai định dạng.
- `401` khi thiếu hoặc sai JWT.
- `409` khi register với `username` đã tồn tại, hoặc khi `409 CONCURRENT_MODIFICATION` xảy ra trong breakthrough.
- `400` khi thử đột phá mà chưa đủ linh khí, hoặc đang trong thời gian bị phạt (response kèm `punishedUntil` để client hiển thị đếm ngược).
- `400` khi thử đột phá lúc đã ở cảnh giới tối đa.
- Format lỗi thống nhất: `{ "error": { "code": "...", "message": "..." } }`, ném ra dưới dạng `AppError(status, code, message)` và render bởi một middleware xử lý lỗi duy nhất.

## 9. Testing

- **Unit test** (thuần logic trong `domain/`, không cần DB thật):
  - Công thức tính linh khí lazy (delta time × rate, có áp cap offline 24h)
  - Công thức tỉ lệ thành công theo pity (`breakthroughFails`, cap ở `maxSuccessRate`)
  - Logic carry-over linh khí dư khi đột phá thành công
  - Logic tăng `realmSub`/`realmMajor` đúng khi đột phá qua ranh giới đại cảnh giới
  - Cấu hình 12 realms × 4 substages đúng thứ tự, đúng số liệu
- **Integration test** (Postgres thật trong Docker): flow đăng ký → login → get state → breakthrough (mock nguồn ngẫu nhiên để ép thành công/thất bại) → kiểm tra state sau đó khớp kỳ vọng; test optimistic-concurrency guard bằng hai request ghi đồng thời.
- Không cần test UI/polling ở phạm vi backend Phase 1 này.

## 10. Phụ lục: dữ liệu đầy đủ `config/realms.ts`

Đây là nguồn số liệu chính thức duy nhất cho `config/realms.ts` của dự án này; implementation plan chỉ cần dùng bảng dưới đây, không cần tham chiếu sang repo nào khác.

```ts
export interface SubStageConfig {
  name: string;
  linhKhiRequired: number;
  cultivationRate: number;
  baseSuccessRate: number;
  pityIncrement: number;
  maxSuccessRate: number;
  punishmentSeconds: number;
}

export interface RealmConfig {
  name: string;
  subStages: [SubStageConfig, SubStageConfig, SubStageConfig, SubStageConfig];
}

export const REALMS: RealmConfig[] = [
  {
    name: "Phàm Nhân",
    subStages: [
      {
        name: "Sơ",
        linhKhiRequired: 100,
        cultivationRate: 1.0,
        baseSuccessRate: 90,
        pityIncrement: 10,
        maxSuccessRate: 95,
        punishmentSeconds: 300,
      },
      {
        name: "Trung",
        linhKhiRequired: 200,
        cultivationRate: 1.15,
        baseSuccessRate: 87,
        pityIncrement: 10,
        maxSuccessRate: 95,
        punishmentSeconds: 600,
      },
      {
        name: "Viên Mãn",
        linhKhiRequired: 350,
        cultivationRate: 1.3,
        baseSuccessRate: 84,
        pityIncrement: 10,
        maxSuccessRate: 95,
        punishmentSeconds: 900,
      },
      {
        name: "Đại Viên Mãn",
        linhKhiRequired: 500,
        cultivationRate: 1.45,
        baseSuccessRate: 81,
        pityIncrement: 10,
        maxSuccessRate: 95,
        punishmentSeconds: 1200,
      },
    ],
  },
  {
    name: "Luyện Khí",
    subStages: [
      {
        name: "Sơ",
        linhKhiRequired: 300,
        cultivationRate: 1.6,
        baseSuccessRate: 84,
        pityIncrement: 9.3,
        maxSuccessRate: 95,
        punishmentSeconds: 1500,
      },
      {
        name: "Trung",
        linhKhiRequired: 600,
        cultivationRate: 1.84,
        baseSuccessRate: 81,
        pityIncrement: 9.3,
        maxSuccessRate: 95,
        punishmentSeconds: 1800,
      },
      {
        name: "Viên Mãn",
        linhKhiRequired: 1050,
        cultivationRate: 2.08,
        baseSuccessRate: 78,
        pityIncrement: 9.3,
        maxSuccessRate: 95,
        punishmentSeconds: 2100,
      },
      {
        name: "Đại Viên Mãn",
        linhKhiRequired: 1500,
        cultivationRate: 2.32,
        baseSuccessRate: 75,
        pityIncrement: 9.3,
        maxSuccessRate: 95,
        punishmentSeconds: 2400,
      },
    ],
  },
  {
    name: "Trúc Cơ",
    subStages: [
      {
        name: "Sơ",
        linhKhiRequired: 900,
        cultivationRate: 2.56,
        baseSuccessRate: 78,
        pityIncrement: 8.6,
        maxSuccessRate: 95,
        punishmentSeconds: 2700,
      },
      {
        name: "Trung",
        linhKhiRequired: 1800,
        cultivationRate: 2.94,
        baseSuccessRate: 75,
        pityIncrement: 8.6,
        maxSuccessRate: 95,
        punishmentSeconds: 3000,
      },
      {
        name: "Viên Mãn",
        linhKhiRequired: 3150,
        cultivationRate: 3.33,
        baseSuccessRate: 72,
        pityIncrement: 8.6,
        maxSuccessRate: 95,
        punishmentSeconds: 3300,
      },
      {
        name: "Đại Viên Mãn",
        linhKhiRequired: 4500,
        cultivationRate: 3.71,
        baseSuccessRate: 69,
        pityIncrement: 8.6,
        maxSuccessRate: 95,
        punishmentSeconds: 3600,
      },
    ],
  },
  {
    name: "Kết Đan",
    subStages: [
      {
        name: "Sơ",
        linhKhiRequired: 2700,
        cultivationRate: 4.1,
        baseSuccessRate: 72,
        pityIncrement: 7.9,
        maxSuccessRate: 95,
        punishmentSeconds: 3900,
      },
      {
        name: "Trung",
        linhKhiRequired: 5400,
        cultivationRate: 4.71,
        baseSuccessRate: 69,
        pityIncrement: 7.9,
        maxSuccessRate: 95,
        punishmentSeconds: 4200,
      },
      {
        name: "Viên Mãn",
        linhKhiRequired: 9450,
        cultivationRate: 5.32,
        baseSuccessRate: 66,
        pityIncrement: 7.9,
        maxSuccessRate: 95,
        punishmentSeconds: 4500,
      },
      {
        name: "Đại Viên Mãn",
        linhKhiRequired: 13500,
        cultivationRate: 5.94,
        baseSuccessRate: 63,
        pityIncrement: 7.9,
        maxSuccessRate: 95,
        punishmentSeconds: 4800,
      },
    ],
  },
  {
    name: "Nguyên Anh",
    subStages: [
      {
        name: "Sơ",
        linhKhiRequired: 8100,
        cultivationRate: 6.55,
        baseSuccessRate: 66,
        pityIncrement: 7.2,
        maxSuccessRate: 95,
        punishmentSeconds: 5100,
      },
      {
        name: "Trung",
        linhKhiRequired: 16200,
        cultivationRate: 7.54,
        baseSuccessRate: 63,
        pityIncrement: 7.2,
        maxSuccessRate: 95,
        punishmentSeconds: 5400,
      },
      {
        name: "Viên Mãn",
        linhKhiRequired: 28350,
        cultivationRate: 8.52,
        baseSuccessRate: 60,
        pityIncrement: 7.2,
        maxSuccessRate: 95,
        punishmentSeconds: 5700,
      },
      {
        name: "Đại Viên Mãn",
        linhKhiRequired: 40500,
        cultivationRate: 9.5,
        baseSuccessRate: 57,
        pityIncrement: 7.2,
        maxSuccessRate: 95,
        punishmentSeconds: 6000,
      },
    ],
  },
  {
    name: "Hóa Thần",
    subStages: [
      {
        name: "Sơ",
        linhKhiRequired: 24300,
        cultivationRate: 10.49,
        baseSuccessRate: 60,
        pityIncrement: 6.5,
        maxSuccessRate: 95,
        punishmentSeconds: 6300,
      },
      {
        name: "Trung",
        linhKhiRequired: 48600,
        cultivationRate: 12.06,
        baseSuccessRate: 57,
        pityIncrement: 6.5,
        maxSuccessRate: 95,
        punishmentSeconds: 6600,
      },
      {
        name: "Viên Mãn",
        linhKhiRequired: 85050,
        cultivationRate: 13.63,
        baseSuccessRate: 54,
        pityIncrement: 6.5,
        maxSuccessRate: 95,
        punishmentSeconds: 6900,
      },
      {
        name: "Đại Viên Mãn",
        linhKhiRequired: 121500,
        cultivationRate: 15.2,
        baseSuccessRate: 51,
        pityIncrement: 6.5,
        maxSuccessRate: 95,
        punishmentSeconds: 7200,
      },
    ],
  },
  {
    name: "Phá Hư",
    subStages: [
      {
        name: "Sơ",
        linhKhiRequired: 72900,
        cultivationRate: 16.78,
        baseSuccessRate: 54,
        pityIncrement: 5.8,
        maxSuccessRate: 95,
        punishmentSeconds: 7500,
      },
      {
        name: "Trung",
        linhKhiRequired: 145800,
        cultivationRate: 19.29,
        baseSuccessRate: 51,
        pityIncrement: 5.8,
        maxSuccessRate: 95,
        punishmentSeconds: 7800,
      },
      {
        name: "Viên Mãn",
        linhKhiRequired: 255150,
        cultivationRate: 21.81,
        baseSuccessRate: 48,
        pityIncrement: 5.8,
        maxSuccessRate: 95,
        punishmentSeconds: 8100,
      },
      {
        name: "Đại Viên Mãn",
        linhKhiRequired: 364500,
        cultivationRate: 24.33,
        baseSuccessRate: 45,
        pityIncrement: 5.8,
        maxSuccessRate: 95,
        punishmentSeconds: 8400,
      },
    ],
  },
  {
    name: "Đại Thừa",
    subStages: [
      {
        name: "Sơ",
        linhKhiRequired: 218700,
        cultivationRate: 26.84,
        baseSuccessRate: 48,
        pityIncrement: 5.1,
        maxSuccessRate: 95,
        punishmentSeconds: 8700,
      },
      {
        name: "Trung",
        linhKhiRequired: 437400,
        cultivationRate: 30.87,
        baseSuccessRate: 45,
        pityIncrement: 5.1,
        maxSuccessRate: 95,
        punishmentSeconds: 9000,
      },
      {
        name: "Viên Mãn",
        linhKhiRequired: 765450,
        cultivationRate: 34.9,
        baseSuccessRate: 42,
        pityIncrement: 5.1,
        maxSuccessRate: 95,
        punishmentSeconds: 9300,
      },
      {
        name: "Đại Viên Mãn",
        linhKhiRequired: 1093500,
        cultivationRate: 38.92,
        baseSuccessRate: 39,
        pityIncrement: 5.1,
        maxSuccessRate: 95,
        punishmentSeconds: 9600,
      },
    ],
  },
  {
    name: "Độ Kiếp",
    subStages: [
      {
        name: "Sơ",
        linhKhiRequired: 656100,
        cultivationRate: 42.95,
        baseSuccessRate: 42,
        pityIncrement: 4.4,
        maxSuccessRate: 95,
        punishmentSeconds: 9900,
      },
      {
        name: "Trung",
        linhKhiRequired: 1312200,
        cultivationRate: 49.39,
        baseSuccessRate: 39,
        pityIncrement: 4.4,
        maxSuccessRate: 95,
        punishmentSeconds: 10200,
      },
      {
        name: "Viên Mãn",
        linhKhiRequired: 2296350,
        cultivationRate: 55.83,
        baseSuccessRate: 36,
        pityIncrement: 4.4,
        maxSuccessRate: 95,
        punishmentSeconds: 10500,
      },
      {
        name: "Đại Viên Mãn",
        linhKhiRequired: 3280500,
        cultivationRate: 62.28,
        baseSuccessRate: 33,
        pityIncrement: 4.4,
        maxSuccessRate: 95,
        punishmentSeconds: 10800,
      },
    ],
  },
  {
    name: "Chân Tiên",
    subStages: [
      {
        name: "Sơ",
        linhKhiRequired: 1968300,
        cultivationRate: 68.72,
        baseSuccessRate: 36,
        pityIncrement: 3.7,
        maxSuccessRate: 95,
        punishmentSeconds: 11100,
      },
      {
        name: "Trung",
        linhKhiRequired: 3936600,
        cultivationRate: 79.03,
        baseSuccessRate: 33,
        pityIncrement: 3.7,
        maxSuccessRate: 95,
        punishmentSeconds: 11400,
      },
      {
        name: "Viên Mãn",
        linhKhiRequired: 6889050,
        cultivationRate: 89.34,
        baseSuccessRate: 30,
        pityIncrement: 3.7,
        maxSuccessRate: 95,
        punishmentSeconds: 11700,
      },
      {
        name: "Đại Viên Mãn",
        linhKhiRequired: 9841500,
        cultivationRate: 99.64,
        baseSuccessRate: 27,
        pityIncrement: 3.7,
        maxSuccessRate: 95,
        punishmentSeconds: 12000,
      },
    ],
  },
  {
    name: "Kim Tiên",
    subStages: [
      {
        name: "Sơ",
        linhKhiRequired: 5904900,
        cultivationRate: 109.95,
        baseSuccessRate: 30,
        pityIncrement: 3.0,
        maxSuccessRate: 95,
        punishmentSeconds: 12300,
      },
      {
        name: "Trung",
        linhKhiRequired: 11809800,
        cultivationRate: 126.44,
        baseSuccessRate: 27,
        pityIncrement: 3.0,
        maxSuccessRate: 95,
        punishmentSeconds: 12600,
      },
      {
        name: "Viên Mãn",
        linhKhiRequired: 20667150,
        cultivationRate: 142.94,
        baseSuccessRate: 24,
        pityIncrement: 3.0,
        maxSuccessRate: 95,
        punishmentSeconds: 12900,
      },
      {
        name: "Đại Viên Mãn",
        linhKhiRequired: 29524500,
        cultivationRate: 159.43,
        baseSuccessRate: 21,
        pityIncrement: 3.0,
        maxSuccessRate: 95,
        punishmentSeconds: 13200,
      },
    ],
  },
  {
    name: "Thái Ất",
    subStages: [
      {
        name: "Sơ",
        linhKhiRequired: 17714700,
        cultivationRate: 175.92,
        baseSuccessRate: 24,
        pityIncrement: 2.3,
        maxSuccessRate: 95,
        punishmentSeconds: 13500,
      },
      {
        name: "Trung",
        linhKhiRequired: 35429400,
        cultivationRate: 202.31,
        baseSuccessRate: 21,
        pityIncrement: 2.3,
        maxSuccessRate: 95,
        punishmentSeconds: 13800,
      },
      {
        name: "Viên Mãn",
        linhKhiRequired: 62001450,
        cultivationRate: 228.7,
        baseSuccessRate: 18,
        pityIncrement: 2.3,
        maxSuccessRate: 95,
        punishmentSeconds: 14100,
      },
      {
        name: "Đại Viên Mãn",
        linhKhiRequired: 88573500,
        cultivationRate: 255.09,
        baseSuccessRate: 15,
        pityIncrement: 2.3,
        maxSuccessRate: 95,
        punishmentSeconds: 14400,
      },
    ],
  },
];

export const MAX_REALM_MAJOR = REALMS.length - 1;
```
