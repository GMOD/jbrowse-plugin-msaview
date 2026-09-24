import { beforeEach, describe, expect, test, vi } from 'vitest'

import stateModelFactory from './model'
import {
  deleteMsaData,
  generateDataStoreId,
  retrieveMsaData,
  storeMsaData,
} from './msaDataStore'

vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: () => ({ views: [], hovered: undefined }),
}))
vi.mock('./msaDataStore', () => ({
  cleanupOldData: vi.fn(async () => {}),
  deleteMsaData: vi.fn(async () => {}),
  generateDataStoreId: vi.fn(),
  retrieveMsaData: vi.fn(),
  storeMsaData: vi.fn(),
}))
vi.mock('./fetchIndexedMsa', () => ({
  fetchIndexedMsa: () => new Promise(() => {}),
}))

const mockRetrieve = vi.mocked(retrieveMsaData)
const mockStore = vi.mocked(storeMsaData)
const mockDelete = vi.mocked(deleteMsaData)

const SMALL_MSA = '>a\nMK'
const BIG_MSA = `>a\n${'M'.repeat(60_000)}`
const BIG_GFF = 'a\t.\tdomain\t1\t2\n'.repeat(4_000)
const BIG_TREE = `(${'a'.repeat(60_000)},b);`
const NEW_ID = 'msa-generated'
const URL_MSA: { uri: string; locationType: 'UriLocation' } = {
  uri: 'https://example.com/msa.fa',
  locationType: 'UriLocation',
}

type Snapshot = Parameters<ReturnType<typeof stateModelFactory>['create']>[0]

function view(snapshot: Partial<NonNullable<Snapshot>> = {}) {
  return stateModelFactory().create({
    type: 'MsaView',
    id: 'msaview1',
    ...snapshot,
  })
}

const settle = () => new Promise(res => setTimeout(res, 0))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', () => new Promise(() => {}))
  vi.mocked(generateDataStoreId).mockReturnValue(NEW_ID)
  mockStore.mockResolvedValue(true)
})

describe('what a reload would lose', () => {
  test('a document small enough for the snapshot is not at risk', () => {
    const model = view({ data: { msa: SMALL_MSA } })
    expect(model.unsavedDocuments.msa).toBeUndefined()
  })

  test('a large pasted alignment is', () => {
    const model = view()
    model.setMSA(BIG_MSA)
    expect(model.unsavedDocuments.msa).toBe(BIG_MSA)
  })

  test('a url-loaded alignment is not, but a large local GFF on it is', () => {
    const model = view({ msaFilehandle: URL_MSA })
    model.setMSA(BIG_MSA)
    model.setGFF(BIG_GFF)
    expect(model.unsavedDocuments).toEqual({
      msa: undefined,
      tree: undefined,
      treeMetadata: undefined,
      gff: BIG_GFF,
    })
  })

  test('an indexed alignment is not, since its kept init refetches it', () => {
    const model = view({
      init: { msaIndexedLocation: { uri: 'msa.fa.gz' }, msaName: 'ENST1' },
    })
    model.setMSA(BIG_MSA)
    expect(model.unsavedDocuments.msa).toBeUndefined()
  })

  test('a GFF read from a url is not', () => {
    const model = view({
      gffFilehandle: {
        uri: 'https://example.com/a.gff',
        locationType: 'UriLocation',
      },
    })
    model.setGFF(BIG_GFF)
    expect(model.unsavedDocuments.gff).toBeUndefined()
  })
})

