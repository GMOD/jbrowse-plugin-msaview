import { describe, expect, test } from 'vitest'

import { isGeneLikeType, launchTarget } from './launchTarget'

import type { Feature } from '@jbrowse/core/util'

function feature(type: string) {
  return {
    get: (key: string) => (key === 'type' ? type : undefined),
  } as Feature
}

const modernHost = (type: string | undefined) => ({
  contextMenuItems: () => [],
  contextMenuInfo: { item: { featureId: 'f1', type }, displayedRegionIndex: 0 },
  fetchFullFeature: (featureId: string) =>
    Promise.resolve(feature(`fetched:${featureId}`)),
})

const legacyHost = (type: string) => ({
  contextMenuItems: () => [],
  contextMenuFeature: feature(type),
})

describe('isGeneLikeType', () => {
  test.each(['gene', 'mRNA', 'transcript', 'lnc_RNA', 'protein_coding_gene'])(
    'accepts %s',
    type => {
      expect(isGeneLikeType(type)).toBe(true)
    },
  )

  test.each(['CDS', 'exon', 'match', 'SNV', undefined, null, 42])(
    'rejects %s',
    type => {
      expect(isGeneLikeType(type)).toBe(false)
    },
  )
})

describe('launchTarget', () => {
  test('resolves the clicked feature through fetchFullFeature', async () => {
    const target = launchTarget(modernHost('mRNA'))
    expect(target).toBeDefined()
    expect((await target!())?.get('type')).toBe('fetched:f1')
  })

  test('offers nothing for a non-gene click', () => {
    expect(launchTarget(modernHost('CDS'))).toBeUndefined()
    expect(launchTarget(modernHost(undefined))).toBeUndefined()
  })

  test('offers nothing when nothing was clicked', () => {
    expect(launchTarget({ contextMenuItems: () => [] })).toBeUndefined()
  })

  // v3.7.0 hosts have contextMenuFeature and nothing else; dropping this
  // fallback once took "Launch MSA view" off every host in the wild.
  test('falls back to a synchronous contextMenuFeature', async () => {
    const target = launchTarget(legacyHost('mRNA'))
    expect(target).toBeDefined()
    expect((await target!())?.get('type')).toBe('mRNA')
  })

  test('applies the same gene test on both host shapes', () => {
    expect(launchTarget(legacyHost('lnc_RNA'))).toBeDefined()
    expect(launchTarget(legacyHost('exon'))).toBeUndefined()
  })

  // a host that has both shapes must not fall through to the legacy branch and
  // launch on a stale feature when the click was not on a gene
  test('a non-gene click on a host carrying both shapes offers nothing', () => {
    expect(
      launchTarget({ ...modernHost('CDS'), ...legacyHost('mRNA') }),
    ).toBeUndefined()
  })
})
