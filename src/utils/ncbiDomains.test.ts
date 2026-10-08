import { afterEach, expect, test, vi } from 'vitest'

import { getCachedDomains, saveDomains } from './domainCache'
import { fetchProteinDomains } from './ncbiDomains'

vi.mock('./domainCache', () => ({
  getCachedDomains: vi.fn(() => Promise.resolve([])),
  saveDomains: vi.fn(() => Promise.resolve()),
}))

afterEach(() => {
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
// six already answered, uncached
test('a failed batch keeps and caches the batches before it', async () => {
  let call = 0
  vi.stubGlobal('fetch', () =>
    Promise.resolve(
      call++ === 0
        ? new Response(genpept(accessions.slice(0, 100)))
        : new Response('throttled', { status: 429 }),
    ),
  )
  const found = await fetchProteinDomains(accessions)
  expect(found.size).toBe(100)
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
