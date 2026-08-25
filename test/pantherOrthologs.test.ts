import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  fetchPantherOrthologs,
  parseGenomes,
  parseMatches,
  parseSequences,
  pickOnePerGenome,
} from '../src/utils/pantherOrthologs'

vi.mock('../src/utils/taxonomyNames', () => ({
  fetchTaxonomyInfo: vi.fn(() =>
    Promise.resolve(
      new Map([
        [9606, { sciname: 'Homo sapiens', commonName: 'human' }],
        [10090, { sciname: 'Mus musculus', commonName: 'house mouse' }],
        [6239, { sciname: 'Caenorhabditis elegans' }],
      ]),
    ),
  ),
}))

// Captured from the live services on 2026-08-25 (react-msaview's
// agent-docs/ideas/ortholog-sources-beyond-ncbi.md names the urls), trimmed to
// the rows the assertions read: yeast CDC28 against seven genomes.
const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/panther',
)
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtures, `${name}.json`), 'utf8'))
}

const cdc28 = fixture('panther-cdc28')

describe('parseMatches', () => {
  test('reads the query gene and one hit per target row', () => {
    const { unmapped, query, hits } = parseMatches(cdc28)
    expect(unmapped).toBe(false)
    expect(query).toEqual({
      code: 'YEAST',
      accession: 'P00546',
      geneRef: 'SGD=S000000364',
    })
    expect(hits).toHaveLength(7)
    expect(hits[0]).toEqual({
      code: 'HUMAN',
      accession: 'P11802',
      geneRef: 'HGNC=1773',
      symbol: 'CDK4',
      type: 'O',
    })
  })

  test('an unknown gene is unmapped, not empty', () => {
    const { unmapped, hits } = parseMatches(fixture('panther-unmapped'))
    expect(unmapped).toBe(true)
    expect(hits).toEqual([])
  })

  // PANTHER answers a known gene with no ortholog in the targets as a single
  // bare `{ id }` object rather than an array, so the shape has to be read
  // both ways
  test('a gene with no ortholog in the targets is known but has no hits', () => {
    const { unmapped, query, hits } = parseMatches(fixture('panther-empty'))
    expect(unmapped).toBe(false)
    expect(query).toBeUndefined()
    expect(hits).toEqual([])
  })
})

describe('pickOnePerGenome', () => {
  test('prefers the LDO and keeps first-seen order', () => {
    const picks = pickOnePerGenome(parseMatches(cdc28).hits)
    expect(picks.map(p => [p.code, p.accession, p.type])).toEqual([
      ['HUMAN', 'P24941', 'LDO'],
      ['CAEEL', 'O61847', 'LDO'],
      ['DROME', 'Q7K306', 'O'],
      ['MOUSE', 'P97377', 'LDO'],
      ['ARATH', 'Q8LG64', 'O'],
    ])
  })
})

describe('parseGenomes', () => {
  test('maps PANTHER codes to taxa', () => {
    const genomes = parseGenomes(fixture('panther-genomes'))
    expect(genomes.map(g => g.code)).toEqual([
      'HUMAN',
      'MOUSE',
      'DANRE',
      'DROME',
      'CAEEL',
      'YEAST',
      'ARATH',
    ])
    expect(genomes.find(g => g.code === 'DROME')).toEqual({
      code: 'DROME',
      taxId: 7227,
      name: 'fruit_fly',
      longName: 'Drosophila melanogaster',
    })
  })
})

describe('parseSequences', () => {
  test('keys sequences by primary accession', () => {
    const seqs = parseSequences(fixture('uniprot-accessions'))
    expect([...seqs.keys()]).toEqual([
      'P00546',
      'P24941',
      'P97377',
      'O61847',
      'Q7K306',
      'Q8LG64',
    ])
    expect(seqs.get('P00546')).toHaveLength(24)
  })
})

