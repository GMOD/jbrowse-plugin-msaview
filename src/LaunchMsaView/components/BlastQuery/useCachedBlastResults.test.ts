// @vitest-environment jsdom
import { SimpleFeature } from '@jbrowse/core/util'
import { renderHook, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { getAllCachedResults } from '../../../utils/blastCache'
import { useCachedBlastResults } from './useCachedBlastResults'

import type { CachedBlastResult } from '../../../utils/blastCache'

vi.mock('../../../utils/blastCache', () => ({
  getAllCachedResults: vi.fn(),
  deleteCachedResult: vi.fn(),
}))

function row(id: string, fields: Partial<CachedBlastResult>) {
  return {
    id,
    proteinSequence: 'MKV',
    blastDatabase: 'uniprotkb_swissprot',
    msa: '',
    tree: '',
    treeMetadata: '{}',
    rid: 'r',
    timestamp: 0,
    ...fields,
  } satisfies CachedBlastResult
}

vi.mocked(getAllCachedResults).mockResolvedValue([
  row('by-gene', { geneId: 'gene1' }),
  row('orphan-transcript', { transcriptId: 'tx1' }),
  row('isoform', { geneId: undefined, transcriptId: 'tx2' }),
  row('elsewhere', { geneId: 'gene9', transcriptId: 'tx9' }),
  row('other-gene-same-transcript-id', {
    geneId: 'gene9',
    transcriptId: 'tx1',
  }),
])

function cds(id: string) {
  return { uniqueId: id, refName: 'chr1', start: 0, end: 30, type: 'CDS' }
}

async function listed(feature: SimpleFeature) {
  const { result } = renderHook(() => useCachedBlastResults(feature))
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false)
  })
  return result.current.results.map(r => r.id)
}

test('a top-level transcript with no parent gene lists its own runs', async () => {
  const transcript = new SimpleFeature({
    uniqueId: 'tx1',
    refName: 'chr1',
    start: 0,
    end: 30,
    type: 'mRNA',
    subfeatures: [cds('tx1-cds')],
  })
  expect(await listed(transcript)).toEqual(['orphan-transcript'])
})

test('a gene lists runs by gene id and by any of its transcripts', async () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene1',
    refName: 'chr1',
    start: 0,
    end: 30,
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 'tx2',
        refName: 'chr1',
        start: 0,
        end: 30,
        type: 'mRNA',
        subfeatures: [cds('tx2-cds')],
      },
    ],
  })
  expect(await listed(gene)).toEqual(['by-gene', 'isoform'])
})
