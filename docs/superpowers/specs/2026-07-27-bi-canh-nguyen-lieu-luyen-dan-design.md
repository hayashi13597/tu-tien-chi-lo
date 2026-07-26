# Bí cảnh idle, nguyên liệu, luyện đan và nâng cấp công pháp

## 1. Tóm tắt

Mở rộng game tu tiên idle bằng một vòng lặp thám hiểm bí cảnh chạy song song với tu luyện hiện tại. Người chơi chọn một trong tám nhánh, độ khó và thời lượng; server tự mô phỏng ba trận chiến theo lượt, lưu kết quả và cho nhận thưởng khi chuyến đi hoàn tất.

Phần thưởng cung cấp Linh Thạch, nguyên liệu luyện đan riêng theo nhánh và các nguyên liệu nâng cấp công pháp thuộc ba loại. Tám đan dược hiện có sẽ có công thức luyện riêng, xếp trong một hàng đợi offline không giới hạn. Nâng cấp công pháp sử dụng cả Linh Thạch và nguyên liệu công pháp tương ứng.

Đây là một master spec cho toàn bộ phạm vi đã chọn. Việc triển khai vẫn chia thành các milestone nội bộ để mỗi module có thể kiểm thử độc lập.

## 2. Mục tiêu và giới hạn

### Mục tiêu

- Tạo vòng lặp idle thứ hai mà không dừng tích lũy linh khí.
- Cho phép người chơi lựa chọn giữa chuyến ngắn, vừa và dài mà tổng giá trị phần thưởng trên mỗi đơn vị vé vẫn công bằng.
- Tái sử dụng thuộc tính, `battlePower`, công pháp và catalog đan dược hiện có.
- Cung cấp nguồn nguyên liệu rõ ràng cho tám công thức luyện đan và ba công pháp hiện tại.
- Bảo đảm mọi timer, tiêu hao và cấp thưởng hoạt động chính xác khi offline, refresh hoặc có request đua nhau.
- Giữ ranh giới Clean Architecture và tránh migrate toàn bộ hệ thống đan dược/công pháp sang item engine tổng quát.

### Không nằm trong phạm vi

- Đội hình nhiều nhân vật, linh thú hoặc đồng đội.
- Chiến đấu thủ công, realtime hoặc PvP.
- Thêm công pháp chủ động mới. Bốn slot vẫn tồn tại nhưng các slot chưa có công pháp sẽ được bỏ qua; phase này chỉ có `Liệt Hỏa Trảm` hoạt động.
- Nhiều slot bí cảnh đồng thời.
- Hủy chuyến bí cảnh hoặc hủy mẻ luyện đan có hoàn trả.
- Một hệ thống `ItemDefinition` tổng quát thay thế `Pill`, `InventoryItem` và `OwnedCongPhap` hiện có.

## 3. Các quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Nhân vật | Một nhân vật chính duy nhất |
| Vòng lặp | Bí cảnh chạy song song với tu luyện |
| Vé | 12 điểm/ngày, không tích lũy; ngày game đổi lúc 00:00 Asia/Bangkok |
| Chi phí thời lượng | 30 phút = 1 điểm, 2 giờ = 2 điểm, 8 giờ = 4 điểm |
| Slot bí cảnh | Mỗi người chơi chỉ có một chuyến đang chạy |
| Nhánh | 8 nhánh, mỗi nhánh có một nguyên liệu luyện đan riêng |
| Độ khó | Dễ/Vừa/Khó do người chơi chọn |
| Chuyến đi | 3 trận: 2 quái thường và 1 thủ lĩnh |
| Chiến đấu | Tự động theo lượt; tối đa 4 slot chủ động, slot trống bỏ qua |
| Scaling | Sức mạnh nền theo nhánh/độ khó, `battlePower` chỉ điều chỉnh trong biên độ giới hạn |
| Thất bại | Chuyến vẫn hoàn tất, phần thưởng giảm theo tiến độ |
| Nguyên liệu công pháp | 3 loại, cả 8 nhánh đều có thể rơi với trọng số khác nhau |
| Luyện đan | 8 công thức tương ứng 8 đan dược hiện có |
| Hàng đợi | Một lò, xếp không giới hạn khi còn đủ nguyên liệu |
| Offline | Bí cảnh và luyện đan đều tiếp tục khi offline |
| Giao diện | Tích hợp vào dashboard hiện tại bằng card và tab/drawer |
| Kiến trúc | Module riêng, giữ các model Pill/CongPhap hiện tại |

