import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Integration tests run against local Supabase; values come from the repo-root .env files.
const root = resolve(__dirname, '../..');
config({ path: [resolve(root, '.env.local'), resolve(root, '.env')], quiet: true });

export default defineConfig({
  test: { include: ['src/**/*.int.test.ts'], testTimeout: 60_000, hookTimeout: 60_000, fileParallelism: false },
});
