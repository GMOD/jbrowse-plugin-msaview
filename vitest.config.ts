import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Three e2e suites each start `serve` on the same fixed port and drive their
    // own Chrome, so running the files in parallel makes them fight over 9876 --
    // the loser gets a random port and fails with "Server started on wrong
    // port". Serializing costs a little wall clock on the unit tests and removes
    // the race entirely.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 60_000,
    // .tsx for the component tests, which declare `@vitest-environment jsdom`
    // per file -- the rest run in node, where the puppeteer suites want to be
    include: ['test/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
  },
})
