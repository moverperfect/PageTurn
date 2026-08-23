import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          // Fast schema/migration checks against a scratch SQLite database;
          // needs no build or running worker.
          name: 'migrations',
          include: ['tests/migrations/**/*.test.ts'],
        },
      },
      {
        test: {
          // Runs against a built worker; invoke via `pnpm run test:acceptance`.
          name: 'acceptance',
          include: ['tests/acceptance/**/*.test.ts'],
          // The suite shares one worker and one D1 database; run files
          // sequentially so fixture setup and cleanup stay deterministic.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
