import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Integration tests run against local Supabase (needs `pnpm db:start`).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.int.test.ts'], testTimeout: 60_000, hookTimeout: 60_000, fileParallelism: false },
});
