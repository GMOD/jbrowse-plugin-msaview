import { beforeEach, describe, expect, test, vi } from 'vitest'

import { loadStoredData, storeDataToIndexedDB } from './afterCreateAutoruns'
import {
  generateDataStoreId,
  retrieveMsaData,
  storeMsaData,
} from './msaDataStore'

import type { JBrowsePluginMsaViewModel } from './model'
import type { MsaDataPayload } from './msaDataStore'

// IndexedDB itself is msaDataStore.test.ts's subject; what is under test here is
// which writes these two autoruns decide to make.
vi.mock('./msaDataStore', () => ({
  cleanupOldData: vi.fn(),
  generateDataStoreId: vi.fn(),
  retrieveMsaData: vi.fn(),
  storeMsaData: vi.fn(),
}))

const mockRetrieve = vi.mocked(retrieveMsaData)
const mockStore = vi.mocked(storeMsaData)
const mockGenerateId = vi.mocked(generateDataStoreId)

const MSA = '>a\nMK'
const NEW_ID = 'msa-generated'

function makeModel(over: Record<string, unknown> = {}) {
  const model = {
    dataStoreId: undefined as string | undefined,
    rows: [] as string[][],
    data: {} as MsaDataPayload,
    msaFilehandle: undefined,
    treeFilehandle: undefined,
    isStoringData: false,
    lastStoredData: undefined as MsaDataPayload | undefined,
    loadingStoredData: false,
    error: undefined as unknown,
    setDataStoreId(arg?: string) {
      model.dataStoreId = arg
    },
    setIsStoringData(arg: boolean) {
      model.isStoringData = arg
    },
    setLastStoredData(arg?: MsaDataPayload) {
      model.lastStoredData = arg
    },
    setLoadingStoredData(arg: boolean) {
      model.loadingStoredData = arg
    },
    setError(arg: unknown) {
      model.error = arg
    },
    setMSA(arg: string) {
      model.data.msa = arg
    },
    setTree(arg: string) {
      model.data.tree = arg
    },
    setTreeMetadata(arg: string) {
      model.data.treeMetadata = arg
    },
    ...over,
  }
  return model as typeof model & JBrowsePluginMsaViewModel
}

const settle = () => new Promise(res => setTimeout(res, 0))

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerateId.mockReturnValue(NEW_ID)
  mockStore.mockResolvedValue(true)
})

describe('restoring a view from IndexedDB', () => {
  test('a row that is still there is applied and recorded as stored', async () => {
    mockRetrieve.mockResolvedValue({
      msa: MSA,
      tree: '(a);',
      treeMetadata: '{}',
    })
    const model = makeModel({ dataStoreId: 'msa-1' })

    loadStoredData(model)
    await settle()

    expect(model.data.msa).toBe(MSA)
    expect(model.error).toBeUndefined()
    // recorded, so the store autorun does not write the restored data straight
    // back out again
    expect(model.lastStoredData).toEqual({
      msa: MSA,
      tree: '(a);',
      treeMetadata: '{}',
    })
    model.rows = [['a', 'MK']]
    storeDataToIndexedDB(model)
    expect(mockStore).not.toHaveBeenCalled()
  })

  // the row expires or the user clears site data, and the view used to reopen as
  // a blank import form with no hint that anything had been lost
  test('a row that is gone says so, in words that name the policy', async () => {
    mockRetrieve.mockResolvedValue(undefined)
    const model = makeModel({ dataStoreId: 'msa-1' })

    loadStoredData(model)
    await settle()

    expect(model.error).toBeInstanceOf(Error)
    expect((model.error as Error).message).toMatch(/7 days/)
    // the id names nothing now, so it goes -- otherwise react-msaview's "Return
    // to import form" lands straight back on this error
    expect(model.dataStoreId).toBeUndefined()
  })
})

describe('keeping IndexedDB up to date', () => {
  test('the first alignment is written under a fresh id', async () => {
    const model = makeModel({ rows: [['a', 'MK']], data: { msa: MSA } })

    storeDataToIndexedDB(model)
    await settle()

    expect(mockStore).toHaveBeenCalledWith(NEW_ID, { msa: MSA })
    expect(model.dataStoreId).toBe(NEW_ID)
    expect(model.isStoringData).toBe(false)
  })

  // react-msaview's "calculate neighbor-joining tree" replaces data.tree long
  // after the first write; the row used to keep the alignment's original tree
  // forever, so a reopened session restored a picture the user had replaced
  test('an edit after the first write updates the existing row', async () => {
    const model = makeModel({
      dataStoreId: 'msa-1',
      rows: [['a', 'MK']],
      data: { msa: MSA, tree: '(a);' },
      lastStoredData: { msa: MSA, tree: '(a);' },
    })

    storeDataToIndexedDB(model)
    expect(mockStore).not.toHaveBeenCalled()

    model.data.tree = '(a:0.1);'
    storeDataToIndexedDB(model)
    await settle()

    expect(mockStore).toHaveBeenCalledWith('msa-1', {
      msa: MSA,
      tree: '(a:0.1);',
      treeMetadata: undefined,
    })
    expect(model.dataStoreId).toBe('msa-1')
  })

  // a browser that refuses IndexedDB (private mode) answers every write the same
  // way, and the autorun reruns on its own isStoringData flag -- so a write that
  // is not recorded as attempted is a write that retries forever
  test('a write that fails is not retried on the same data', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockStore.mockResolvedValue(false)
    const model = makeModel({ rows: [['a', 'MK']], data: { msa: MSA } })

    storeDataToIndexedDB(model)
    await settle()
    expect(model.dataStoreId).toBeUndefined()

    storeDataToIndexedDB(model)
    await settle()
    expect(mockStore).toHaveBeenCalledTimes(1)
  })

  test('a view reading from a filehandle stores nothing, since the file is the source', () => {
    storeDataToIndexedDB(
      makeModel({
        rows: [['a', 'MK']],
        data: { msa: MSA },
        msaFilehandle: { uri: 'msa.fa', locationType: 'UriLocation' },
      }),
    )
    expect(mockStore).not.toHaveBeenCalled()
  })

  test('a write already in flight is not duplicated', () => {
    storeDataToIndexedDB(
      makeModel({
        rows: [['a', 'MK']],
        data: { msa: MSA },
        isStoringData: true,
      }),
    )
    expect(mockStore).not.toHaveBeenCalled()
  })
})
