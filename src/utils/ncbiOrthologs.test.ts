import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  dedupeLabels,
  fetchOrthologGenes,
  fetchRepresentativeProteins,
  parseFasta,
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