## 4. Kiến trúc và ranh giới module

### Backend

Các module domain mới nằm cạnh domain hiện có:

- `domain/materials/`: loại nguyên liệu, tồn kho, quy tắc cộng/trừ và bảng rơi.
- `domain/alchemy/`: công thức, kiểm tra nguyên liệu, thời lượng và settle hàng đợi.
- `domain/combat/`: mô phỏng lượt, thứ tự hành động, skill, cooldown và giới hạn lượt.
- `domain/expedition/`: nhánh, độ khó, điểm vé, snapshot, kết quả và phần thưởng.

Application layer thêm các use case cho đọc inventory, bắt đầu/nhận bí cảnh, đọc/xếp hàng luyện đan và nâng cấp công pháp với nguyên liệu. Infrastructure triển khai repository Prisma tương ứng. Presentation chỉ chịu trách nhiệm validation, mapping DTO, auth và error mapping.

Các module domain không import Prisma, Express hoặc framework. Combat, drop roll, cost formula và queue settlement đều là hàm/domain service thuần để có thể kiểm thử độc lập.

### Quy tắc phụ thuộc

```text
presentation → application → domain
infrastructure → domain ports

expedition → combat + materials
alchemy → materials + Pill catalog port
progression → materials + CongPhap port
```

`Pill`, `InventoryItem`, `CongPhap` và `OwnedCongPhap` hiện tại vẫn là nguồn dữ liệu cho đan dược/công pháp. Nguyên liệu có bảng catalog và inventory riêng, không làm thay đổi semantics của kho đan dược.

## 5. Mô hình dữ liệu đề xuất

### 5.1. Nguyên liệu

`Material`:

- `id`, `name`, `glyph`, `rarity`, `description`, `active`.
- Catalog gồm tám nguyên liệu luyện đan riêng theo nhánh và ba nguyên liệu nâng cấp công pháp.
- Soft-disable bằng `active`; không hard-delete material đã từng xuất hiện trong inventory.

`MaterialInventory`:

- `userId`, `materialId`, `quantity`.
- Unique `(userId, materialId)`.
- `increment` và `spend` đều có guard số lượng; quantity không thể âm.

### 5.2. Luyện đan

`AlchemyRecipe`:

- Một-nhiều với `AlchemyRecipeIngredient`.
- Quan hệ một-một với `Pill` để tám công thức tạo ra tám đan dược hiện có.
- `durationSec`, `linhThachCost`, `active`.

`AlchemyRecipeIngredient`:

- `recipeId`, `materialId`, `quantity`.
- Unique `(recipeId, materialId)`.
- Mỗi công thức dùng nhiều nguyên liệu từ các nhánh khác nhau.

`AlchemyJob`:

- `userId`, `recipeId`, `quantity`, `queuedAt`, `startsAt`, `completesAt`, `status`.
- `status` gồm `queued`, `running`, `completed`.
- Một job là một mẻ; endpoint có thể xếp nhiều mẻ liên tiếp.
- Khi enqueue, nguyên liệu và Linh Thạch được giữ/trừ ngay. Khi `completesAt` đã qua, mẻ được settle và cộng Pill vào `InventoryItem`.
- `startsAt` của job sau được tính nối tiếp từ thời điểm hoàn thành job trước; settlement chạy theo `queuedAt`.

### 5.3. Bí cảnh

`ExpeditionBranch`:

- Tám bản ghi, mỗi bản ghi có `alchemyMaterialId` của nhánh và cấu hình bảng rơi ba nguyên liệu công pháp.
- Có thông tin tên, glyph, mô tả, sức mạnh nền và active state.

`ExpeditionDifficulty`:

- Ba mức `easy`, `normal`, `hard` cho mỗi nhánh.
- Lưu hệ số sức mạnh địch, tỷ lệ rơi quái thường, tỷ lệ rơi thủ lĩnh và hệ số phần thưởng.

`ExpeditionDailyQuota`:

- Unique `(userId, gameDay)`.
- Lưu `spentUnits`; quota ngày là 12, điểm chưa dùng không chuyển sang `gameDay` kế tiếp.
- `gameDay` dùng múi giờ Asia/Bangkok để reset thống nhất với người chơi hiện tại.

