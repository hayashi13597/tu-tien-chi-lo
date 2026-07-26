// Read-model của admin khi cần chọn một người chơi (cấp thưởng): gộp User với
// Character để hiện đủ ngữ cảnh (cảnh giới, Linh Thạch) ngay trong ô tìm kiếm.
export interface AdminUserEntry {
  id: string;
  username: string;
  role: string;
  realmMajor: number;
  realmSub: number;
  linhThach: number;
}

export interface AdminUserRepository {
  /** Tìm theo username (chứa chuỗi, không phân biệt hoa thường).
   *  Chuỗi rỗng => trả trang đầu theo thứ tự username. */
  search(query: string, limit: number): Promise<AdminUserEntry[]>;
}
