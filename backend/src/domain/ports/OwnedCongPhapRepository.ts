import { OwnedCongPhapEntry } from '../congphap/congphap';

export interface OwnedCongPhapRepository {
  // Toàn bộ công pháp user sở hữu (kèm định nghĩa, kể cả def inactive — caller lọc).
  listByUser(userId: string): Promise<OwnedCongPhapEntry[]>;
  getOne(userId: string, congPhapId: string): Promise<OwnedCongPhapEntry | null>;
  // Tạo bản sở hữu level 1 nếu chưa có. false nếu đã sở hữu (redeem trùng dùng cái này).
  grant(userId: string, congPhapId: string): Promise<boolean>;
  // Optimistic guard: tăng level lên +1 chỉ khi level hiện tại = expectedLevel.
  levelUpGuarded(userId: string, congPhapId: string, expectedLevel: number): Promise<boolean>;
  // Gỡ bất kỳ công pháp nào đang ở slot này (đặt equippedSlot=null). Cho phép thay slot.
  clearSlot(userId: string, slot: number): Promise<void>;
  // Đặt equippedSlot cho một công pháp sở hữu. false nếu không sở hữu.
  setSlot(userId: string, congPhapId: string, slot: number): Promise<boolean>;
  // equippedSlot=null. false nếu không sở hữu.
  unsetSlot(userId: string, congPhapId: string): Promise<boolean>;
}
