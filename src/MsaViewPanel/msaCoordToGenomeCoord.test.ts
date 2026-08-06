import { genomeToTranscriptSeqMapping } from 'g2p_mapper'
import { describe, expect, test } from 'vitest'

import {
  msaCoordToGenomeCoord,
  msaCoordToGenomeRegions,
} from './msaCoordToGenomeCoord'

// codon at protein position i covers three consecutive genome bases starting at
// 100 + i * 3, i.e. a single-exon forward-strand transcript
function forwardCodons(n: number) {
  return Object.fromEntries(
    Array.from({ length: n }, (_, i) => [
      i,
      [100 + i * 3, 101 + i * 3, 102 + i * 3],
    ]),
  )
}

describe('msaCoordToGenomeCoord', () => {
  test('returns undefined when neither transcriptToMsaMap nor mafRegion is defined', () => {
    const model = {
      querySeqName: 'QUERY',
      transcriptToMsaMap: undefined,
      mafRegion: undefined,
      rows: [['QUERY', 'MKAA']],
    }
    const result = msaCoordToGenomeCoord({ model, coord: 0 })
    expect(result).toBeUndefined()
  })

  test('returns undefined when query row is not found', () => {
    const model = {
      querySeqName: 'QUERY',
      transcriptToMsaMap: {
        refName: 'chr1',
        p2gCodon: forwardCodons(2),
      },
      rows: [['OTHER', 'MKAA']],
    }
    const result = msaCoordToGenomeCoord({ model, coord: 0 })
    expect(result).toBeUndefined()
  })

  test('returns undefined when coord is a gap', () => {
    const model = {
      querySeqName: 'QUERY',
      transcriptToMsaMap: {
        refName: 'chr1',
        p2gCodon: forwardCodons(2),
      },
      rows: [['QUERY', 'M-KA']],
    }
    // Position 1 is a gap
    const result = msaCoordToGenomeCoord({ model, coord: 1 })
    expect(result).toBeUndefined()
  })

  test('returns genome region for valid non-gap position', () => {
    const model = {
      querySeqName: 'QUERY',
      transcriptToMsaMap: {
        refName: 'chr1',
        p2gCodon: forwardCodons(4),
      },
      rows: [['QUERY', 'MKAA']],
    }
    // Position 0 (M) should map to ungapped 0, genome 100-103
    const result = msaCoordToGenomeCoord({ model, coord: 0 })
    expect(result).toEqual({
      refName: 'chr1',
      start: 100,
      end: 103,
    })
  })

  test('handles gapped sequence correctly', () => {
    const model = {
      querySeqName: 'QUERY',
      transcriptToMsaMap: {
        refName: 'chr1',
        p2gCodon: forwardCodons(4),
      },
      rows: [['QUERY', 'M-K-AA']],
      //                 012345 gapped positions
      //                 0  1 23 ungapped positions
    }
    // Gapped position 2 (K) = ungapped 1
    const result = msaCoordToGenomeCoord({ model, coord: 2 })
    expect(result).toEqual({
      refName: 'chr1',
      start: 103,
      end: 106,
    })

    // Gapped position 4 (first A) = ungapped 2
    const result2 = msaCoordToGenomeCoord({ model, coord: 4 })
    expect(result2).toEqual({
      refName: 'chr1',
      start: 106,
      end: 109,
    })
  })

  test('returns undefined when the position has no codon mapping', () => {
    const model = {
      querySeqName: 'QUERY',
      transcriptToMsaMap: {
        refName: 'chr1',
        p2gCodon: forwardCodons(1),
      },
      rows: [['QUERY', 'MKAA']],
    }
    // ungapped position 1 has no entry in p2gCodon
    const result = msaCoordToGenomeCoord({ model, coord: 1 })
    expect(result).toBeUndefined()
  })

  test('maps the final residue, whose codon has no successor', () => {
    const model = {
      querySeqName: 'QUERY',
      transcriptToMsaMap: {
        refName: 'chr1',
        p2gCodon: forwardCodons(4),
      },
      rows: [['QUERY', 'MKAA']],
    }
    const result = msaCoordToGenomeCoord({ model, coord: 3 })
    expect(result).toEqual({
      refName: 'chr1',
      start: 109,
      end: 112,
    })
  })

  test('returns undefined for out of bounds coord', () => {
    const model = {
      querySeqName: 'QUERY',
      transcriptToMsaMap: {
        refName: 'chr1',
        p2gCodon: forwardCodons(2),
      },
      rows: [['QUERY', 'MK']],
    }
    // Position 10 is out of bounds
    const result = msaCoordToGenomeCoord({ model, coord: 10 })
    expect(result).toBeUndefined()
  })

  test('works with multiple rows, uses querySeqName', () => {
    const model = {
      querySeqName: 'SEQ2',
      transcriptToMsaMap: {
        refName: 'chr1',
        p2gCodon: { 0: [200, 201, 202], 1: [203, 204, 205] },
      },
      rows: [
        ['SEQ1', 'AAAA'],
        ['SEQ2', 'MKAA'],
        ['SEQ3', 'LLLL'],
      ],
    }
    const result = msaCoordToGenomeCoord({ model, coord: 0 })
    expect(result).toEqual({
      refName: 'chr1',
      start: 200,
      end: 203,
    })
  })

  // The mapping comes from the real g2p_mapper rather than hand-written
  // fixtures: on the reverse strand p2g stores the codon's *highest*
  // coordinate, which is what the old p2g[pos]..p2g[pos+1] arithmetic got wrong
  describe('real g2p_mapper mappings', () => {
    test('forward strand, single exon', () => {
      const { p2gCodon, refName } = genomeToTranscriptSeqMapping({
        refName: 'chr1',
        start: 100,
        end: 112,
        strand: 1,
        subfeatures: [{ refName: 'chr1', type: 'CDS', start: 100, end: 112 }],
      })
      const model = {
        querySeqName: 'QUERY',
        transcriptToMsaMap: { refName, p2gCodon },
        rows: [['QUERY', 'MKAA']],
      }
      expect(msaCoordToGenomeCoord({ model, coord: 0 })).toEqual({
        refName: 'chr1',
        start: 100,
        end: 103,
      })
      expect(msaCoordToGenomeCoord({ model, coord: 3 })).toEqual({
        refName: 'chr1',
        start: 109,
        end: 112,
      })
    })

    test('reverse strand codon covers the last three bases of the CDS', () => {
      const { p2gCodon, refName } = genomeToTranscriptSeqMapping({
        refName: 'chr1',
        start: 100,
        end: 112,
        strand: -1,
        subfeatures: [{ refName: 'chr1', type: 'CDS', start: 100, end: 112 }],
      })
      const model = {
        querySeqName: 'QUERY',
        transcriptToMsaMap: { refName, p2gCodon },
        rows: [['QUERY', 'MKAA']],
      }
      // the first residue is translated from the 3' end of the genome region
      expect(msaCoordToGenomeCoord({ model, coord: 0 })).toEqual({
        refName: 'chr1',
        start: 109,
        end: 112,
      })
      expect(msaCoordToGenomeCoord({ model, coord: 3 })).toEqual({
        refName: 'chr1',
        start: 100,
        end: 103,
      })
    })

    test('codon split across an exon boundary yields one region per piece', () => {
      // exon 1 contributes 4 bases, so residue 1 straddles the intron
      const { p2gCodon, refName } = genomeToTranscriptSeqMapping({
        refName: 'chr1',
        start: 100,
        end: 210,
        strand: 1,
        subfeatures: [
          { refName: 'chr1', type: 'CDS', start: 100, end: 104 },
          { refName: 'chr1', type: 'CDS', start: 200, end: 202 },
        ],
      })
      const model = {
        querySeqName: 'QUERY',
        transcriptToMsaMap: { refName, p2gCodon },
        rows: [['QUERY', 'MK']],
      }
      expect(msaCoordToGenomeRegions({ model, coord: 1 })).toEqual([
        { refName: 'chr1', start: 103, end: 104 },
        { refName: 'chr1', start: 200, end: 202 },
      ])
      // the single-region form bounds the pieces, for navigation
      expect(msaCoordToGenomeCoord({ model, coord: 1 })).toEqual({
        refName: 'chr1',
        start: 103,
        end: 202,
      })
    })
  })

  // MAF region tests
  describe('mafRegion', () => {
    test('returns genome position for mafRegion mapping', () => {
      const model = {
        querySeqName: 'hg38.chr1',
        transcriptToMsaMap: undefined,
        mafRegion: {
          refName: 'chr1',
          start: 1000,
          end: 1010,
          assemblyName: 'hg38',
        },
        rows: [['hg38.chr1', 'ACGTACGTAC']],
      }
      // Position 0 should map to genome 1000
      const result = msaCoordToGenomeCoord({ model, coord: 0 })
      expect(result).toEqual({
        refName: 'chr1',
        start: 1000,
        end: 1001,
      })

      // Position 5 should map to genome 1005
      const result2 = msaCoordToGenomeCoord({ model, coord: 5 })
      expect(result2).toEqual({
        refName: 'chr1',
        start: 1005,
        end: 1006,
      })
    })

    test('handles gaps in mafRegion sequence', () => {
      const model = {
        querySeqName: 'hg38.chr1',
        transcriptToMsaMap: undefined,
        mafRegion: {
          refName: 'chr1',
          start: 1000,
          end: 1008,
          assemblyName: 'hg38',
        },
        rows: [['hg38.chr1', 'AC--GTAC']],
        // Gapped positions: 0  1  2  3  4  5  6  7
        // Ungapped:         0  1        2  3  4  5
      }
      // Position 2 is a gap, should return undefined
      const result = msaCoordToGenomeCoord({ model, coord: 2 })
      expect(result).toBeUndefined()

      // Position 4 (G) = ungapped 2 = genome 1002
      const result2 = msaCoordToGenomeCoord({ model, coord: 4 })
      expect(result2).toEqual({
        refName: 'chr1',
        start: 1002,
        end: 1003,
      })
    })

    test('returns undefined when position exceeds mafRegion end', () => {
      const model = {
        querySeqName: 'hg38.chr1',
        transcriptToMsaMap: undefined,
        mafRegion: {
          refName: 'chr1',
          start: 1000,
          end: 1005,
          assemblyName: 'hg38',
        },
        rows: [['hg38.chr1', 'ACGTACGTAC']], // 10 chars but region is only 5bp
      }
      // Position 8 would be ungapped 8 = genome 1008, but region ends at 1005
      const result = msaCoordToGenomeCoord({ model, coord: 8 })
      expect(result).toBeUndefined()
    })

    test('mafRegion takes precedence over transcriptToMsaMap', () => {
      const model = {
        querySeqName: 'hg38.chr1',
        transcriptToMsaMap: {
          refName: 'chr2',
          p2gCodon: { 0: [5000, 5001, 5002], 1: [5003, 5004, 5005] },
        },
        mafRegion: {
          refName: 'chr1',
          start: 1000,
          end: 1010,
          assemblyName: 'hg38',
        },
        rows: [['hg38.chr1', 'ACGTACGTAC']],
      }
      // Should use mafRegion, not transcriptToMsaMap
      const result = msaCoordToGenomeCoord({ model, coord: 0 })
      expect(result).toEqual({
        refName: 'chr1',
        start: 1000,
        end: 1001,
      })
    })
  })
})