describe('fetchPantherOrthologs', () => {
  const seen: string[] = []
  afterEach(() => {
    seen.length = 0
    vi.unstubAllGlobals()
  })

  function stubFetch(match: unknown = cdc28) {
    vi.stubGlobal('fetch', (url: string) => {
      seen.push(url)
      const body = url.includes('supportedgenomes')
        ? fixture('panther-genomes')
        : url.includes('matchortho')
          ? match
          : fixture('uniprot-accessions')
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
      })
    })
  }

  test('rows carry the NCBI-shaped fields, labelled by NCBI taxonomy names', async () => {
    stubFetch()
    const { matched, query, rows } = await fetchPantherOrthologs({
      candidates: ['gene:CDC28.1'],
      taxId: 559292,
      exclude: 559292,
      onProgress: () => {},
    })
    expect(matched).toBe('CDC28')
    expect(query).toEqual({
      code: 'YEAST',
      accession: 'P00546',
      geneRef: 'SGD=S000000364',
      sequence: expect.stringMatching(/^[A-Z]{24}$/) as string,
    })
    expect(rows.map(r => [r.label, r.taxId, r.protein, r.geneId])).toEqual([
      ['human', 9606, 'P24941', 'HGNC=1771'],
      ['Caenorhabditis_elegans', 6239, 'O61847', 'WormBase=WBGene00019362'],
      ['fruit_fly', 7227, 'Q7K306', 'FlyBase=FBgn0016131'],
      ['house_mouse', 10090, 'P97377', 'MGI=MGI=104772'],
      ['arabidopsis', 3702, 'Q8LG64', 'TAIR=locus=2037410'],
    ])
    expect(rows.every(r => r.sequence.length === 24)).toBe(true)
  })

  test('the candidate is cleaned of its GFF prefix and version before it is sent', async () => {
    stubFetch()
    await fetchPantherOrthologs({
      candidates: ['gene:CDC28.1'],
      taxId: 559292,
      onProgress: () => {},
    })
    const url = new URL(seen.find(u => u.includes('matchortho'))!)
    expect(url.searchParams.get('geneInputList')).toBe('CDC28')
    expect(url.searchParams.get('organism')).toBe('559292')
    // no target list: every genome PANTHER has, in one call
    expect(url.searchParams.get('targetOrganism')).toBeNull()
  })

  test('taxa narrows the targets to genomes PANTHER has and orders the rows by it', async () => {
    stubFetch()
    const { rows } = await fetchPantherOrthologs({
      candidates: ['CDC28'],
      taxId: 559292,
      taxa: new Set([3702, 559292, 9606, 99999]),
      exclude: 559292,
      onProgress: () => {},
    })
    const url = new URL(seen.find(u => u.includes('matchortho'))!)
    expect(url.searchParams.get('targetOrganism')).toBe('3702,9606')
    expect(rows.map(r => r.taxId)).toEqual([3702, 9606])
  })

  test('limit caps the rows before their sequences are fetched', async () => {
    stubFetch()
    const { rows } = await fetchPantherOrthologs({
      candidates: ['CDC28'],
      taxId: 559292,
      limit: 2,
      onProgress: () => {},
    })
    expect(rows).toHaveLength(2)
    const uniprot = new URL(seen.find(u => u.includes('uniprot'))!)
    expect(uniprot.searchParams.get('accessions')).toBe('P00546,P24941,O61847')
  })

  test('a taxon PANTHER has no proteome for names the other source', async () => {
    stubFetch()
    await expect(
      fetchPantherOrthologs({
        candidates: ['Trp53'],
        taxId: 10116,
        onProgress: () => {},
      }),
    ).rejects.toThrow(/no reference proteome for taxon 10116/)
  })

  test('an unmapped gene throws rather than aligning nothing', async () => {
    stubFetch(fixture('panther-unmapped'))
    await expect(
      fetchPantherOrthologs({
        candidates: ['NOTAGENEXYZ'],
        taxId: 9606,
        onProgress: () => {},
      }),
    ).rejects.toThrow(/no entry for NOTAGENEXYZ in Homo sapiens/)
  })

  test('a known gene with too few orthologs says so', async () => {
    stubFetch(fixture('panther-empty'))
    await expect(
      fetchPantherOrthologs({
        candidates: ['Antp'],
        taxId: 7227,
        onProgress: () => {},
      }),
    ).rejects.toThrow(/Only 0 PANTHER ortholog/)
  })
})
