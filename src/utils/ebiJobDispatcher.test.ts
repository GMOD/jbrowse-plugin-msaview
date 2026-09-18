import { afterEach, describe, expect, test, vi } from 'vitest'

import { STATUS_FAILURE_BUDGET_MS, waitForEbiJob } from './ebiJobDispatcher'

// A long alignment is polled every ten seconds for minutes, so the chance of one
// failed status check somewhere in that window is not small -- and the job is
// running at EBI regardless of what happens to the poller's connection.
describe('waitForEbiJob', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // each status check lands `minutesPerCheck` after the last, so a long outage
  // is minutes of clock rather than minutes of test
  const statuses = (seq: (string | Error)[], minutesPerCheck = 0) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let i = 0
    vi.stubGlobal('fetch', () => {
      vi.setSystemTime(Date.now() + minutesPerCheck * 60_000)
      const next = seq[Math.min(i++, seq.length - 1)]!
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(next),
          })
    })
  }
  const wait = () =>
    waitForEbiJob({
      tool: 'clustalo',
      jobId: 'job1',
      intervalSeconds: 0,
      onCountdown: () => {},
    })

  test('a transient failure mid-poll does not abandon a job that then finishes', async () => {
    statuses(['RUNNING', new TypeError('Failed to fetch'), 'FINISHED'])
    await expect(wait()).resolves.toBeUndefined()
  })

  test('failures that do not persist never accumulate to the limit', async () => {
    const blip = new TypeError('Failed to fetch')
    statuses([
      blip,
      'RUNNING',
      blip,
      'RUNNING',
      blip,
      'RUNNING',
      blip,
      'FINISHED',
    ])
    await expect(wait()).resolves.toBeUndefined()
  })

  test('ten minutes of failed checks do not abandon a job that then finishes', async () => {
    const outage = Array.from({ length: 10 }, () => new Error('HTTP 502'))
    statuses(['RUNNING', ...outage, 'FINISHED'], 1)
    await expect(wait()).resolves.toBeUndefined()
  })

  test('an endpoint that has genuinely gone away is not polled forever', async () => {
    statuses([new TypeError('Failed to fetch')], 1)
    const start = Date.now()
    await expect(wait()).rejects.toThrow(/Could not reach EBI/)
    expect(Date.now() - start).toBeGreaterThanOrEqual(STATUS_FAILURE_BUDGET_MS)
  })

  test('a job EBI reports as failed still ends the poll immediately', async () => {
    statuses(['ERROR'])
    await expect(wait()).rejects.toThrow(/returned status ERROR/)
  })
})
