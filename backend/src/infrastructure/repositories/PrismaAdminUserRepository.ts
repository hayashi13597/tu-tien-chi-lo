import { PrismaClient } from '@prisma/client';
import { AdminUserEntry, AdminUserRepository } from '../../domain/ports/AdminUserRepository';

export class PrismaAdminUserRepository implements AdminUserRepository {
  constructor(private readonly client: PrismaClient) {}

  async search(query: string, limit: number): Promise<AdminUserEntry[]> {
    const rows = await this.client.user.findMany({
      // `contains` với chuỗi rỗng khớp mọi hàng => query rỗng tự nhiên thành
      // "trang đầu", không cần nhánh riêng. `insensitive` là tính năng Postgres.
      where: { username: { contains: query, mode: 'insensitive' } },
      include: { character: true },
      orderBy: { username: 'asc' },
      take: limit,
    });
    return rows.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      // Character là quan hệ optional trên schema; user nào thiếu (dữ liệu cũ)
      // vẫn phải chọn được để cấp Linh Thạch — hiện 0 thay vì loại khỏi kết quả.
      realmMajor: u.character?.realmMajor ?? 0,
      realmSub: u.character?.realmSub ?? 0,
      linhThach: u.character?.linhThach ?? 0,
    }));
  }
}
