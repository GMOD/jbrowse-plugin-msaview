import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 120000,
    hookTimeout: 60000,
    include: ['test/**/*.test.ts'],
  },
})
