import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { DomainError } from '../domain/errors';

// Admin cấp trực tiếp công pháp và/hoặc Linh Thạch cho một người chơi.
export class GrantUseCase {
  constructor(
    private readonly owned: OwnedCongPhapRepository,
    private readonly characters: CharacterRepository,
  ) {}

  async execute(input: { userId: string; congPhapId?: string; linhThach?: number }): Promise<void> {
    if (!input.congPhapId && !input.linhThach) {
      throw new DomainError('INVALID_GRANT', 'Phải cấp ít nhất công pháp hoặc Linh Thạch');
    }
    if (input.linhThach !== undefined && input.linhThach !== 0) {
      const character = await this.characters.findByUserId(input.userId);
      if (!character) throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
      await this.characters.addLinhThach(character.id, input.linhThach);
    }
    if (input.congPhapId) {
      // grant idempotent: đã sở hữu thì bỏ qua (admin không quan tâm dup ở đây).
      await this.owned.grant(input.userId, input.congPhapId);
    }
  }
}
