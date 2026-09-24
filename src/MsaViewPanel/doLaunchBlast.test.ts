import { beforeEach, expect, test, vi } from 'vitest'

import { saveBlastResult } from '../utils/blastCache'
import { MAX_PAIR_CELLS } from '../utils/browserAlign'
import { searchBackends } from '../utils/homologSearch'
import { launchMSA } from '../utils/msa'
import { getCachedSearch, saveSearch } from '../utils/searchCache'
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
vi.mock('../utils/searchCache', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getCachedSearch: vi.fn(),
  saveSearch: vi.fn(),
}))

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
  vi.mocked(saveBlastResult).mockResolvedValue(undefined)
  vi.mocked(getCachedSearch).mockResolvedValue(undefined)
  vi.mocked(saveSearch).mockResolvedValue(undefined)
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

// the history names the aligner that ran, which for a spec naming none is the
// in-browser one -- not a key reading `db:undefined:...`
test('a search naming no aligner is saved as aligned in the browser', async () => {
  blastp.mockResolvedValue({ rid: 'job', hits: [{ ...HIT, sequence: 'MKWV' }] })
  mockLaunchMSA.mockResolvedValue({ msa: 'aligned', tree: '' })

  await launch(
    makeModel({
      blastDatabase: 'uniprotkb_swissprot',
      maxHits: 20,
      proteinSequence: 'MKWVTF',
    }),
  )

  expect(saveBlastResult).toHaveBeenCalledWith(
    expect.objectContaining({ msaAlgorithm: 'browser', maxHits: 20 }),
  )
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

// blastParams is a frozen snapshot property, so the Feature the dialog put in
// it comes back from a session reload as the plain JSON it serialized to. The
// launch used to call .get() on that, minutes after the EBI job the reload
// resubmitted had come back, and threw where nothing was catching.
test('a transcript restored from a session snapshot still labels the cache row', async () => {
  blastp.mockResolvedValue({ rid: 'job', hits: [{ ...HIT, sequence: 'MKWV' }] })
  mockLaunchMSA.mockResolvedValue({ msa: 'aligned', tree: 'tree' })

  await launch(
    makeModel({
      searchProgram: 'blastp',
      blastDatabase: 'uniprotkb_swissprot',
      msaAlgorithm: 'clustalo',
      proteinSequence: 'MKWV',
      selectedTranscript: {
        uniqueId: 'NM_000546.6',
        name: 'TP53-201',
        parentId: 'TP53',
        gene_name: 'TP53',
      },
    }),
  )

  expect(saveBlastResult).toHaveBeenCalledWith(
    expect.objectContaining({
      geneId: 'TP53',
      transcriptId: 'NM_000546.6',
      transcriptName: 'TP53-201',
      geneName: 'TP53',
    }),
  )
})

test('a live Feature handed over in the same session labels it the same way', async () => {
  blastp.mockResolvedValue({ rid: 'job', hits: [{ ...HIT, sequence: 'MKWV' }] })
  mockLaunchMSA.mockResolvedValue({ msa: 'aligned', tree: 'tree' })

  const json = {
    uniqueId: 'NM_000546.6',
    name: 'TP53-201',
    parentId: 'TP53',
  }
  await launch(
    makeModel({
      searchProgram: 'blastp',
      blastDatabase: 'uniprotkb_swissprot',
      msaAlgorithm: 'clustalo',
      proteinSequence: 'MKWV',
      selectedTranscript: { toJSON: () => json },
    }),
  )

  expect(saveBlastResult).toHaveBeenCalledWith(
    expect.objectContaining({
      geneId: 'TP53',
      transcriptId: 'NM_000546.6',
      transcriptName: 'TP53-201',
      geneName: 'TP53',
    }),
  )
})

const BLASTP_BROWSER = {
  searchProgram: 'blastp',
  blastDatabase: 'uniprotkb_swissprot',
  msaAlgorithm: 'browser',
  proteinSequence: 'MKWVTF',
}

test('the hits are saved before the aligner runs, so a failed alignment keeps them', async () => {
  blastp.mockResolvedValue({ rid: 'job', hits: [{ ...HIT, sequence: 'MKWV' }] })
  mockLaunchMSA.mockRejectedValue(new Error('aligner fell over'))

  await expect(launch(makeModel(BLASTP_BROWSER))).rejects.toThrow(
    'aligner fell over',
  )
  expect(saveSearch).toHaveBeenCalledWith(
    expect.objectContaining({
      fasta: '>QUERY\nMKWVTF\n>P1-Mus_musculus\nMKWV',
      rid: 'job',
    }),
  )
})

test('a relaunch with saved hits aligns them without searching again', async () => {
  vi.mocked(getCachedSearch).mockResolvedValue({
    id: 'k',
    fasta: '>QUERY\nMKWVTF\n>P1\nMKWV',
    treeMetadata: {},
    rid: 'job',
    timestamp: 0,
  })
  mockLaunchMSA.mockResolvedValue({ msa: 'aligned', tree: '' })

  const result = await launch(makeModel(BLASTP_BROWSER))
  expect(blastp).not.toHaveBeenCalled()
  expect(mockLaunchMSA).toHaveBeenCalledWith(
    expect.objectContaining({ sequence: '>QUERY\nMKWVTF\n>P1\nMKWV' }),
  )
  expect(result.msa).toBe('aligned')
})

test('a query too long for the in-browser aligner is refused before the search', async () => {
  const side = Math.ceil(Math.sqrt(MAX_PAIR_CELLS)) + 1
  await expect(
    launch(makeModel({ ...BLASTP_BROWSER, proteinSequence: 'M'.repeat(side) })),
  ).rejects.toThrow(/too large to align in the browser/)
  expect(blastp).not.toHaveBeenCalled()
})

test('the same long query goes to an EBI aligner without complaint', async () => {
  const side = Math.ceil(Math.sqrt(MAX_PAIR_CELLS)) + 1
  blastp.mockResolvedValue({ rid: 'job', hits: [{ ...HIT, sequence: 'MKWV' }] })
  mockLaunchMSA.mockResolvedValue({ msa: 'aligned', tree: 'tree' })
  await launch(
    makeModel({
      ...BLASTP_BROWSER,
      msaAlgorithm: 'clustalo',
      proteinSequence: 'M'.repeat(side),
    }),
  )
  expect(blastp).toHaveBeenCalled()
})
