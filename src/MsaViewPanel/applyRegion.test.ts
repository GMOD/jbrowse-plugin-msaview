import { expect, test, vi } from 'vitest'

import { applyRegion } from './applyRegion'

import type { Region } from 'react-msaview'

const REGION: Region = { row: 'Human', start: 245, end: 249 }

function makeModel(over: Record<string, unknown> = {}) {
  const model = {
    region: REGION as Region | undefined,
    viewInitialized: true,
    numColumns: 400,
    treeFilehandle: undefined as unknown,
    data: {} as { tree?: string },
    zoomToRegion: vi.fn(),
    setRegion: vi.fn((arg?: Region) => {
      model.region = arg
    }),
    ...over,
  }
  return model
}

test('zooms onto the region once, then forgets it', () => {
  const model = makeModel()
  applyRegion(model)
  applyRegion(model)
  expect(model.zoomToRegion).toHaveBeenCalledTimes(1)
  expect(model.zoomToRegion).toHaveBeenCalledWith(REGION)
  expect(model.region).toBeUndefined()
})

test('waits for the view to have a width', () => {
  const model = makeModel({ viewInitialized: false })
  applyRegion(model)
  expect(model.zoomToRegion).not.toHaveBeenCalled()
  expect(model.region).toEqual(REGION)
})

test('waits for the alignment', () => {
  const model = makeModel({ numColumns: 0 })
  applyRegion(model)
  expect(model.zoomToRegion).not.toHaveBeenCalled()
})

test('waits for a tree file, whose collapsed clades move the columns', () => {
  const model = makeModel({ treeFilehandle: { uri: 'x.nh' } })
  applyRegion(model)
  expect(model.zoomToRegion).not.toHaveBeenCalled()

  model.data.tree = '(a,b);'
  applyRegion(model)
  expect(model.zoomToRegion).toHaveBeenCalledTimes(1)
})
