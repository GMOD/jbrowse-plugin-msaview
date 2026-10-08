import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  cleanGeneCandidate,
  dedupeLabels,
  fetchOrthologGenes,
  fetchRepresentativeProteins,
  parseFasta,
  pickBySymbol,
  resolveGeneId,
} from './ncbiOrthologs'

describe('dedupeLabels', () => {
  test('sanitizes to single tokens', () => {
    // labels are used identically as FASTA headers, Newick leaf names and GFF
    // seq_ids, so anything that would need quoting in one of those is stripped
    expect(dedupeLabels(['house mouse', 'Norway rat'])).toEqual([
      'house_mouse',
      'Norway_rat',
    ])
    expect(dedupeLabels(['Frog (X. tropicalis)'])).toEqual([
      'Frog_X_tropicalis',
    ])
  })

  test('suffixes collisions rather than overwriting a row', () => {
    expect(dedupeLabels(['a b', 'a-b', 'a_b'])).toEqual([
      'a_b',
      'a_b_2',
      'a_b_3',
    ])
  })

  test('falls back for a name with no usable characters', () => {
    expect(dedupeLabels(['...', '...'])).toEqual(['row', 'row_2'])
  })

  test('climbs past a suffix a literal name already took', () => {
    // a label pairs a tree leaf to its alignment row, so handing the same one
    // to two rows merges two species into one silently. The third label is ugly
    // and unique, which is the trade
    expect(dedupeLabels(['human', 'human', 'human_2'])).toEqual([
      'human',
      'human_2',
      'human_2_2',
    ])
    expect(dedupeLabels(['human_2', 'human', 'human'])).toEqual([
      'human_2',
      'human',
      'human_3',
    ])
  })
})

describe('cleanGeneCandidate', () => {
  test('strips what a GFF feature carries that a gene lookup does not want', () => {
    expect(cleanGeneCandidate(' gene:TP53 ')).toBe('TP53')
    expect(cleanGeneCandidate('NM_000546.6')).toBe('NM_000546')
    expect(cleanGeneCandidate('TP53')).toBe('TP53')
  })
})

describe('parseFasta', () => {
  test('keys by the first header token and joins wrapped lines', () => {
    const map = parseFasta(
      ['>NP_000537.3 cellular tumor antigen p53', 'MEEP', 'QSDP', ''].join(
        '\n',
      ),
    )
    expect(map.get('NP_000537.3')).toBe('MEEPQSDP')
  })

  test('reads every record of a multi-FASTA', () => {
    const map = parseFasta(
      ['>A one', 'MMM', '>B two', 'KKK', '>C three', 'LLL'].join('\n'),
    )
    expect([...map.keys()]).toEqual(['A', 'B', 'C'])
    expect(map.get('C')).toBe('LLL')
  })

  test('returns nothing for a response that carried no records', () => {
    // efetch answers an unknown accession with an error body, not a 4xx, so a
    // caller that assumed "text back = sequences" would build empty rows
    expect(parseFasta('Error: CEFetchPApplication::proxy_stream()').size).toBe(
      0,
    )
  })
})

// The two ceilings that make a widened species set silently return fewer rows.
// Both are shaped like a successful response, so only a test that counts what
// came back sees them.
describe('the NCBI request ceilings', () => {
  const stubFetch = (handler: (url: string) => unknown) => {
    const seen: string[] = []
    vi.stubGlobal('fetch', (url: string) => {
      seen.push(url)
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(handler(url)),
        text: () => Promise.resolve(JSON.stringify(handler(url))),
      })
    })
    return seen
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const orthologReport = (n: number) => ({
    total_count: n,
    reports: Array.from({ length: n }, (_, i) => ({
      gene: {
        gene_id: String(1000 + i),
        tax_id: String(2000 + i),
        taxname: `Species ${i}`,
      },
    })),
  })

  test('fetchOrthologGenes takes a prefix of NCBI report order, not a filtered intersection', async () => {
    stubFetch(() => orthologReport(165))
    const genes = await fetchOrthologGenes('22861', { limit: 10 })
    expect(genes.length).toBe(10)
    // the report's own order, which leads with the reference organisms
    expect(genes.map(g => g.geneId)).toEqual(
      Array.from({ length: 10 }, (_, i) => String(1000 + i)),
    )
  })

  test('fetchOrthologGenes drops the query taxon without spending a row on it', async () => {
    stubFetch(() => orthologReport(165))
    const genes = await fetchOrthologGenes('22861', { exclude: 2000, limit: 3 })
    expect(genes.map(g => g.taxId)).toEqual([2001, 2002, 2003])
  })

  test('fetchRepresentativeProteins chunks the gene ids below the URI length NCBI 414s at', async () => {
    // 865 CFTR ortholog gene ids join to 8609 characters, which NCBI answers
    // with HTTP 414 rather than a short result
    const ids = Array.from({ length: 400 }, (_, i) => String(100000 + i))
    const seen = stubFetch(url => ({
      reports: (/id\/([^/]+)\//.exec(url)?.[1] ?? '').split(',').map(id => ({
        product: {
          gene_id: id,
          transcripts: [{ protein: { accession_version: `NP_${id}.1` } }],
        },
      })),
    }))
    const byGene = await fetchRepresentativeProteins(ids)
    expect(byGene.size).toBe(400)
    expect(seen.length).toBeGreaterThan(1)
    expect(Math.max(...seen.map(u => u.length))).toBeLessThan(8000)
  })

  test('fetchRepresentativeProteins asks for a page big enough to hold its chunk', async () => {
    // the endpoint paginates at 20 by default and hides the rest behind
    // next_page_token, so a caller reading only `reports` loses everything past
    // the first page and reports no protein for those genes
    const ids = Array.from({ length: 50 }, (_, i) => String(100000 + i))
    const seen = stubFetch(url => ({
      reports: (/id\/([^/]+)\//.exec(url)?.[1] ?? '')
        .split(',')
        .slice(0, Number(/page_size=(\d+)/.exec(url)?.[1] ?? 20))
        .map(id => ({
          product: {
            gene_id: id,
            transcripts: [{ protein: { accession_version: `NP_${id}.1` } }],
          },
        })),
    }))
    const byGene = await fetchRepresentativeProteins(ids)
    expect(byGene.size).toBe(50)
    expect(seen.every(u => /page_size=\d+/.test(u))).toBe(true)
  })
})

