import { expect, test, vi } from 'vitest'

import { fetchTaxonomyInfo } from './taxonomyNames'

const { saved } = vi.hoisted(() => ({ saved: [] as number[] }))

vi.mock('./idb', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createDbOpener: () => () =>
    Promise.resolve({
      transaction: () => ({
        store: {
          get: () => Promise.resolve(undefined),
          put: (entry: { taxid: number }) => {
            saved.push(entry.taxid)
            return Promise.resolve()
          },
        },
        done: Promise.resolve(),
      }),
    }),
}))

test('an abort between batches still caches the names already fetched', async () => {
  const controller = new AbortController()
  vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
    if (saved.length === 0 && !controller.signal.aborted) {
      controller.abort()
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            '<Taxon><TaxId>1</TaxId><ScientificName>First</ScientificName><LineageEx></LineageEx></Taxon>',
          ),
      })
    }
    return Promise.reject(init?.signal?.reason)
  })
  const taxids = Array.from({ length: 150 }, (_, i) => i + 1)
  await expect(fetchTaxonomyInfo(taxids, controller.signal)).rejects.toThrow(
    expect.objectContaining({ name: 'AbortError' }),
  )
  expect(saved).toEqual([1])
  vi.unstubAllGlobals()
})
