import { RandomSource } from '../ports/RandomSource';

// Small dependency-free PRNG. The seed is persisted with an expedition so a
// reward/combat resolution never changes when the player claims it later.
export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (Math.imul(1_664_525, this.state) + 1_013_904_223) >>> 0;
    return this.state / 4_294_967_296;
  }
}
