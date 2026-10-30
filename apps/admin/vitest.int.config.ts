import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { assertLocalSupabase } from '../../packages/shared/src/localSupabase';

// Integration tests run against local Supabase (needs `pnpm db:start`); same env files the test files load.
config({
  path: [fileURLToPath(new URL('./.env.local', import.meta.url)), fileURLToPath(new URL('../../.env', import.meta.url))],
  quiet: true,
});
// They create and delete rows: refuse to run against anything but a local Supabase.
assertLocalSupabase('@prepio/admin integration tests', [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL]);

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.int.test.ts'], testTimeout: 60_000, hookTimeout: 60_000, fileParallelism: false },
});
