import { beforeEach, expect, test, vi } from 'vitest'

import { saveBlastResult } from '../utils/blastCache'
import { searchBackends } from '../utils/homologSearch'
import { launchMSA } from '../utils/msa'
import { fetchTaxonomyInfo } from '../utils/taxonomyNames'
import { resolveUniProtEntry } from '../utils/unirefHomologs'
import { doLaunchBlast } from './doLaunchBlast'

import type { JBrowsePluginMsaViewModel } from './model'

// Every network call is mocked: what is under test is how the launch turns a
// request into a search and the search's answer into rows -- which backend it
// asks, where the query comes from, and whether an aligner runs.
vi.mock('../utils/homologSearch', () => ({
  searchBackends: { blastp: vi.fn(), phmmer: vi.fn() },
}))
vi.mock('../utils/msa', () => ({ launchMSA: vi.fn() }))
vi.mock('../utils/taxonomyNames', () => ({ fetchTaxonomyInfo: vi.fn() }))
vi.mock('../utils/blastCache', () => ({ saveBlastResult: vi.fn() }))
vi.mock('../utils/unirefHomologs', () => ({ resolveUniProtEntry: vi.fn() }))

const blastp = vi.mocked(searchBackends.blastp)
const phmmer = vi.mocked(searchBackends.phmmer)
const mockLaunchMSA = vi.mocked(launchMSA)
const setQuerySeqName = vi.fn()

const HIT = { accession: 'P1', id: 'P1_MOUSE', sciname: 'Mus musculus' }

function makeModel(blastParams: Record<string, unknown>) {
  return {
    blastParams,
    querySeqName: 'QUERY',
    setQuerySeqName,
  } as unknown as JBrowsePluginMsaViewModel
}

function launch(self: JBrowsePluginMsaViewModel) {
  return doLaunchBlast({
    self,
    scope: {
      signal: new AbortController().signal,
      act: fn => {
        fn()
      },
      onProgress: () => {},
      onRid: () => {},
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchTaxonomyInfo).mockResolvedValue(new Map())
  vi.mocked(saveBlastResult).mockResolvedValue(undefined as never)
})

test('bare hits go to the chosen aligner, with the query first', async () => {
  blastp.mockResolvedValue({ rid: 'job', hits: [{ ...HIT, sequence: 'MKWV' }] })
  mockLaunchMSA.mockResolvedValue({ msa: 'aligned', tree: 'tree' })

  const result = await launch(
    makeModel({
      searchProgram: 'blastp',
      blastDatabase: 'uniprotkb_swissprot',
      msaAlgorithm: 'clustalo',
      maxHits: 20,
      proteinSequence: 'MKWVTF*',
    }),
  )

  expect(blastp).toHaveBeenCalledWith(
    expect.objectContaining({
      query: 'MKWVTF',
      database: 'uniprotkb_swissprot',
      maxHits: 20,
    }),
  )
  expect(mockLaunchMSA).toHaveBeenCalledWith(
    expect.objectContaining({
      algorithm: 'clustalo',
      sequence: '>QUERY\nMKWVTF\n>P1-Mus_musculus\nMKWV',
    }),
  )
  expect(result.msa).toBe('aligned')
  expect(result.tree).toBe('tree')
})

test('an aligned result skips the aligner and leaves the tree to the browser', async () => {
  phmmer.mockResolvedValue({
    rid: 'job',
    queryRow: 'MKWV-TF',
    hits: [{ ...HIT, sequence: 'MKWVSTF' }],
  })

  const result = await launch(
    makeModel({
      searchProgram: 'phmmer',
      blastDatabase: 'rp15',
      proteinSequence: 'MKWVTF',
    }),
  )

  expect(mockLaunchMSA).not.toHaveBeenCalled()
  expect(result.msa).toBe('>QUERY\nMKWV-TF\n>P1-Mus_musculus\nMKWVSTF')
  expect(result.tree).toBe('')
})

test('a UniProt accession supplies the query and names its row', async () => {
  vi.mocked(resolveUniProtEntry).mockResolvedValue({
    accession: 'P04637',
    id: 'P53_HUMAN',
    reviewed: true,
    taxId: 9606,
    scientificName: 'Homo sapiens',
    sequence: 'MEEPQ',
  })
  phmmer.mockResolvedValue({
    queryRow: 'MEEPQ',
    hits: [{ ...HIT, sequence: 'MEEPQ' }],
  })

  const result = await launch(
    makeModel({
      searchProgram: 'phmmer',
      blastDatabase: 'swissprot',
      accession: 'P04637',
    }),
  )

  expect(resolveUniProtEntry).toHaveBeenCalledWith(
    ['P04637'],
    0,
    expect.any(AbortSignal),
  )
  expect(setQuerySeqName).toHaveBeenCalledWith('P53_HUMAN_query')
  expect(result.msa.split('\n')[0]).toBe('>P53_HUMAN_query')
})

test('a request with no query at all is refused before any search runs', async () => {
  await expect(
    launch(makeModel({ searchProgram: 'phmmer', blastDatabase: 'swissprot' })),
  ).rejects.toThrow(/connectedTranscript/)
  expect(phmmer).not.toHaveBeenCalled()
})
