import { OwnedCongPhapRepository } from '../../src/domain/ports/OwnedCongPhapRepository';
import { OwnedCongPhapEntry } from '../../src/domain/congphap/congphap';

export class InMemoryOwnedCongPhapRepository implements OwnedCongPhapRepository {
  private entries: OwnedCongPhapEntry[] = [];
  private userId = '';

  /** Test helper — not part of the port — seed owned entries for a single user. */
  seed(userId: string, entries: OwnedCongPhapEntry[]): void {
    this.userId = userId;
    this.entries = entries;
  }

  async listByUser(userId: string): Promise<OwnedCongPhapEntry[]> {
    return userId === this.userId ? this.entries.map((e) => ({ ...e })) : [];
  }
  async getOne(userId: string, congPhapId: string): Promise<OwnedCongPhapEntry | null> {
    if (userId !== this.userId) return null;
    const e = this.entries.find((x) => x.def.id === congPhapId);
    return e ? { ...e } : null;
  }
  async grant(userId: string, congPhapId: string): Promise<boolean> {
    if (userId !== this.userId) this.userId = userId;
    if (this.entries.some((e) => e.def.id === congPhapId)) return false;
    return false;
  }
  async levelUpGuarded(): Promise<boolean> {
    return false;
  }
  async clearSlot(userId: string, slot: number): Promise<void> {
    if (userId !== this.userId) return;
    for (const e of this.entries) if (e.equippedSlot === slot) e.equippedSlot = null;
  }
  async setSlot(userId: string, congPhapId: string, slot: number): Promise<boolean> {
    if (userId !== this.userId) return false;
    const e = this.entries.find((x) => x.def.id === congPhapId);
    if (!e) return false;
    e.equippedSlot = slot;
    return true;
  }
  async unsetSlot(userId: string, congPhapId: string): Promise<boolean> {
    if (userId !== this.userId) return false;
    const e = this.entries.find((x) => x.def.id === congPhapId);
    if (!e) return false;
    e.equippedSlot = null;
    return true;
  }
}