`Expedition`:

- `userId`, `branchId`, `difficulty`, `durationSec`, `ticketCostUnits`.
- `startedAt`, `completesAt`, `status`, `seed`, `combatSnapshot`, `combatResult`, `rewardResult`, `claimedAt`.
- `status` gồm `running`, `completed`, `claimed`.
- Expedition ở trạng thái `completed` nhưng chưa claim vẫn giữ slot; người chơi phải claim trước khi bắt đầu chuyến mới.
- `combatSnapshot` bất biến, chứa cảnh giới, thuộc tính cuối, công pháp bị động và các slot chủ động tại lúc bắt đầu.
- `combatResult` chứa kết quả ba trận và số trận thắng.
- `rewardResult` chứa phần thưởng đã roll, được lưu trước khi người chơi claim để retry không tạo phần thưởng mới.

### 5.4. Công pháp

Mỗi `CongPhap` trong ba công pháp hiện tại liên kết với một trong ba `Material` nâng cấp và có cấu hình chi phí nguyên liệu. Chi phí Linh Thạch hiện tại vẫn được giữ.

Nếu cần lưu chi phí từng cấp chính xác, dùng bảng requirement riêng; trong phase đầu có thể dùng `baseMaterialCost` và `materialCostGrowth` cùng công thức tăng cấp hiện tại.

## 6. Quy tắc nghiệp vụ

### 6.1. Điểm vé và thời lượng

- Mỗi ngày người chơi có 12 điểm.
- 30 phút tiêu 1 điểm, 2 giờ tiêu 2 điểm, 8 giờ tiêu 4 điểm.
- Điểm được trừ lúc bắt đầu, không hoàn khi chuyến đã bắt đầu.
- Chỉ có một `running` expedition trên mỗi người chơi.
- Một expedition đã hoàn tất nhưng chưa claim cũng giữ slot; mọi request đọc/bắt đầu đều settle trước rồi áp dụng quy tắc này.
- Dùng quota theo `gameDay`, không dùng balance carry-over. Request đầu tiên của ngày mới tự tạo quota ngày đó.
- Ngân sách phần thưởng cơ bản tỷ lệ với `ticketCostUnits`; duration không tạo thêm giá trị trên mỗi điểm, chỉ giúp giảm số lần người chơi phải quay lại.

### 6.2. Mô phỏng chiến đấu

Khi bắt đầu chuyến:

1. Kiểm tra auth, branch, difficulty, duration, quota và slot đang chạy.
2. Snapshot nhân vật.
3. Tạo seed và mô phỏng hai trận thường + một trận thủ lĩnh.
4. Lưu kết quả và reward roll trong cùng transaction với việc tiêu điểm vé.

Mỗi trận là mô phỏng theo lượt:

- `tocDo` quyết định thứ tự hành động.
- Nhân vật duyệt slot công pháp chủ động theo thứ tự. Slot trống bị bỏ qua.
- Skill chỉ được dùng khi đủ Chân Nguyên và không trong cooldown; nếu không đủ điều kiện, nhân vật dùng đòn đánh thường.
- MVP chỉ có `Liệt Hỏa Trảm`; ba slot còn lại để trống.
- Trận có giới hạn lượt cấu hình để tránh vòng lặp vô hạn.
- Seed được lưu để cùng một chuyến luôn có cùng kết quả.

### 6.3. Scaling và thất bại

Sức mạnh địch lấy từ cấu hình nhánh + độ khó. Công thức adaptive có dạng:

`enemyPower = branchBasePower × difficultyMultiplier × realmMultiplier × (1 + clamp(adaptiveCoefficient × (playerBattlePower − realmReferencePower) / realmReferencePower, −0.15, +0.15))`.

`adaptiveCoefficient`, `realmReferencePower` và các hệ số nền là dữ liệu seed/config. Cảnh giới là hệ số chính; `battlePower` chỉ điều chỉnh tối đa ±15% để người chơi vẫn cảm thấy tiến bộ. Độ khó cao phải đồng thời tăng enemy multiplier và reward/drop rate.

Nếu thua ở bất kỳ trận nào, chuyến vẫn chạy đến `completesAt` và nhận kết quả giảm. Hệ số theo số trận thắng là:

- 0 trận thắng: 25%.
- 1 trận thắng: 50%.
- 2 trận thắng: 75%.
- 3 trận thắng: 100%.

