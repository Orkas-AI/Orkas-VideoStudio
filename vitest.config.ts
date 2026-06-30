import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // Resolve workspace packages to their TS source so unit tests run without a
    // build step. Vitest maps the `.js` re-exports inside these entries to `.ts`.
    alias: {
      '@orkas/video-studio-core': src('./packages/core/src/index.ts'),
      '@orkas/video-studio-tools': src('./packages/tools/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
