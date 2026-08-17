import { afterEach, describe, expect, test, vi } from 'vitest'

import { resolveAssemblySpecies, resolveTaxId } from './ncbiTaxonomy'

const stubFetch = (handler: (url: string) => unknown) => {
  const seen: string[] = []
  vi.stubGlobal('fetch', (url: string) => {
    seen.push(url)
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(handler(url)),
    })
  })
  return seen
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveTaxId', () => {
  test('takes a bare number as the id and spends no request on it', async () => {
    const seen = stubFetch(() => ({}))
    expect(await resolveTaxId(' 9606 ')).toBe(9606)
    expect(seen).toEqual([])
  })

  test('searches db=taxonomy for anything else', async () => {
    const seen = stubFetch(() => ({ esearchresult: { idlist: ['7955'] } }))
    expect(await resolveTaxId('zebrafish')).toBe(7955)
    expect(seen[0]).toContain('db=taxonomy')
  })

  test('an unmatched name resolves to nothing', async () => {
    stubFetch(() => ({ esearchresult: { idlist: [] } }))
    expect(await resolveTaxId('not an organism')).toBeUndefined()
  })
})

// The dialog opened on `human` whoever was browsing, which on a mouse assembly
// resolves the gene symbol to the HUMAN gene and excludes the wrong taxon, so
// mouse lands twice. db=assembly is where the assembly names JBrowse configs
// carry are indexed.
describe('resolveAssemblySpecies', () => {
  const summaryFor = (speciestaxid: string, speciesname: string) => ({
    result: { uids: ['1'], '1': { speciestaxid, speciesname } },
  })

  test('resolves an assembly name to the species it is an assembly of', async () => {
    const seen = stubFetch(url =>
      url.includes('esearch')
        ? { esearchresult: { idlist: ['1'] } }
        : summaryFor('10090', 'Mus musculus'),
    )
    expect(await resolveAssemblySpecies('mm39')).toEqual({
      taxId: 10090,
      speciesName: 'Mus musculus',
    })
    expect(seen[0]).toContain('db=assembly')
    expect(seen[1]).toContain('esummary')
  })

  test('an assembly NCBI does not index resolves to nothing, without a summary call', async () => {
    const seen = stubFetch(() => ({ esearchresult: { idlist: [] } }))
    expect(await resolveAssemblySpecies('my_custom_asm')).toBeUndefined()
    expect(seen).toHaveLength(1)
  })

  test('a summary carrying no species resolves to nothing rather than taxon NaN', async () => {
    stubFetch(url =>
      url.includes('esearch')
        ? { esearchresult: { idlist: ['1'] } }
        : { result: { uids: ['1'], '1': {} } },
    )
    expect(await resolveAssemblySpecies('hg38')).toBeUndefined()
  })

  test('an empty name asks nothing', async () => {
    const seen = stubFetch(() => ({}))
    expect(await resolveAssemblySpecies('  ')).toBeUndefined()
    expect(seen).toEqual([])
  })
})