### 6.4. Rơi nguyên liệu

- Mỗi trận roll độc lập từ seed chuyến đi.
- Quái thường có tỷ lệ thấp hơn.
- Thủ lĩnh có tỷ lệ cao hơn.
- Nhánh luôn ưu tiên nguyên liệu luyện đan riêng của nó.
- Cả ba nguyên liệu công pháp có thể rơi ở mọi nhánh theo trọng số riêng của nhánh và độ khó.
- Tổng giá trị reward table được normalize theo `ticketCostUnits × difficultyRewardMultiplier`; branch chỉ thay đổi thành phần vật phẩm, không phá vỡ ngân sách theo điểm.
- Reward result được lưu trước khi claim; claim chỉ chuyển payload đã lưu vào inventory.

### 6.5. Luyện đan offline

- Tám recipe map vào tám Pill hiện có.
- Mỗi recipe yêu cầu nhiều nguyên liệu riêng và Linh Thạch.
- Enqueue trừ/giữ toàn bộ input ngay, vì vậy người chơi chỉ có thể xếp đến giới hạn nguyên liệu thực tế.
- Hàng đợi không giới hạn số job và chỉ có một lò.
- Mẻ đầu tiên chạy ngay nếu lò rảnh; mẻ sau bắt đầu nối tiếp.
- Mọi GET/POST liên quan tới queue đều settle các mẻ đã hoàn thành trước khi trả dữ liệu hoặc thêm job.
- Mẻ hoàn thành khi offline vẫn tạo Pill đúng một lần.
- MVP không có cancel/refund.

### 6.6. Nâng cấp công pháp

- Người chơi cần đủ Linh Thạch, nguyên liệu công pháp và chưa đạt `maxLevel`.
- Công thức Linh Thạch hiện tại được giữ; nguyên liệu dùng `round(baseMaterialCost × materialCostGrowth^(level−1))`.
- Thao tác nâng cấp phải atomically spend cả hai tài nguyên và guard level cũ.
- Race thua trả 409, không được để một tài nguyên bị trừ mà cấp không tăng.

## 7. API và dữ liệu trả về

### Bí cảnh

- `GET /expeditions/branches`: tám nhánh, ba độ khó, thời lượng hợp lệ và preview cost/reward.
- `GET /expeditions/current`: quota ngày, điểm đã dùng/còn lại và chuyến hiện tại đã settle.
- `POST /expeditions/start`: nhận `branchId`, `difficulty`, `durationSec`; trả expedition đang chạy.
- `POST /expeditions/claim`: claim expedition đã hoàn tất; idempotency được bảo đảm bằng guard trạng thái.

### Nguyên liệu và luyện đan

- `GET /materials/inventory`: inventory material sau settlement.
- `GET /alchemy/recipes`: recipe active, input, cost, output và duration.
- `GET /alchemy/queue`: queue sau settlement, gồm mẻ đang chạy và mẻ chờ.
- `POST /alchemy/queue`: nhận `recipeId`, `quantity`; reserve input và thêm các job tuần tự.

### Công pháp

- `POST /congphap/levelup` giữ endpoint hiện tại, bổ sung kiểm tra và tiêu hao nguyên liệu công pháp.
- Response state phải trả số dư Linh Thạch, material inventory liên quan và level mới để client đồng bộ.

Mọi response lỗi giữ shape hiện tại `{ error: { code, message } }`.

## 8. Lỗi và nhất quán dữ liệu

Các mã lỗi chính:

- `EXPEDITION_BRANCH_NOT_FOUND` 404.
- `EXPEDITION_ACTIVE` 409.
- `EXPEDITION_NOT_COMPLETE` 409.
- `EXPEDITION_ALREADY_CLAIMED` 409.
- `INSUFFICIENT_EXPEDITION_TICKETS` 409.
- `INVALID_EXPEDITION_CONFIG` 400.
- `MATERIAL_NOT_FOUND` 404.
- `INSUFFICIENT_MATERIALS` 409.
- `ALCHEMY_RECIPE_NOT_FOUND` 404.
- `ALCHEMY_QUEUE_INVALID` 400.
- `ALCHEMY_JOB_CONFLICT` 409.
- `INSUFFICIENT_LINH_THACH` 409.
- `CONCURRENT_MODIFICATION` 409.

