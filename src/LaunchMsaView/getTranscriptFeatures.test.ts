import { SimpleFeature } from '@jbrowse/core/util'
import { describe, expect, it } from 'vitest'

import {
  featureMatchesId,
  getTranscriptFeatures,
  getTranscriptLength,
} from './util'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

function feature(
  type: string,
  subfeatures: SimpleFeature[] = [],
  extra: Partial<SimpleFeatureSerialized> = {},
) {
  return new SimpleFeature({
    uniqueId: `${type}-${Math.random()}`,
    refName: 'chr1',
    start: 0,
    end: 90,
    type,
    subfeatures: subfeatures.map(s => s.toJSON()),
    ...extra,
  })
}

describe('getTranscriptFeatures', () => {
  it.each(['V_gene_segment', 'C_gene_segment', 'primary_transcript', 'MRNA'])(
    'offers a %s child that has a CDS',
    type => {
      const gene = feature('gene', [
        feature(type, [feature('exon'), feature('CDS')]),
        feature('lnc_RNA', [feature('exon')]),
      ])
      expect(getTranscriptFeatures(gene).map(t => t.get('type'))).toEqual([
        type,
      ])
    },
  )

  it('matches a lowercase cds child', () => {
    const gene = feature('gene', [feature('mRNA', [feature('cds')])])
    expect(getTranscriptFeatures(gene).map(t => t.get('type'))).toEqual([
      'mRNA',
    ])
  })

  it('falls back to the feature itself when it holds the CDS', () => {
    const mrna = feature('mRNA', [feature('exon'), feature('CDS')])
    expect(getTranscriptFeatures(mrna)).toEqual([mrna])
  })
})

describe('getTranscriptLength', () => {
  it('counts a lowercase cds', () => {
    expect(getTranscriptLength(feature('mRNA', [feature('cds')]))).toEqual({
      len: 30,
      mod: 0,
    })
  })
})

describe('featureMatchesId', () => {
  it('matches the protein_id of a lowercase cds', () => {
    const mrna = feature('mRNA', [
      feature('cds', [], { protein_id: 'NP_000537.3' }),
    ])
    expect(featureMatchesId(mrna, 'NP_000537.3')).toBe(true)
  })
})
