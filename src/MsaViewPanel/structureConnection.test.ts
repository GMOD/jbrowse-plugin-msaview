import { describe, expect, test } from 'vitest'

import {
  gappedToUngappedPosition,
  structureMatchesMsa,
} from './structureConnection'

describe('structureMatchesMsa', () => {
  test('matches on a shared genome view alone (no UniProt id)', () => {
    expect(
      structureMatchesMsa({
        structure: { connectedViewId: 'lgv-TP53' },
        connectedViewId: 'lgv-TP53',
      }),
    ).toBe(true)
  })

  test('matches on a shared UniProt id alone (no genome view)', () => {
    expect(
      structureMatchesMsa({
        structure: { uniprotId: 'P04637' },
        uniprotId: 'P04637',
      }),
    ).toBe(true)
  })

  test('shared genome view wins even when UniProt ids differ', () => {
    expect(
      structureMatchesMsa({
        structure: { connectedViewId: 'lgv-TP53', uniprotId: 'OTHER' },
        connectedViewId: 'lgv-TP53',
        uniprotId: 'P04637',
      }),
    ).toBe(true)
  })

  test('no match when neither key matches', () => {
    expect(
      structureMatchesMsa({
        structure: { connectedViewId: 'lgv-OTHER', uniprotId: 'OTHER' },
        connectedViewId: 'lgv-TP53',
        uniprotId: 'P04637',
      }),
    ).toBe(false)
  })

  test('two undefined connectedViewIds do not count as a shared genome view', () => {
    // both sides lacking a genome view must NOT auto-pair on `undefined ===
    // undefined`; only an explicit shared id (or UniProt id) connects
    expect(structureMatchesMsa({ structure: {} })).toBe(false)
    expect(
      structureMatchesMsa({ structure: { uniprotId: 'P04637' } }),
    ).toBe(false)
  })
})

describe('gappedToUngappedPosition', () => {
  test('returns correct ungapped position for non-gap character', () => {
    const seq = 'M-KA-A'
    //           0 12 34  (gapped positions)
    //           0  1  2  (ungapped positions for M, K, A, A)
    expect(gappedToUngappedPosition(seq, 0)).toBe(0) // M -> 0
    expect(gappedToUngappedPosition(seq, 2)).toBe(1) // K -> 1
    expect(gappedToUngappedPosition(seq, 3)).toBe(2) // A -> 2
    expect(gappedToUngappedPosition(seq, 5)).toBe(3) // A -> 3
  })

  test('returns undefined for gap position', () => {
    const seq = 'M-KA-A'
    expect(gappedToUngappedPosition(seq, 1)).toBeUndefined() // gap
    expect(gappedToUngappedPosition(seq, 4)).toBeUndefined() // gap
  })

  test('returns undefined for out-of-bounds position', () => {
    const seq = 'MKA'
    expect(gappedToUngappedPosition(seq, -1)).toBeUndefined()
    expect(gappedToUngappedPosition(seq, 3)).toBeUndefined()
    expect(gappedToUngappedPosition(seq, 100)).toBeUndefined()
  })

  test('handles sequence with no gaps', () => {
    const seq = 'MKAA'
    expect(gappedToUngappedPosition(seq, 0)).toBe(0)
    expect(gappedToUngappedPosition(seq, 1)).toBe(1)
    expect(gappedToUngappedPosition(seq, 2)).toBe(2)
    expect(gappedToUngappedPosition(seq, 3)).toBe(3)
  })

  test('handles sequence with leading gaps', () => {
    const seq = '--MKA'
    expect(gappedToUngappedPosition(seq, 0)).toBeUndefined()
    expect(gappedToUngappedPosition(seq, 1)).toBeUndefined()
    expect(gappedToUngappedPosition(seq, 2)).toBe(0) // M
    expect(gappedToUngappedPosition(seq, 3)).toBe(1) // K
  })

  test('handles sequence with trailing gaps', () => {
    const seq = 'MKA--'
    expect(gappedToUngappedPosition(seq, 2)).toBe(2) // A
    expect(gappedToUngappedPosition(seq, 3)).toBeUndefined()
    expect(gappedToUngappedPosition(seq, 4)).toBeUndefined()
  })

  test('handles empty sequence', () => {
    expect(gappedToUngappedPosition('', 0)).toBeUndefined()
  })

  test('handles all-gap sequence', () => {
    const seq = '---'
    expect(gappedToUngappedPosition(seq, 0)).toBeUndefined()
    expect(gappedToUngappedPosition(seq, 1)).toBeUndefined()
    expect(gappedToUngappedPosition(seq, 2)).toBeUndefined()
  })
})