Repository rules:

- Start expedition: check active slot, atomically spend quota, create expedition and persist snapshot/result.
- Claim expedition: update only when `status = completed AND claimedAt IS NULL`, then grant the stored reward payload in the same transaction.
- Enqueue alchemy: settle queue, atomically decrement all ingredients/Linh Thạch, then append job.
- Level up: spend resources and update `OwnedCongPhap.level` under the old-level guard in one repository transaction.
- Material increments are upserts under `(userId, materialId)`; existing pill increments continue to use `(userId, pillId)`.

## 9. Frontend

Dashboard hiện tại vẫn là màn hình chính. Thêm hai card:

- Card Bí cảnh: quota còn lại, chuyến đang chạy, branch/difficulty, countdown và claim.
- Card Luyện đan: mẻ hiện tại, ETA và số job đang chờ.

Khu vực tích hợp dạng tab/drawer có hai tab:

- Bí cảnh: chọn branch → difficulty → duration → xem reward preview → start.
- Luyện đan: xem tám recipe, nguyên liệu, chi phí, duration và enqueue.

Client không optimistic update số dư, vé hoặc phần thưởng. Sau mutation, chờ server rồi refetch inventory, queue, expedition và cultivation state liên quan. Countdown chỉ nội suy từ `startedAt`/`completesAt`; server mới quyết định completed hay chưa.

## 10. Kiểm thử và tiêu chí nghiệm thu

### Domain unit tests

- Ticket cost 1/2/4, quota 12 và reset theo game day.
- Turn order, skill priority, Chân Nguyên, cooldown và empty slots.
- Ba encounter, branch/difficulty scaling và adaptive clamp.
- Reward multiplier 25/50/75/100 và drop roll normal/boss.
- Recipe validation, material cost, queue start/end và offline settlement.
- Công thức cost nguyên liệu theo cấp.

### Backend integration tests

- Start bị từ chối khi thiếu điểm, có expedition đang chạy hoặc input không hợp lệ.
- Hai request start đồng thời chỉ tạo một chuyến và không tiêu vé hai lần.
- Claim lặp lại không cấp thưởng trùng.
- Chuyến và queue settle đúng sau thời gian offline.
- Enqueue đồng thời không làm quantity âm hoặc reserve quá số dư.
- Nâng cấp đồng thời chỉ một request thành công ở cùng level.
- Seed reward cố định không thay đổi sau retry.

### Frontend tests và nghiệm thu thủ công

- Validation branch/difficulty/duration, recipe và số lượng enqueue.
- Countdown, trạng thái queue, refresh sau mutation và lỗi 409.
- Kiểm tra trực quan dashboard ở 375/768/1024/1440px.
- Kiểm tra reload/offline-return: không mất timer, không nhân đôi reward, không hiển thị số dư cũ.

### Tiêu chí hoàn thành

1. Người chơi có thể dùng dashboard để chọn bất kỳ 8 nhánh, 3 độ khó và 3 thời lượng.
2. Một chuyến chạy song song với tu luyện, mô phỏng đúng ba trận và claim đúng một lần.
3. Điểm vé reset mỗi ngày, không carry-over và chi phí duration được áp dụng đúng.
4. Mỗi nhánh rơi đúng nguyên liệu luyện đan riêng cùng ba nguyên liệu công pháp theo trọng số.
5. Tám recipe có thể xếp không giới hạn khi đủ input và settle đúng khi offline.
6. Ba công pháp nâng cấp được bằng Linh Thạch + material tương ứng mà không xảy ra partial spend.
7. Các test domain/integration/frontend liên quan đều pass và UI không có lỗi responsive nghiêm trọng.

## 11. Milestone nội bộ

Master plan giữ chung một phạm vi nhưng triển khai theo thứ tự:

1. Material catalog/inventory, quota ngày và các port/repository cơ sở.
2. Recipe, alchemy queue, offline settlement và cấp Pill.
3. Material cost cho nâng cấp công pháp và transaction spend kép.
4. Combat simulator thuần, branch/difficulty/drop config và expedition lifecycle.
5. API, dashboard cards, tab/drawer và đồng bộ client.
6. Integration tests, race tests, responsive pass và cân bằng dữ liệu seed.

Mỗi milestone phải giữ nguyên các invariant đã nêu; không gộp generic item engine vào giữa quá trình.
