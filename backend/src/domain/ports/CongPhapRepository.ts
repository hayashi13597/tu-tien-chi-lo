import { CongPhapRecord } from '../congphap/congphap';

export interface CongPhapRepository {
  findById(id: string): Promise<CongPhapRecord | null>;
  // Chỉ công pháp active — catalog cho người chơi.
  listActive(): Promise<CongPhapRecord[]>;
  // Toàn bộ kể cả inactive — admin.
  listAll(): Promise<CongPhapRecord[]>;
  create(def: CongPhapRecord): Promise<void>;
  // Full-row overwrite theo id; false nếu không có row.
  update(def: CongPhapRecord): Promise<boolean>;
}
