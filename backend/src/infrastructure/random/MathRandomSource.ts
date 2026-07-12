import { RandomSource } from '../../domain/ports/RandomSource';

export class MathRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}