describe('restoring a view from IndexedDB', () => {
  test('a stored alignment comes back and is not written straight back', async () => {
    mockRetrieve.mockResolvedValue({ msa: BIG_MSA })
    const model = view({ dataStoreId: 'msa-1' })
    await settle()

    expect(model.data.msa).toBe(BIG_MSA)
    expect(model.error).toBeUndefined()
    expect(mockStore).not.toHaveBeenCalled()
  })

  test('a large GFF comes back on a url-loaded view', async () => {
    mockRetrieve.mockResolvedValue({ gff: BIG_GFF })
    const model = view({ dataStoreId: 'msa-1', msaFilehandle: URL_MSA })
    await settle()

    expect(model.data.gff).toBe(BIG_GFF)
    expect(mockStore).not.toHaveBeenCalled()
  })

  // the alignment in the snapshot used to skip the read altogether, and the
  // first write then replaced the row's GFF with nothing
  test('a large GFF comes back on a view whose alignment is in the snapshot', async () => {
    mockRetrieve.mockResolvedValue({ gff: BIG_GFF })
    const model = view({ dataStoreId: 'msa-1', data: { msa: SMALL_MSA } })
    await settle()

    expect(model.data.gff).toBe(BIG_GFF)
    expect(mockStore).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  // rows written before only oversized documents were kept hold a small
  // alignment the snapshot already carries
  test('a row holding nothing a reload would lose is deleted', async () => {
    mockRetrieve.mockResolvedValue({ msa: SMALL_MSA })
    const model = view({ dataStoreId: 'msa-1', data: { msa: SMALL_MSA } })
    await settle()
    await settle()

    expect(mockDelete).toHaveBeenCalledWith('msa-1')
    expect(model.dataStoreId).toBeUndefined()
    expect(mockStore).not.toHaveBeenCalled()
  })

  test('a row that is gone says so, in words that name the policy', async () => {
    mockRetrieve.mockResolvedValue(undefined)
    const model = view({ dataStoreId: 'msa-1' })
    await settle()

    expect(model.error).toBeInstanceOf(Error)
    expect(`${model.error}`).toMatch(/7 days/)
    expect(`${model.error}`).toMatch(/Relaunch it from the gene/)
    expect(model.dataStoreId).toBeUndefined()
  })

  test('a row that is gone points at Retry when the search is still known', async () => {
    mockRetrieve.mockResolvedValue(undefined)
    const model = view({
      dataStoreId: 'msa-1',
      blastParams: {
        searchProgram: 'blastp',
        blastDatabase: 'uniprotkb_swissprot',
        msaAlgorithm: 'clustalo',
        proteinSequence: 'MKV',
      },
      launchCompleted: true,
    })
    await settle()

    expect(`${model.error}`).toMatch(/Retry/)
    expect(model.blastParams).toBeDefined()
  })

  test('a row that is gone from a url-loaded view warns rather than errors', async () => {
    mockRetrieve.mockResolvedValue(undefined)
    const model = view({ dataStoreId: 'msa-1', msaFilehandle: URL_MSA })
    await settle()

    expect(model.error).toBeUndefined()
    expect(model.warnings.join()).toMatch(/local file/)
    expect(model.dataStoreId).toBeUndefined()
  })
})

describe('keeping IndexedDB up to date', () => {
  test('a small alignment needs no row', async () => {
    view({ data: { msa: SMALL_MSA } })
    await settle()
    expect(mockStore).not.toHaveBeenCalled()
  })

  test('a large alignment is written under a fresh id', async () => {
    const model = view()
    model.setMSA(BIG_MSA)
    await settle()

    expect(mockStore).toHaveBeenCalledWith(
      NEW_ID,
      expect.objectContaining({ msa: BIG_MSA }),
    )
    expect(model.dataStoreId).toBe(NEW_ID)
    expect(model.isStoringData).toBe(false)
  })

  test('a large local GFF on a url-loaded view is written, and only it', async () => {
    const model = view({ msaFilehandle: URL_MSA })
    model.setMSA(BIG_MSA)
    model.setGFF(BIG_GFF)
    await settle()

    expect(mockStore).toHaveBeenCalledTimes(1)
    expect(mockStore).toHaveBeenCalledWith(NEW_ID, {
      msa: undefined,
      tree: undefined,
      treeMetadata: undefined,
      gff: BIG_GFF,
    })
  })

  // react-msaview's "calculate neighbor-joining tree" replaces data.tree long
  // after the first write
  test('an edit after the first write updates the existing row', async () => {
    const model = view()
    model.setMSA(BIG_MSA)
    await settle()
    model.setTree(BIG_TREE)
    await settle()

    expect(mockStore).toHaveBeenLastCalledWith(
      NEW_ID,
      expect.objectContaining({ msa: BIG_MSA, tree: BIG_TREE }),
    )
  })

  test('a row left holding nothing a reload would lose is deleted', async () => {
    const model = view({ data: { msa: SMALL_MSA } })
    model.setGFF(BIG_GFF)
    await settle()
    model.setGFF('a\t.\tdomain\t1\t2')
    await settle()

    expect(mockDelete).toHaveBeenCalledWith(NEW_ID)
    expect(model.dataStoreId).toBeUndefined()
  })

  // a browser that refuses IndexedDB (private mode) answers every write the
  // same way, and the autorun reruns on its own isStoringData flag
  test('a write that fails is not retried on the same data', async () => {
    mockStore.mockResolvedValue(false)
    const model = view()
    model.setMSA(BIG_MSA)
    await settle()
    await settle()

    expect(model.dataStoreId).toBeUndefined()
    expect(mockStore).toHaveBeenCalledTimes(1)
  })
})
