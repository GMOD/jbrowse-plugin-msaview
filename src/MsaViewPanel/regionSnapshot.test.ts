import { expect, test, vi } from 'vitest'

import stateModelFactory from './model'

vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: () => ({ views: [], hovered: undefined }),
}))
vi.mock('./msaDataStore', () => ({
  cleanupOldData: vi.fn(async () => {}),
  deleteMsaData: vi.fn(async () => {}),
  generateDataStoreId: vi.fn(),
  retrieveMsaData: vi.fn(),
  storeMsaData: vi.fn(async () => true),
}))

const MSA = `>Human\n${'MEEPQSDPSV'.repeat(20)}\n>Mouse\n${'MEE-QSDPSV'.repeat(20)}`

test('a spec region waits for the view to have a width, zooms, and is dropped', () => {
  const region = { row: 'Human', start: 150, end: 160 }
  const model = stateModelFactory().create({
    type: 'MsaView',
    id: 'msaview1',
    data: { msa: MSA },
    region,
    gffFilehandle: { uri: 'http://example.com/a.gff' },
  })
  expect(model.region).toEqual(region)
  expect(model.gffFilehandle).toMatchObject({ locationType: 'UriLocation' })

  model.setWidth(800)
  expect(model.region).toBeUndefined()
  expect(model.scrollX).toBeLessThan(0)
})
