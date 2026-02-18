import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: [
        'packages/shared/src/**',
        'packages/server/src/middleware/**',
        'packages/server/src/services/**',
      ],
      exclude: [
        'packages/server/src/db/migrations/**',
        'packages/server/src/db/seed/**',
      ],
    },
  },
});
