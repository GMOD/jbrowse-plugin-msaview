import { afterEach, expect, test, vi } from 'vitest'

import {
  UNIPROT_ACCESSION,
  fetchClusterMembers,
  parseEntry,
  resolveUniProtEntry,
} from './unirefHomologs'

const entry = (
  accession: string,
  taxonId: number,
  extra: Record<string, unknown> = {},
) => ({
  primaryAccession: accession,
  uniProtkbId: `${accession}_ID`,
  entryType: 'UniProtKB unreviewed (TrEMBL)',
  organism: { scientificName: `Species ${taxonId}`, taxonId },
  sequence: { value: 'MKWVTFISLL', length: 10 },
  ...extra,
})

test('the accession grammar admits UniProt accessions and not gene symbols', () => {
  for (const acc of ['P04637', 'Q9Y6K1', 'A0A2K6AAH4', 'P04637-2']) {
    expect(UNIPROT_ACCESSION.test(acc)).toBe(true)
  }
  for (const sym of ['TP53', 'NM_000546.6', 'BRCA2', 'gene:TP53']) {
    expect(UNIPROT_ACCESSION.test(sym)).toBe(false)
  }
})

test('parseEntry reads the reviewed flag off the entry type', () => {
  expect(
    parseEntry(
      entry('P04637', 9606, { entryType: 'UniProtKB reviewed (Swiss-Prot)' }),
    )?.reviewed,
  ).toBe(true)
  expect(parseEntry(entry('A0A2K6AAH4', 9568))?.reviewed).toBe(false)
  expect(parseEntry({ primaryAccession: 'X' })).toBeUndefined()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(pages: { body: unknown; next?: string; total?: number }[]) {
  const calls: string[] = []
  let i = 0
  vi.stubGlobal('fetch', (url: string) => {
    calls.push(url)
    const page = pages[i++]!
    const headers = new Headers()
    if (page.next) {
      headers.set('link', `<${page.next}>; rel="next"`)
    }
    if (page.total !== undefined) {
      headers.set('x-total-results', String(page.total))
    }
    return Promise.resolve(
      new Response(JSON.stringify(page.body), { status: 200, headers }),
    )
  })
  return calls
}

test('fetchClusterMembers keeps one entry per species, reviewed over unreviewed, then longest', async () => {
  stubFetch([
    {
      body: {
        results: [
          entry('A1', 10090),
          entry('A2', 10090, {
            entryType: 'UniProtKB reviewed (Swiss-Prot)',
            sequence: { value: 'MKW', length: 3 },
          }),
          entry('A3', 9913, {
            sequence: { value: 'MKWVTFISLLFLF', length: 13 },
          }),
          entry('A4', 9913),
          entry('Q1', 9606),
        ],
      },
      total: 5,
    },
  ])
  const { rows, total } = await fetchClusterMembers({
    clusterId: 'UniRef50_P04637',
    identity: 50,
    exclude: 9606,
  })
  expect(total).toBe(5)
  expect(rows.map(r => r.accession)).toEqual(['A2', 'A3'])
})

test('fetchClusterMembers follows the Link header and asks for reference proteomes', async () => {
  const calls = stubFetch([
    { body: { results: [entry('A1', 1)] }, next: 'https://next.page' },
    { body: { results: [entry('A2', 2)] } },
  ])
  const { rows } = await fetchClusterMembers({
    clusterId: 'UniRef90_X',
    identity: 90,
  })
  expect(rows).toHaveLength(2)
  expect(calls).toHaveLength(2)
  expect(decodeURIComponent(calls[0]!)).toContain(
    'uniref_cluster_90:UniRef90_X AND keyword:KW-1185',
  )
  expect(calls[1]).toBe('https://next.page')
})

const reviewed = { entryType: 'UniProtKB reviewed (Swiss-Prot)' }

test('fetchClusterMembers stops paging once every requested species has its reviewed entry', async () => {
  const calls = stubFetch([
    {
      body: { results: [entry('A1', 1, reviewed), entry('A2', 2, reviewed)] },
      next: 'https://next.page',
    },
    { body: { results: [entry('A3', 3)] } },
  ])
  const { rows } = await fetchClusterMembers({
    clusterId: 'UniRef50_X',
    identity: 50,
    taxa: new Set([1, 2]),
  })
  expect(rows.map(r => r.taxId)).toEqual([1, 2])
  expect(calls).toHaveLength(1)
})

// stopping at the first entry seen per species returned a fragment whose
// Swiss-Prot entry was on the next page
test('fetchClusterMembers reads on for a species seen only unreviewed', async () => {
  stubFetch([
    { body: { results: [entry('A1', 1)] }, next: 'https://next.page' },
    { body: { results: [entry('A2', 1, reviewed)] } },
  ])
  const { rows, truncated } = await fetchClusterMembers({
    clusterId: 'UniRef50_X',
    identity: 50,
    taxa: new Set([1]),
  })
  expect(rows.map(r => r.accession)).toEqual(['A2'])
  expect(truncated).toBe(false)
})

test('fetchClusterMembers says when the cluster was too large to read whole', async () => {
  const page = (n: number) => ({
    body: {
      results: Array.from({ length: 500 }, (_, i) =>
        entry(`A${n}_${i}`, n + 1),
      ),
    },
    next: 'https://next.page',
    total: 12_000,
  })
  stubFetch(Array.from({ length: 11 }, (_, n) => page(n)))
  const { scanned, truncated } = await fetchClusterMembers({
    clusterId: 'UniRef50_X',
    identity: 50,
  })
  expect(scanned).toBe(5000)
  expect(truncated).toBe(true)
})

test('resolveUniProtEntry fetches an accession directly and searches a symbol', async () => {
  const calls = stubFetch([
    { body: entry('P04637', 9606) },
    {
      body: {
        results: [
          entry('Q1', 9606),
          entry('Q2', 9606, { entryType: 'UniProtKB reviewed (Swiss-Prot)' }),
        ],
      },
    },
  ])
  expect((await resolveUniProtEntry(['P04637'], 9606))?.accession).toBe(
    'P04637',
  )
  expect(calls[0]).toContain('/uniprotkb/P04637?')
  expect((await resolveUniProtEntry(['gene:TP53'], 9606))?.accession).toBe('Q2')
  expect(decodeURIComponent(calls[1]!)).toContain(
    'gene_exact:"TP53" AND organism_id:9606',
  )
})

// the isoform is the query: dropping the suffix launched the canonical
// sequence in its place, 393 residues for P04637-2's 341
test('resolveUniProtEntry keeps an isoform suffix', async () => {
  const calls = stubFetch([{ body: entry('P04637-2', 9606) }])
  expect((await resolveUniProtEntry(['P04637-2'], 9606))?.accession).toBe(
    'P04637-2',
  )
  expect(calls[0]).toContain('/uniprotkb/P04637-2?')
})

// P2RY12 fits the accession grammar, and UniProt answers the entry url for it
// with a 400, which used to fail the launch before the gene search was tried
test('a gene symbol shaped like an accession still resolves by gene search', async () => {
  const calls: string[] = []
  vi.stubGlobal('fetch', (url: string) => {
    calls.push(url)
    return Promise.resolve(
      url.includes('/uniprotkb/search')
        ? new Response(JSON.stringify({ results: [entry('Q9H244', 9606)] }))
        : new Response('bad accession', { status: 400 }),
    )
  })
  expect(UNIPROT_ACCESSION.test('P2RY12')).toBe(true)
  const found = await resolveUniProtEntry(['P2RY12'], 9606)
  expect(found?.accession).toBe('Q9H244')
  expect(calls).toHaveLength(2)
})
