import { SimpleFeature } from '@jbrowse/core/util'
import { translateTranscript } from '@jbrowse/core/util/translateTranscript'
import { genomeToTranscriptSeqMapping } from 'g2p_mapper'
import { describe, expect, test } from 'vitest'

import { transcriptPosToVisibleCol } from '../MsaViewPanel/util'
import { findQueryRow } from './detectQueryRow'
import { cleanProteinSequence } from './util'

describe('cleanProteinSequence', () => {
  test('drops the stop and a trailing partial codon', () => {
    expect(cleanProteinSequence('MAWK*')).toBe('MAWK')
    expect(cleanProteinSequence('MAWK&')).toBe('MAWK')
  })

  test('keeps a residue for every other codon', () => {
    expect(cleanProteinSequence('&MAWK*')).toBe('XMAWK')
    expect(cleanProteinSequence('MA*WK*')).toBe('MAXWK')
    expect(cleanProteinSequence('MA&WK')).toBe('MAXWK')
  })
})

// what the genome view hovers is a codon, and what lights is the query row's
// residue at g2p's number for that codon, so the two have to count alike
describe('a launched query row read through g2p', () => {
  function rowResidueUnder(genomePos: number, json: Record<string, unknown>) {
    const seq = json.seq as string
    const feature = new SimpleFeature(json as never)
    const row = cleanProteinSequence(
      translateTranscript({ transcript: feature, seq })?.protein ?? '',
    )
    const { g2p } = genomeToTranscriptSeqMapping(feature.toJSON() as never)
    const col = transcriptPosToVisibleCol(
      {
        querySeqName: 'QUERY',
        querySeqOffset: 0,
        seqPosToVisibleCol: (_, p) => (p < row.length ? p : row.length),
        visibleColToSeqPos: (_, c) => (c < row.length ? c : undefined),
      },
      g2p[genomePos]!,
    )
    return row[col!]
  }

  function transcript(seq: string, cds: Record<string, unknown>) {
    return {
      uniqueId: 't1',
      refName: 'chr1',
      start: 0,
      end: seq.length,
      strand: 1,
      type: 'mRNA',
      seq,
      subfeatures: [
        { uniqueId: 'c1', refName: 'chr1', start: 0, end: seq.length, ...cds },
      ],
    }
  }

  test('after a partial first codon', () => {
    // G | ATG GCC TGG AAA TAA: base 4 opens GCC, alanine
    const json = transcript('GATGGCCTGGAAATAA', { type: 'CDS', phase: 1 })
    expect(rowResidueUnder(4, json)).toBe('A')
    expect(rowResidueUnder(10, json)).toBe('K')
  })

  test('on the reverse strand, across an intron, after a partial first codon', () => {
    // sense G | ATG GCC <intron> TGG AAA TAA, stored as the reverse complement
    const json = {
      uniqueId: 't1',
      refName: 'chr1',
      start: 0,
      end: 24,
      strand: -1,
      type: 'mRNA',
      seq: 'TTATTTCCACTACTTACGGCCATC',
      subfeatures: [
        {
          uniqueId: 'c1',
          refName: 'chr1',
          type: 'CDS',
          start: 17,
          end: 24,
          phase: 1,
        },
        {
          uniqueId: 'c2',
          refName: 'chr1',
          type: 'CDS',
          start: 0,
          end: 9,
          phase: 0,
        },
      ],
    }
    expect(rowResidueUnder(22, json)).toBe('M')
    expect(rowResidueUnder(18, json)).toBe('A')
    expect(rowResidueUnder(7, json)).toBe('W')
    expect(rowResidueUnder(4, json)).toBe('K')
  })

  test('after an internal stop', () => {
    // ATG TGA GCC TGG TAA: a selenocysteine GENCODE does not annotate
    const json = transcript('ATGTGAGCCTGGTAA', { type: 'CDS' })
    expect(rowResidueUnder(6, json)).toBe('A')
  })
})

describe('query row detection', () => {
  test('matches a row a search launch built from a partial transcript', () => {
    const msa = '>QUERY\nXMAWK\n>other\nMAWR-'
    expect(findQueryRow(msa, '&MAWK*').match).toMatchObject({
      name: 'QUERY',
      quality: 'exact',
      offset: 0,
    })
  })

  test('still places a row that starts at the first whole codon', () => {
    const msa = '>Query_1\nMAWK\n>other\nMAWR'
    expect(findQueryRow(msa, '&MAWK*').match).toMatchObject({
      name: 'Query_1',
      offset: 1,
    })
  })
})
