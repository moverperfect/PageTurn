import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/acceptance/**/*.test.ts'],
    // The suite shares one worker and one D1 database; run files sequentially
    // so fixture setup and cleanup stay deterministic.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
