import { describe, expect, test } from 'vitest'

import { gappedToUngappedPosition } from './structureConnection'

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
