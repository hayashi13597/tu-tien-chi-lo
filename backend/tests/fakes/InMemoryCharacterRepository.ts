import { CharacterRepository, CharacterUpdateInput } from '../../src/domain/ports/CharacterRepository';
import { CharacterRecord } from '../../src/domain/entities/Character';

export class InMemoryCharacterRepository implements CharacterRepository {
  private charactersById = new Map<string, CharacterRecord>();

  /** Test helper — not part of the port — to seed a character directly. */
  seed(character: CharacterRecord): void {
    this.charactersById.set(character.id, character);
  }

  async findByUserId(userId: string): Promise<CharacterRecord | null> {
    for (const character of this.charactersById.values()) {
      if (character.userId === userId) return character;
    }
    return null;
  }

  async updateWithConcurrencyGuard(
    id: string,
    expectedLastUpdateAt: Date,
    data: CharacterUpdateInput,
  ): Promise<CharacterRecord | null> {
    const existing = this.charactersById.get(id);
    if (!existing || existing.lastUpdateAt.getTime() !== expectedLastUpdateAt.getTime()) {
      return null;
    }
    const updated: CharacterRecord = { ...existing, ...data };
    this.charactersById.set(id, updated);
    return updated;
  }

  async spendLinhThach(characterId: string, amount: number): Promise<boolean> {
    const existing = this.charactersById.get(characterId);
    if (!existing || existing.linhThach < amount) return false;
    this.charactersById.set(characterId, { ...existing, linhThach: existing.linhThach - amount });
    return true;
  }

  async addLinhThach(characterId: string, amount: number): Promise<void> {
    const existing = this.charactersById.get(characterId);
    if (!existing) return;
    this.charactersById.set(characterId, { ...existing, linhThach: existing.linhThach + amount });
  }
}
