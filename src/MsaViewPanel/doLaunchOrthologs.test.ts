import { beforeEach, describe, expect, test, vi } from 'vitest'

import { doLaunchOrthologs } from './doLaunchOrthologs'
import { launchMSA } from '../utils/msa'
import {
  defaultMaxSpecies,
  fetchOrthologRows,
  fetchProteinForGene,
  resolveGeneId,
} from '../utils/ncbiOrthologs'

import type { JBrowsePluginMsaViewModel } from './model'
import type { OrthologRow } from '../utils/ncbiOrthologs'

// Every network call is mocked and nothing else is. What is under test is the
// argument shaping either side of those calls -- which species get asked for,
// what becomes the QUERY row, and whether the row earns the Accession that
// drives the CDD overlay -- so the real cleanProteinSequence stays in the
// picture.
vi.mock('../utils/ncbiOrthologs', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveGeneId: vi.fn(),
  fetchProteinForGene: vi.fn(),
  fetchOrthologRows: vi.fn(),
}))
vi.mock('../utils/msa', () => ({ launchMSA: vi.fn() }))

const mockResolveGeneId = vi.mocked(resolveGeneId)
const mockFetchProtein = vi.mocked(fetchProteinForGene)
const mockFetchRows = vi.mocked(fetchOrthologRows)
const mockLaunchMSA = vi.mocked(launchMSA)

const HUMAN = 9606
const GENE_ID = '22861'
const REPRESENTATIVE = { accession: 'NP_127497.1', sequence: 'MAGGAWGRLACY' }

function makeModel(orthologParams: Record<string, unknown>) {
  return {
    orthologParams,
    setProgress: () => {},
  } as unknown as JBrowsePluginMsaViewModel
}

function params(extra: Record<string, unknown> = {}) {
  return {
    taxId: HUMAN,
    geneCandidates: ['NLRP1'],
    msaAlgorithm: 'clustalo',
    ...extra,
  }
}

// What fetchOrthologRows was asked for, which is the only place the species
// defaults are observable.
function rowRequest() {
  const { taxa, exclude, limit } = mockFetchRows.mock.calls[0]![0]
  return {
    taxa: taxa && [...taxa].sort((a, b) => a - b),
    exclude,
    limit,
  }
}

// The QUERY row as it went to the aligner, read back out of the FASTA rather
// than out of an intermediate, since the FASTA is what the alignment is of.
function queryRowSent() {
  return mockLaunchMSA.mock.calls[0]![0].sequence.split('\n')[1]
}

function queryMetadata(result: { treeMetadata: string }) {
  return JSON.parse(result.treeMetadata).QUERY as Record<string, string>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockResolveGeneId.mockResolvedValue({ geneId: GENE_ID, matched: 'NLRP1' })
  mockFetchProtein.mockResolvedValue(REPRESENTATIVE)
  mockFetchRows.mockResolvedValue([] as OrthologRow[])
  mockLaunchMSA.mockResolvedValue({ msa: '', tree: '' })
})

describe('which species become rows', () => {
  test('omitted taxa asks for no restriction at all, which is every ortholog NCBI has', async () => {
    await doLaunchOrthologs({ self: makeModel(params()) })
    expect(rowRequest().taxa).toBeUndefined()
  })

  test('given taxa is taken as written', async () => {
    await doLaunchOrthologs({
      self: makeModel(params({ taxa: [HUMAN, 10090, 9615] })),
    })
    expect(rowRequest().taxa).toEqual([9606, 9615, 10090])
  })

  // Not folded into the taxa list before the call, so that "restrict to these"
  // and "the query row already covers this one" stay separable -- an unrestricted
  // launch still has to drop the query species.
  test('the query species is excluded whether or not taxa was given', async () => {
    await doLaunchOrthologs({ self: makeModel(params()) })
    expect(rowRequest().exclude).toBe(HUMAN)
    vi.clearAllMocks()
    mockResolveGeneId.mockResolvedValue({ geneId: GENE_ID, matched: 'NLRP1' })
    mockFetchProtein.mockResolvedValue(REPRESENTATIVE)
    mockFetchRows.mockResolvedValue([] as OrthologRow[])
    mockLaunchMSA.mockResolvedValue({ msa: '', tree: '' })
    await doLaunchOrthologs({
      self: makeModel(params({ taxa: [HUMAN, 10090] })),
    })
    expect(rowRequest().exclude).toBe(HUMAN)
  })

  test('an empty list is a request for no rows, not a request for all of them', async () => {
    await doLaunchOrthologs({ self: makeModel(params({ taxa: [] })) })
    expect(rowRequest().taxa).toEqual([])
  })
})

// The cap is the only thing standing between a launch and a 7 minute EBI job:
// NCBI publishes 865 orthologs for CFTR and the aligner runs at roughly half a
// second a row.
describe('the row cap', () => {
  test('is passed through when given', async () => {
    await doLaunchOrthologs({ self: makeModel(params({ maxSpecies: 12 })) })
    expect(rowRequest().limit).toBe(12)
  })

  test('omitted leaves the default to fetchOrthologGenes rather than sending Infinity', async () => {
    await doLaunchOrthologs({ self: makeModel(params()) })
    expect(rowRequest().limit).toBeUndefined()
    expect(defaultMaxSpecies).toBeGreaterThan(2)
  })
})

describe('the QUERY row', () => {
  test('omitted proteinSequence falls back to the representative protein', async () => {
    await doLaunchOrthologs({ self: makeModel(params()) })
    expect(queryRowSent()).toBe(REPRESENTATIVE.sequence)
  })

  test('a supplied sequence is used, and is cleaned first', async () => {
    await doLaunchOrthologs({
      self: makeModel(params({ proteinSequence: 'MAGG*AWGR&' })),
    })
    expect(queryRowSent()).toBe('MAGGAWGR')
  })

  test('throws when neither a sequence nor a representative is available', async () => {
    mockFetchProtein.mockResolvedValue(undefined)
    await expect(
      doLaunchOrthologs({ self: makeModel(params()) }),
    ).rejects.toThrow(/No query protein/)
    expect(mockLaunchMSA).not.toHaveBeenCalled()
  })

  test('a failed representative lookup does not take down a launch that brought its own sequence', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFetchProtein.mockRejectedValue(new Error('429'))
    await doLaunchOrthologs({
      self: makeModel(params({ proteinSequence: REPRESENTATIVE.sequence })),
    })
    expect(queryRowSent()).toBe(REPRESENTATIVE.sequence)
  })
})

// The Accession is what afterCreateAutoruns.autoLoadProteinDomains keys the CDD
// overlay off, and attaching it to a row that is NOT the protein it names draws
// every domain box at an offset. So the byte-identity guard is the assertion
// here, in both directions.
describe('the Accession that drives the domain overlay', () => {
  test('is attached when the query row IS the representative protein', async () => {
    const result = await doLaunchOrthologs({ self: makeModel(params()) })
    expect(queryMetadata(result)).toMatchObject({
      'Gene ID': GENE_ID,
      Accession: REPRESENTATIVE.accession,
    })
  })

  test('is withheld from a non-representative isoform', async () => {
    const result = await doLaunchOrthologs({
      self: makeModel(params({ proteinSequence: 'MDIFFERENTISOFORM' })),
    })
    expect(queryMetadata(result).Accession).toBeUndefined()
  })

  test('is withheld when the representative lookup failed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFetchProtein.mockRejectedValue(new Error('429'))
    const result = await doLaunchOrthologs({
      self: makeModel(params({ proteinSequence: REPRESENTATIVE.sequence })),
    })
    expect(queryMetadata(result).Accession).toBeUndefined()
  })
})
