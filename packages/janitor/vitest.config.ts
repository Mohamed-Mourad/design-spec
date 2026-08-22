import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Integration tests shell out to git in throwaway repos — keep them serial.
    fileParallelism: false,
  },
})
