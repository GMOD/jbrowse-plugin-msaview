import { timeout } from './fetch'

/**
 * Poll a remote job until it reports done. `check` returns true when finished,
 * false when still pending, and throws on failure. Between checks it counts down
 * `intervalSeconds`, calling `onCountdown` each second so the UI can show
 * progress.
 */
export async function pollLoop({
  check,
  intervalSeconds,
  onCountdown,
}: {
  check: () => Promise<boolean>
  intervalSeconds: number
  onCountdown: (secondsRemaining: number) => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    if (await check()) {
      return
    }
    for (let i = intervalSeconds; i > 0; i--) {
      onCountdown(i)
      await timeout(1000)
    }
  }
}
