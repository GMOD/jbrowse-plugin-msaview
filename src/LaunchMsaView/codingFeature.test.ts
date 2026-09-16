import { SimpleFeature } from '@jbrowse/core/util'
import { describe, expect, it } from 'vitest'

import {
  geneLikeRoot,
  isCodingFeature,
  isGeneLikeType,
  isKnownNonCoding,
} from './codingFeature'

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

describe('isGeneLikeType', () => {
  it('accepts the SO spellings of gene, transcript and RNA', () => {
    for (const t of [
      'gene',
      'mRNA',
      'transcript',
      'ncRNA_gene',
      'protein_coding_gene',
      'V_gene_segment',
      'primary_transcript',
      'pseudogenic_transcript',
      'lnc_RNA',
    ]) {
      expect(isGeneLikeType(t)).toBe(true)
    }
  })

  it('rejects regions, matches and CDS', () => {
    for (const t of ['intergenic_region', 'cDNA_match', 'CDS', 'exon']) {
      expect(isGeneLikeType(t)).toBe(false)
    }
    expect(isGeneLikeType(undefined)).toBe(false)
  })
})

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

describe('isKnownNonCoding', () => {
  it('is true for a transcript whose subfeatures are all exons', () => {
    expect(
      isKnownNonCoding(feature('lnc_RNA', [feature('exon'), feature('exon')])),
    ).toBe(true)
  })

  // a host is free to hand over a bare record, and reading that as "no protein
  // here" takes the menu item off an ordinary gene without a word
  it('is false for a feature that arrived with no subfeatures at all', () => {
    expect(isKnownNonCoding(feature('gene'))).toBe(false)
  })

  it('is false when a CDS is somewhere below', () => {
    expect(
      isKnownNonCoding(feature('gene', [feature('mRNA', [feature('CDS')])])),
    ).toBe(false)
  })
})

describe('geneLikeRoot', () => {
  it('climbs from an isoform to its gene', () => {
    const gene = feature('gene', [feature('mRNA', [feature('CDS')])])
    const mrna = gene.get('subfeatures')![0]!
    expect(geneLikeRoot(mrna)).toBe(gene)
  })

  it('stays put with no gene-like parent', () => {
    const mrna = feature('mRNA', [feature('CDS')])
    expect(geneLikeRoot(mrna)).toBe(mrna)
  })
})