// eutils allows three requests a second, so asking the same symbol twice is a
// request spent on nothing
// answers Datasets' symbol lookup with `reports` and esearch with `idlist`
function stubGeneLookups({
  reports = () => [],
  idlist = () => [],
}: {
  reports?: (symbol: string) => unknown[]
  idlist?: (term: string) => string[]
}) {
  const seen: string[] = []
  vi.stubGlobal('fetch', (url: string) => {
    seen.push(url)
    const symbol = /gene\/symbol\/([^/]+)\/taxon/.exec(url)?.[1]
    const body = symbol
      ? { reports: reports(decodeURIComponent(symbol)) }
      : {
          esearchresult: {
            idlist: idlist(new URL(url).searchParams.get('term') ?? ''),
          },
        }
    return Promise.resolve(new Response(JSON.stringify(body)))
  })
  return seen
}

test('resolveGeneId asks about each cleaned symbol once', async () => {
  const seen = stubGeneLookups({})
  expect(
    await resolveGeneId(['gene:TP53', 'TP53', ' TP53 ', 'NM_000546.6'], 9606),
  ).toBeUndefined()
  expect(seen.filter(url => url.includes('esearch'))).toHaveLength(2)
  expect(seen.filter(url => url.includes('gene/symbol'))).toHaveLength(2)
  vi.unstubAllGlobals()
})

// NCBI lists TTR, whose alias TTN is, ahead of titin
test('resolveGeneId prefers the gene whose own symbol was asked for', async () => {
  stubGeneLookups({
    reports: () => [
      { gene: { gene_id: '7276', symbol: 'TTR', synonyms: ['TTN'] } },
      { gene: { gene_id: '7273', symbol: 'TTN' } },
    ],
  })
  expect(await resolveGeneId(['TTN'], 9606)).toEqual({
    geneId: '7273',
    matched: 'TTN',
  })
  vi.unstubAllGlobals()
})

test('pickBySymbol lets case decide before a case-blind match, and keeps an alias working', () => {
  const fly = [
    { gene_id: '42313', symbol: 'Delta', synonyms: ['Dl'] },
    { gene_id: '35047', symbol: 'dl' },
  ]
  expect(pickBySymbol('Dl', fly)).toBe('42313')
  expect(pickBySymbol('dl', fly)).toBe('35047')
  expect(pickBySymbol('p53', [{ gene_id: '7157', symbol: 'TP53' }])).toBe(
    '7157',
  )
  expect(pickBySymbol('nonesuch', [])).toBeUndefined()
})

// a GFF's `ID=12345` is not an NCBI GeneID, and taking it as one aligned some
// other organism's orthologs under the user's transcript
test('resolveGeneId takes a bare number only when no name resolves', async () => {
  stubGeneLookups({
    idlist: term => (term.startsWith('TP53[') ? ['7157'] : []),
  })
  expect(await resolveGeneId(['12345', 'TP53'], 9606)).toEqual({
    geneId: '7157',
    matched: 'TP53',
  })
  expect(await resolveGeneId(['12345', 'nonesuch'], 9606)).toEqual({
    geneId: '12345',
    matched: '12345',
  })
  vi.unstubAllGlobals()
})

test('an abort stops a chunked lookup at the request in flight', async () => {
  const controller = new AbortController()
  const seen: string[] = []
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    seen.push(url)
    controller.abort()
    return Promise.reject(init?.signal?.reason)
  })
  const ids = Array.from({ length: 400 }, (_, i) => String(100000 + i))
  await expect(
    fetchRepresentativeProteins(ids, controller.signal),
  ).rejects.toThrow(expect.objectContaining({ name: 'AbortError' }))
  expect(seen).toHaveLength(1)
  vi.unstubAllGlobals()
})
