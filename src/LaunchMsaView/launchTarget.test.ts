import { SimpleFeature } from '@jbrowse/core/util'
import { describe, expect, test } from 'vitest'

import { launchTarget } from './launchTarget'

const host = (type: string | undefined) => ({
  contextMenuItems: () => [],
  contextMenuInfo: { item: { featureId: 'f1', type }, displayedRegionIndex: 0 },
  fetchFullFeature: (featureId: string) =>
    Promise.resolve(
      new SimpleFeature({
        uniqueId: featureId,
        refName: 'chr1',
        start: 0,
        end: 100,
        type: `fetched:${featureId}`,
      }),
    ),
})

describe('launchTarget', () => {
  test('resolves the clicked feature through fetchFullFeature', async () => {
    const feature = await launchTarget(host('mRNA'))?.fetchFeature()
    expect(feature?.get('type')).toBe('fetched:f1')
  })

  test('offers nothing for a non-gene click', () => {
    expect(launchTarget(host('CDS'))).toBeUndefined()
    expect(launchTarget(host(undefined))).toBeUndefined()
  })

  test('offers nothing when nothing was clicked', () => {
    expect(
      launchTarget({ ...host('mRNA'), contextMenuInfo: undefined }),
    ).toBeUndefined()
  })

  // the canvas host names the clicked isoform beside the gene it fetches, as
  // its own Collapse introns dialog reads it
  test('carries the isoform a click landed on', () => {
    const h = host('gene')
    const target = launchTarget({
      ...h,
      contextMenuInfo: {
        ...h.contextMenuInfo,
        subfeature: { featureId: 'mrna-2' },
      },
    })
    expect(target?.preferredTranscriptId).toBe('mrna-2')
  })
})
