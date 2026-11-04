import { afterEach, expect, test, vi } from 'vitest'

import { getCachedDomains, saveDomains } from './domainCache'
import { DOMAIN_REQUEST_TIMEOUT_MS, fetchProteinDomains } from './ncbiDomains'

vi.mock('./domainCache', () => ({
  getCachedDomains: vi.fn(() => Promise.resolve([])),
  saveDomains: vi.fn(() => Promise.resolve()),
}))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.mocked(saveDomains).mockClear()
})

const genpept = (accessions: string[]) =>
  accessions
    .map(
      acc =>
        `<GBSeq><GBSeq_accession-version>${acc}</GBSeq_accession-version></GBSeq>`,
    )
    .join('')

const accessions = Array.from({ length: 150 }, (_, i) => `NP_${i}`)

// 1000 rows is ten batches, and a throttle on the seventh used to discard the
// six already answered, uncached; the throttle itself only reached the console
test('a failed batch keeps and caches the batches before it, and says why', async () => {
  let call = 0
  vi.stubGlobal('fetch', () =>
    Promise.resolve(
      call++ === 0
        ? new Response(genpept(accessions.slice(0, 100)))
        : new Response('throttled', { status: 429 }),
    ),
  )
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { byAccession, failure } = await fetchProteinDomains(accessions)
  expect(byAccession.size).toBe(100)
  expect(String(failure)).toMatch(/429/)
  expect(vi.mocked(saveDomains).mock.calls[0]![0]).toHaveLength(100)
  expect(getCachedDomains).toHaveBeenCalled()
})

test('an abort ends the fetch rather than counting as a failed batch', async () => {
  const controller = new AbortController()
  vi.stubGlobal('fetch', () => {
    controller.abort()
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  })
  await expect(
    fetchProteinDomains(accessions, controller.signal),
  ).rejects.toThrow('Aborted')
  expect(saveDomains).not.toHaveBeenCalled()
})

// vitest's fake timers do not drive AbortSignal.timeout, so it is rebuilt
// on the faked setTimeout
function timeoutsOnFakeTimers() {
  vi.useFakeTimers()
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
    const controller = new AbortController()
    setTimeout(() => {
      controller.abort(new DOMException('signal timed out', 'TimeoutError'))
    }, ms)
    return controller.signal
  })
}

function stalledResponse(init?: RequestInit) {
  return new Promise<Response>((_, reject) => {
    const signal = init?.signal
    signal?.addEventListener('abort', () => {
      const { reason } = signal
      reject(reason instanceof Error ? reason : new Error('aborted'))
    })
  })
}

test('a batch NCBI never answers times out, keeping the batches before it', async () => {
  timeoutsOnFakeTimers()
  let call = 0
  vi.stubGlobal('fetch', (_url: string, init?: RequestInit) =>
    call++ === 0
      ? Promise.resolve(new Response(genpept(accessions.slice(0, 100))))
      : stalledResponse(init),
  )
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const pending = fetchProteinDomains(accessions)
  await vi.advanceTimersByTimeAsync(DOMAIN_REQUEST_TIMEOUT_MS + 1000)
  const { byAccession, failure } = await pending
  expect(AbortSignal.timeout).toHaveBeenCalledWith(30_000)
  expect(byAccession.size).toBe(100)
  expect(String(failure)).toMatch(/NCBI did not answer within 30 s/)
})

test('an abort during a stalled batch still ends the fetch as an abort', async () => {
  timeoutsOnFakeTimers()
  const controller = new AbortController()
  vi.stubGlobal('fetch', (_url: string, init?: RequestInit) =>
    stalledResponse(init),
  )
  const pending = fetchProteinDomains(accessions, controller.signal)
  await vi.advanceTimersByTimeAsync(1000)
  controller.abort(new DOMException('Aborted', 'AbortError'))
  await expect(pending).rejects.toThrow('Aborted')
  expect(saveDomains).not.toHaveBeenCalled()
})
