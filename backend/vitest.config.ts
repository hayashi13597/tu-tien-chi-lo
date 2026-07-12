import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Integration tests share one dev Postgres DB and clean up via deleteMany()
    // in beforeEach; running test files in parallel causes cross-file races.
    fileParallelism: false,
  },
});
