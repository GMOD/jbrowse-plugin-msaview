// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'

import { useFetch } from './useFetch'

function recordingFetcher() {
  const signals: AbortSignal[] = []
  return {
    signals,
    fetcher: (signal: AbortSignal) => {
      signals.push(signal)
      return new Promise<string>(() => {})
    },
  }
}

test('unmounting aborts the lookup in flight', () => {
  const { signals, fetcher } = recordingFetcher()
  const { unmount } = renderHook(() => useFetch('taxon', fetcher))
  expect(signals.map(s => s.aborted)).toEqual([false])
  unmount()
  expect(signals.map(s => s.aborted)).toEqual([true])
})

test('a new key aborts the previous lookup and starts its own', () => {
  const { signals, fetcher } = recordingFetcher()
  const { rerender } = renderHook(({ key }) => useFetch(key, fetcher), {
    initialProps: { key: 'zebra' },
  })
  rerender({ key: 'zebrafish' })
  expect(signals.map(s => s.aborted)).toEqual([true, false])
})
