import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { assertLocalSupabase } from '../../packages/shared/src/localSupabase';

// Needs local Supabase running (`pnpm db:start`) and the seeded admin user. Reuses dev servers on :3000 (admin)
// and :8081 (student web) if present.
config({ path: [resolve(__dirname, '.env.local'), resolve(__dirname, '../../.env')], quiet: true });
// The specs create and delete rows: refuse to run against anything but a local Supabase.
assertLocalSupabase(
  '@prepio/admin e2e',
  [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL],
  { required: true },
);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://localhost:3000/login',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // Student web, embedded by the card editor's live preview (card-types.spec).
      command: 'pnpm --filter @prepio/mobile web',
      cwd: resolve(__dirname, '../..'),
      url: 'http://localhost:8081',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
