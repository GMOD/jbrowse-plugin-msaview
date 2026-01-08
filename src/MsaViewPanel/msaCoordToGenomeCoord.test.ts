import { describe, expect, test } from 'vitest'

import { msaCoordToGenomeCoord } from './msaCoordToGenomeCoord'

describe('msaCoordToGenomeCoord', () => {
  test('returns undefined when transcriptToMsaMap is undefined', () => {
    const model = {
      querySeqName: 'QUERY',
      transcriptToMsaMap: undefined,
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
        p2g: { 0: 100, 1: 103 },
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
        p2g: { 0: 100, 1: 103 },
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
        p2g: { 0: 100, 1: 103, 2: 106, 3: 109 },
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
        p2g: { 0: 100, 1: 103, 2: 106, 3: 109 },
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

  test('returns undefined when p2g mapping is incomplete', () => {
    const model = {
      querySeqName: 'QUERY',
      transcriptToMsaMap: {
        refName: 'chr1',
        p2g: { 0: 100 }, // Missing entry for position 1
      },
      rows: [['QUERY', 'MKAA']],
    }
    // Position 0 needs p2g[0] and p2g[1], but p2g[1] is missing
    const result = msaCoordToGenomeCoord({ model, coord: 0 })
    expect(result).toBeUndefined()
  })

  test('handles reverse strand (start > end in p2g)', () => {
    const model = {
      querySeqName: 'QUERY',
      transcriptToMsaMap: {
        refName: 'chr1',
        p2g: { 0: 109, 1: 106, 2: 103, 3: 100 }, // Reverse strand
      },
      rows: [['QUERY', 'MKAA']],
    }
    // Should return min/max correctly
    const result = msaCoordToGenomeCoord({ model, coord: 0 })
    expect(result).toEqual({
      refName: 'chr1',
      start: 106, // min(109, 106)
      end: 109, // max(109, 106)
    })
  })

  test('returns undefined for out of bounds coord', () => {
    const model = {
      querySeqName: 'QUERY',
      transcriptToMsaMap: {
        refName: 'chr1',
        p2g: { 0: 100, 1: 103 },
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
        p2g: { 0: 200, 1: 203 },
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
})
