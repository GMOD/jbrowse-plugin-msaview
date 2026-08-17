import { types } from '@jbrowse/mobx-state-tree'
import { describe, expect, test } from 'vitest'

import { extendStateModel } from './index'

// A host display whose own contextMenuItems reaches the rest of itself through
// `this` -- which is what jbrowse-components shipped between b439251a21 and
// 104bbfc581, and what any host is free to do again. This plugin captures the
// base method and calls it detached, so a bare call leaves `this` undefined, the
// read throws inside the ErrorBoundary the menu builds in, and a right-click
// produces no menu at all: the host's own rows go with it.
function hostReadingThis(clickedType: string) {
  return types
    .model('MockDisplay', { id: types.optional(types.string, 'display1') })
    .views(self => ({
      get isGeneLike() {
        return self.id === 'display1'
      },
    }))
    .views(() => ({
      contextMenuItems(this: { isGeneLike: boolean }): { label: string }[] {
        return [{ label: `host item ${this.isGeneLike}` }]
      },
      get contextMenuInfo() {
        return {
          item: { featureId: 'f1', type: clickedType },
          displayedRegionIndex: 0,
        }
      },
      fetchFullFeature() {
        return Promise.resolve(undefined)
      },
    }))
}

const labels = (stateModel: ReturnType<typeof extendStateModel>) =>
  stateModel
    .create()
    .contextMenuItems()
    .map((i: { label: string }) => i.label)

describe('extendStateModel', () => {
  test('calls the host contextMenuItems with a receiver', () => {
    expect(labels(extendStateModel(hostReadingThis('mRNA')))).toEqual([
      'host item true',
      'Launch MSA view',
    ])
  })

  test('leaves the host menu alone when the click is not on a gene', () => {
    expect(labels(extendStateModel(hostReadingThis('CDS')))).toEqual([
      'host item true',
    ])
  })

  // two plugins extending the same display each capture the previous
  // contextMenuItems, so the receiver has to survive the whole chain
  test('survives another plugin extending the display underneath it', () => {
    const withOther = extendStateModel(hostReadingThis('mRNA')).views(self => {
      const superContextMenuItems = self.contextMenuItems
      return {
        contextMenuItems() {
          return [
            ...superContextMenuItems.call(self),
            { label: 'other plugin' },
          ]
        },
      }
    })
    expect(labels(withOther)).toEqual([
      'host item true',
      'Launch MSA view',
      'other plugin',
    ])
  })
})
