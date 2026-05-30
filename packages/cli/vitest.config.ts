import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    // CLI integration spawns processes / touches the fs — keep them serial-ish.
    fileParallelism: false,
  },
})
