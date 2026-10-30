import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { assertLocalSupabase } from '../shared/src/localSupabase';

// Integration tests run against local Supabase; values come from the repo-root .env files.
const root = resolve(__dirname, '../..');
config({ path: [resolve(root, '.env.local'), resolve(root, '.env')], quiet: true });
// The seed tests wipe and re-insert content: never let them near a cloud project.
assertLocalSupabase('@prepio/content integration tests', [process.env.SUPABASE_URL]);

export default defineConfig({
  test: { include: ['src/**/*.int.test.ts'], testTimeout: 60_000, hookTimeout: 60_000, fileParallelism: false },
});
