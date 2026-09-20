import { defineConfig } from '@playwright/test'

const PORT = 3100
const DIR = 'e2e/.recipes'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `RECIPES_DIR=${DIR} npx next dev --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
