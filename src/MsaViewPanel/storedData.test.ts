import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import stateModelFactory from './model'
import {
  deleteMsaData,
  generateDataStoreId,
  retrieveMsaData,
  storeMsaData,
} from './msaDataStore'

import type { MsaDataPayload } from './msaDataStore'

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
const mockGenerateId = vi.mocked(generateDataStoreId)

const SMALL_MSA = '>a\nMK'
const BIG_MSA = `>a\n${'M'.repeat(60_000)}`
const BIG_GFF = 'a\t.\tdomain\t1\t2\n'.repeat(4_000)
const OTHER_GFF = 'b\t.\tdomain\t1\t2\n'.repeat(4_000)
const BIG_TREE = `(${'a'.repeat(60_000)},b);`
const OTHER_TREE = `(${'c'.repeat(60_000)},d);`
const NEW_ID = 'msa-generated'
const URL_MSA: { uri: string; locationType: 'UriLocation' } = {
  uri: 'https://example.com/msa.fa',
  locationType: 'UriLocation',
}
const URL_GFF: { uri: string; locationType: 'UriLocation' } = {
  uri: 'https://example.com/a.gff',
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

function sharedRowStore(initial: MsaDataPayload) {
  const rows = new Map<string, MsaDataPayload>([['shared', initial]])
  mockRetrieve.mockImplementation(async id => rows.get(id))
  mockStore.mockImplementation(async (id, data) => {
    rows.set(id, data)
    return true
  })
  mockDelete.mockImplementation(async id => {
    rows.delete(id)
  })
  return rows
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', () => new Promise(() => {}))
  let n = 0
  mockGenerateId.mockImplementation(() => `${NEW_ID}-${++n}`)
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
    const model = view({ gffFilehandle: URL_GFF })
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

  test('a large GFF comes back on a view whose alignment is in the snapshot', async () => {
    mockRetrieve.mockResolvedValue({ gff: BIG_GFF })
    const model = view({ dataStoreId: 'msa-1', data: { msa: SMALL_MSA } })
    await settle()

    expect(model.data.gff).toBe(BIG_GFF)
    expect(mockStore).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  test('a row holding nothing a reload would lose is let go, not deleted', async () => {
    mockRetrieve.mockResolvedValue({ msa: SMALL_MSA })
    const model = view({ dataStoreId: 'msa-1', data: { msa: SMALL_MSA } })
    await settle()
    await settle()

    expect(model.dataStoreId).toBeUndefined()
    expect(mockDelete).not.toHaveBeenCalled()
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
    expect(model.warnings.join()).toMatch(/annotations, a tree or row metadata/)
    expect(model.dataStoreId).toBeUndefined()
  })

  test('a read that fails keeps the id, since the row may be there', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRetrieve.mockRejectedValue(new Error('InvalidStateError'))
    const model = view({ dataStoreId: 'msa-1', msaFilehandle: URL_MSA })
    await settle()
    await settle()

    expect(model.error).toBeUndefined()
    expect(model.warnings).toEqual([])
    expect(model.dataStoreId).toBe('msa-1')
  })

  test('a reset while the read is pending discards what it reads', async () => {
    let resolve: (v: MsaDataPayload) => void = () => {}
    mockRetrieve.mockReturnValue(
      new Promise<MsaDataPayload>(r => {
        resolve = r
      }),
    )
    const model = view({ dataStoreId: 'msa-1' })
    model.reset()
    resolve({ msa: BIG_MSA })
    await settle()
    await settle()

    expect(model.data.msa).toBeUndefined()
    expect(model.dataStoreId).toBeUndefined()
    expect(mockStore).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})

describe('a row two views name', () => {
  test('a copy that no longer needs the row leaves it for the original', async () => {
    const rows = sharedRowStore({ gff: BIG_GFF })
    const copy = view({ dataStoreId: 'shared', msaFilehandle: URL_MSA })
    await settle()
    expect(copy.data.gff).toBe(BIG_GFF)

    copy.setGFFFilehandle(URL_GFF)
    copy.setGFF('a\t.\tdomain\t1\t2')
    await settle()
    await settle()

    expect(mockDelete).not.toHaveBeenCalled()
    expect(rows.get('shared')).toEqual({ gff: BIG_GFF })
    expect(copy.dataStoreId).toBeUndefined()

    const original = view({ dataStoreId: 'shared', msaFilehandle: URL_MSA })
    await settle()
    expect(original.data.gff).toBe(BIG_GFF)
  })

  test("a copy's edit goes to a row of its own", async () => {
    const rows = sharedRowStore({ gff: BIG_GFF, tree: BIG_TREE })
    const copy = view({ dataStoreId: 'shared', msaFilehandle: URL_MSA })
    await settle()

    copy.setTree(OTHER_TREE)
    copy.setGFF(OTHER_GFF)
    await settle()
    await settle()

    expect(copy.dataStoreId).toBe(`${NEW_ID}-1`)
    expect(rows.get('shared')).toEqual({ gff: BIG_GFF, tree: BIG_TREE })

    const original = view({ dataStoreId: 'shared', msaFilehandle: URL_MSA })
    await settle()
    expect(original.data.tree).toBe(BIG_TREE)
    expect(original.data.gff).toBe(BIG_GFF)
  })

  test('a view resets only a row it wrote itself', async () => {
    sharedRowStore({ gff: BIG_GFF })
    const copy = view({ dataStoreId: 'shared', msaFilehandle: URL_MSA })
    await settle()

    copy.reset()

    expect(mockDelete).not.toHaveBeenCalled()
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
      `${NEW_ID}-1`,
      expect.objectContaining({ msa: BIG_MSA }),
    )
    expect(model.dataStoreId).toBe(`${NEW_ID}-1`)
    expect(model.isStoringData).toBe(false)
  })

  test('a large local GFF on a url-loaded view is written, and only it', async () => {
    const model = view({ msaFilehandle: URL_MSA })
    model.setMSA(BIG_MSA)
    model.setGFF(BIG_GFF)
    await settle()

    expect(mockStore).toHaveBeenCalledTimes(1)
    expect(mockStore).toHaveBeenCalledWith(`${NEW_ID}-1`, {
      msa: undefined,
      tree: undefined,
      treeMetadata: undefined,
      gff: BIG_GFF,
    })
  })

  test('an edit after the first write updates the row it wrote', async () => {
    const model = view()
    model.setMSA(BIG_MSA)
    await settle()
    model.setTree(BIG_TREE)
    await settle()

    expect(mockStore).toHaveBeenLastCalledWith(
      `${NEW_ID}-1`,
      expect.objectContaining({ msa: BIG_MSA, tree: BIG_TREE }),
    )
  })

  test('a view left holding nothing a reload would lose drops the id', async () => {
    const model = view({ data: { msa: SMALL_MSA } })
    model.setGFF(BIG_GFF)
    await settle()
    model.setGFF('a\t.\tdomain\t1\t2')
    await settle()

    expect(mockDelete).not.toHaveBeenCalled()
    expect(model.dataStoreId).toBeUndefined()
    expect(getSnapshot(model).dataStoreId).toBeUndefined()
  })

  test('a reset deletes the row the view wrote', async () => {
    const model = view()
    model.setMSA(BIG_MSA)
    await settle()

    model.reset()

    expect(mockDelete).toHaveBeenCalledWith(`${NEW_ID}-1`)
  })

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
