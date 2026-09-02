import { timeout } from './fetch'

/**
 * Poll a remote job until it reports done. `check` returns true when finished,
 * false when still pending, and throws on failure. Between checks it counts down
 * `intervalSeconds`, calling `onCountdown` each second so the UI can show
 * progress.
 *
 * `signal` ends the loop with an AbortError: the countdown rejects on the tick
 * it is aborted rather than at the end of the interval, so a cancelled launch
 * stops within a second instead of running for the job's lifetime.
 */
export async function pollLoop({
  check,
  intervalSeconds,
  onCountdown,
  signal,
}: {
  check: () => Promise<boolean>
  intervalSeconds: number
  onCountdown: (secondsRemaining: number) => void
  signal?: AbortSignal
}) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    signal?.throwIfAborted()
    if (await check()) {
      return
    }
    for (let i = intervalSeconds; i > 0; i--) {
      onCountdown(i)
      await timeout(1000, signal)
    }
  }
}
