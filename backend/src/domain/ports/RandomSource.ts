export interface RandomSource {
  /** Returns a float in [0, 1), same contract as Math.random(). Injected so
   * breakthrough rolls are deterministic and testable. */
  next(): number;
}
