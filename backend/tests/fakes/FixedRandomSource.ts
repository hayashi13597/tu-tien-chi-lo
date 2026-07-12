import { RandomSource } from '../../src/domain/ports/RandomSource';

export class FixedRandomSource implements RandomSource {
  constructor(private readonly value: number) {}

  next(): number {
    return this.value;
  }
}
