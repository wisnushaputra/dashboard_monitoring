import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3002',
    headless: true,
  },
  webServer: [
    {
      command: 'cd ../../backend && npx tsx src/server.ts',
      port: 4000,
      reuseExistingServer: true,
    },
    {
      command: 'npx vite --port 3002',
      port: 3002,
      reuseExistingServer: true,
    },
  ],
})
