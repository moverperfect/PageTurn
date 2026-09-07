import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Acceptance files share one worker and one D1 database. These options are
    // root-only in Vitest; setting them on a project is ignored and files run
    // in parallel, which deadlocks local D1 for SQLite's 30s busy timeout.
    fileParallelism: false,
    maxWorkers: 1,
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
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
