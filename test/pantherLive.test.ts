import { describe, expect, test, vi } from 'vitest'

import { fetchPantherOrthologs } from '../src/utils/pantherOrthologs'

// Node has no IndexedDB, and the labels are not what this proves
vi.mock('../src/utils/taxonomyNames', () => ({
  fetchTaxonomyInfo: () => Promise.resolve(new Map()),
}))

// Against the live PANTHER + UniProt services: LIVE=1 pnpm vitest run
// test/pantherLive.test.ts. The two genes are the ones NCBI's ortholog sets
// cannot serve — a yeast gene gets three yeast rows there, a fly gene only
// insects — so a human row in each result is the whole point.
const live = process.env.LIVE ? describe : describe.skip

live('PANTHER, live', () => {
  test.each([
    ['CDC28', 559292],
    ['Antp', 7227],
  ])('%s in taxon %i aligns across kingdoms', async (symbol, taxId) => {
    const { query, rows } = await fetchPantherOrthologs({
      candidates: [symbol],
      taxId,
      exclude: taxId,
      onProgress: () => {},
    })
    console.log(
      symbol,
      'query',
      query?.accession,
      rows.length,
      'rows:',
      rows.map(r => `${r.label}:${r.protein}`).join(' '),
    )
    expect(query?.sequence.length).toBeGreaterThan(100)
    expect(rows.length).toBeGreaterThanOrEqual(5)
    expect(rows.map(r => r.taxId)).toContain(9606)
    expect(rows.every(r => r.sequence.length > 50)).toBe(true)
  })
})
