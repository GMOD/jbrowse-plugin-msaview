import { SimpleFeature } from '@jbrowse/core/util'
import { describe, expect, it } from 'vitest'

import { isCodingFeature } from './codingFeature'

function feature(type: string, subfeatures: SimpleFeature[] = []) {
  return new SimpleFeature({
    uniqueId: `${type}-${Math.random()}`,
    refName: 'chr1',
    start: 0,
    end: 100,
    type,
    subfeatures: subfeatures.map(s => s.toJSON()),
  })
}

describe('isCodingFeature', () => {
  it('finds a CDS anywhere below the feature', () => {
    const gene = feature('gene', [
      feature('mRNA', [feature('exon'), feature('CDS')]),
    ])
    expect(isCodingFeature(gene)).toBe(true)
  })

  it('is false for a transcript with exons only', () => {
    const lnc = feature('lnc_RNA', [feature('exon'), feature('exon')])
    expect(isCodingFeature(lnc)).toBe(false)
  })

  it('counts the feature itself', () => {
    expect(isCodingFeature(feature('CDS'))).toBe(true)
  })
})
