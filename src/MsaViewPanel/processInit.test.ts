import { beforeEach, expect, test, vi } from 'vitest'

import { processInit, storeDataToIndexedDB } from './afterCreateAutoruns'
import { fetchIndexedMsa } from './fetchIndexedMsa'

import type { JBrowsePluginMsaViewModel } from './model'

vi.mock('./fetchIndexedMsa', () => ({ fetchIndexedMsa: vi.fn() }))
vi.mock('./msaDataStore', () => ({
  cleanupOldData: vi.fn(),
  generateDataStoreId: vi.fn(() => 'generated'),
  retrieveMsaData: vi.fn(),
  storeMsaData: vi.fn(async () => true),
}))

const INDEXED = {
  msaIndexedLocation: { uri: 'http://example.com/msa.fa.gz' },
  msaName: 'ENST00000288602',
}

function makeModel(over: Record<string, unknown> = {}) {
  const model = {
    init: INDEXED as Record<string, unknown> | undefined,
    data: {} as { msa?: string; tree?: string; treeMetadata?: string },
    rows: [] as string[][],
    msaFilehandle: undefined,
    treeFilehandle: undefined,
    isStoringData: false,
    lastStoredData: undefined,
    setError: vi.fn(),
    setUniprotId: vi.fn(),
    setQuerySeqName: vi.fn(),
    setMSAFilehandle: vi.fn(),
    setDataStoreId: vi.fn(),
    setIsStoringData: vi.fn(),
    setLastStoredData: vi.fn(),
    setInit: vi.fn(),
    setMSA(arg: string) {
      model.data.msa = arg
    },
    ...over,
  }
  return model as typeof model & JBrowsePluginMsaViewModel
}

const settle = () => new Promise(res => setTimeout(res, 0))

beforeEach(() => {
  vi.clearAllMocks()
})

// react-msaview drops an inline alignment over 50kb from the snapshot and an
// indexed block has no filehandle to reload from, so clearing init left a
// shared session saying the alignment had expired
test('an indexed init is kept, so the block can be refetched', async () => {
  vi.mocked(fetchIndexedMsa).mockResolvedValue('>a\nMK')
  const model = makeModel()
  processInit(model)
  await settle()
  expect(model.data.msa).toBe('>a\nMK')
  expect(model.setInit).not.toHaveBeenCalled()
})

test('an alignment already in hand is not refetched', async () => {
  const model = makeModel({ data: { msa: '>a\nMK' } })
  processInit(model)
  await settle()
  expect(fetchIndexedMsa).not.toHaveBeenCalled()
})

test('a url init is still resolved once and cleared', async () => {
  const model = makeModel({ init: { msaUrl: 'http://example.com/msa.fa' } })
  processInit(model)
  await settle()
  expect(model.setMSAFilehandle).toHaveBeenCalled()
  expect(model.setInit).toHaveBeenCalledWith(undefined)
})

test('an indexed view writes no IndexedDB row', async () => {
  const model = makeModel({ rows: [['a', 'MK']], data: { msa: '>a\nMK' } })
  storeDataToIndexedDB(model)
  await settle()
  expect(model.setDataStoreId).not.toHaveBeenCalled()
})
