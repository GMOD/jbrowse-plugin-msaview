import { afterEach, expect, test, vi } from 'vitest'

import { fetchTaxonomyInfo } from './taxonomyNames'

vi.mock('./idb', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createDbOpener: () => () =>
    Promise.reject(new DOMException('site data blocked', 'SecurityError')),
}))

const XML = `<TaxaSet>
<Taxon>
  <TaxId>10090</TaxId>
  <ScientificName>Mus musculus</ScientificName>
  <OtherNames><GenbankCommonName>house mouse</GenbankCommonName></OtherNames>
  <LineageEx></LineageEx>
</Taxon>
</TaxaSet>`

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// runs between the search and the alignment, so a throw here discarded a BLAST
// job that had already finished
test('a browser without IndexedDB still gets the names from NCBI', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('fetch', () =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(XML),
    }),
  )
  const info = await fetchTaxonomyInfo([10090])
  expect(info.get(10090)).toEqual({
    sciname: 'Mus musculus',
    commonName: 'house mouse',
  })
})
