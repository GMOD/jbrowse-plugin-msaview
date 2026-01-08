import { describe, expect, test } from 'vitest'

import {
  buildAlignmentMaps,
  needlemanWunsch,
  runPairwiseAlignment,
} from './pairwiseAlignment'

describe('needlemanWunsch', () => {
  test('identical sequences align perfectly', () => {
    const result = needlemanWunsch('MKAA', 'MKAA')
    expect(result.alignedSeq1).toBe('MKAA')
    expect(result.alignedSeq2).toBe('MKAA')
    expect(result.score).toBeGreaterThan(0)
  })

  test('aligned sequences have same length', () => {
    const result = needlemanWunsch('MKAAYLSMFG', 'MKAYLSMFG')
    expect(result.alignedSeq1.length).toBe(result.alignedSeq2.length)
  })

  test('aligned sequences preserve original characters', () => {
    const seq1 = 'MKAAYLSMFG'
    const seq2 = 'MKAYLSMFG'
    const result = needlemanWunsch(seq1, seq2)
    expect(result.alignedSeq1.replaceAll('-', '')).toBe(seq1)
    expect(result.alignedSeq2.replaceAll('-', '')).toBe(seq2)
  })

  test('handles empty sequences', () => {
    const result = needlemanWunsch('', '')
    expect(result.alignedSeq1).toBe('')
    expect(result.alignedSeq2).toBe('')
  })

  test('handles one empty sequence', () => {
    const result = needlemanWunsch('MKA', '')
    expect(result.alignedSeq1.replaceAll('-', '')).toBe('MKA')
    expect(result.alignedSeq2.replaceAll('-', '')).toBe('')
    expect(result.alignedSeq1.length).toBe(result.alignedSeq2.length)
  })
})

describe('runPairwiseAlignment', () => {
  test('returns PairwiseAlignment format', () => {
    const result = runPairwiseAlignment('MKAA', 'MKAA')
    expect(result.consensus).toBeDefined()
    expect(result.alns).toHaveLength(2)
    expect(result.alns[0].id).toBe('msa')
    expect(result.alns[1].id).toBe('structure')
  })

  test('consensus marks matches with pipe', () => {
    const result = runPairwiseAlignment('MKAA', 'MKAA')
    expect(result.consensus).toBe('||||')
  })

  test('consensus marks gaps with space', () => {
    const result = runPairwiseAlignment('MKAA', 'MKA')
    expect(result.consensus).toContain(' ')
  })

  test('consensus marks mismatches with space', () => {
    const result = runPairwiseAlignment('MKAA', 'MKBA')
    // A vs B should be a space in consensus
    expect(result.consensus).toContain(' ')
  })
})

describe('buildAlignmentMaps', () => {
  test('builds bidirectional maps for identical sequences', () => {
    const alignment = runPairwiseAlignment('MKAA', 'MKAA')
    const { seq1ToSeq2, seq2ToSeq1 } = buildAlignmentMaps(alignment)

    expect(seq1ToSeq2.get(0)).toBe(0)
    expect(seq1ToSeq2.get(1)).toBe(1)
    expect(seq1ToSeq2.get(2)).toBe(2)
    expect(seq1ToSeq2.get(3)).toBe(3)

    expect(seq2ToSeq1.get(0)).toBe(0)
    expect(seq2ToSeq1.get(1)).toBe(1)
    expect(seq2ToSeq1.get(2)).toBe(2)
    expect(seq2ToSeq1.get(3)).toBe(3)
  })

  test('maps are inverses of each other for matched positions', () => {
    const alignment = runPairwiseAlignment('MKAAYLSMFG', 'MKAYLSMFG')
    const { seq1ToSeq2, seq2ToSeq1 } = buildAlignmentMaps(alignment)

    // For every mapped position, the inverse should return the original
    for (const [pos1, pos2] of seq1ToSeq2) {
      expect(seq2ToSeq1.get(pos2)).toBe(pos1)
    }
  })

  test('handles gaps correctly - positions without counterpart are not in map', () => {
    // Aligning 'MKAAA' with 'MKA' should result in gaps
    const alignment = runPairwiseAlignment('MKAAA', 'MKA')
    const { seq1ToSeq2 } = buildAlignmentMaps(alignment)

    // seq1 has 5 positions, seq2 has 3
    // Only matched positions should be in the map
    expect(seq1ToSeq2.size).toBeLessThanOrEqual(3)
  })

  test('handles real protein sequence alignment', () => {
    const msaSeq = 'MKAAYLSMFGKEDHKPFGDDEVELFRAVPGLKLKIAG'
    const structureSeq = 'MKAAYLSMFGKEDHKPFGDDEVELFRAVPGLKLKIAG'

    const alignment = runPairwiseAlignment(msaSeq, structureSeq)
    const { seq1ToSeq2, seq2ToSeq1 } = buildAlignmentMaps(alignment)

    // Identical sequences should have 1:1 mapping
    expect(seq1ToSeq2.size).toBe(msaSeq.length)
    expect(seq2ToSeq1.size).toBe(structureSeq.length)

    // Check a few positions
    expect(seq1ToSeq2.get(0)).toBe(0)
    expect(seq1ToSeq2.get(10)).toBe(10)
    expect(seq2ToSeq1.get(20)).toBe(20)
  })

  test('handles sequences with insertions/deletions', () => {
    // MSA sequence has an extra 'X' in the middle
    const msaSeq = 'MKAXYLSMFG'
    const structureSeq = 'MKAYLSMFG'

    const alignment = runPairwiseAlignment(msaSeq, structureSeq)
    const { seq1ToSeq2 } = buildAlignmentMaps(alignment)

    // Positions before the insertion should map correctly
    expect(seq1ToSeq2.get(0)).toBe(0) // M
    expect(seq1ToSeq2.get(1)).toBe(1) // K
    expect(seq1ToSeq2.get(2)).toBe(2) // A

    // The mapping should handle the offset after insertion
    // (exact behavior depends on alignment algorithm)
    expect(seq1ToSeq2.size).toBeLessThanOrEqual(structureSeq.length)
  })
})
