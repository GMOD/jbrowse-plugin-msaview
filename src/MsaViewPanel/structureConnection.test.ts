import { describe, expect, test } from 'vitest'

import {
  gappedToUngappedPosition,
  mapToRecord,
  ungappedToGappedPosition,
} from './structureConnection'

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

describe('ungappedToGappedPosition', () => {
  test('returns correct gapped position', () => {
    const seq = 'M-KA-A'
    //           0 12 34  (gapped)
    //           0  1  23 (ungapped)
    expect(ungappedToGappedPosition(seq, 0)).toBe(0) // M
    expect(ungappedToGappedPosition(seq, 1)).toBe(2) // K
    expect(ungappedToGappedPosition(seq, 2)).toBe(3) // A
    expect(ungappedToGappedPosition(seq, 3)).toBe(5) // A
  })

  test('returns undefined for out-of-bounds ungapped position', () => {
    const seq = 'M-KA'
    expect(ungappedToGappedPosition(seq, 4)).toBeUndefined()
    expect(ungappedToGappedPosition(seq, 100)).toBeUndefined()
  })

  test('handles sequence with no gaps', () => {
    const seq = 'MKAA'
    expect(ungappedToGappedPosition(seq, 0)).toBe(0)
    expect(ungappedToGappedPosition(seq, 1)).toBe(1)
    expect(ungappedToGappedPosition(seq, 2)).toBe(2)
    expect(ungappedToGappedPosition(seq, 3)).toBe(3)
  })

  test('handles sequence with leading gaps', () => {
    const seq = '--MKA'
    expect(ungappedToGappedPosition(seq, 0)).toBe(2) // M
    expect(ungappedToGappedPosition(seq, 1)).toBe(3) // K
    expect(ungappedToGappedPosition(seq, 2)).toBe(4) // A
  })

  test('handles empty sequence', () => {
    expect(ungappedToGappedPosition('', 0)).toBeUndefined()
  })

  test('handles all-gap sequence', () => {
    const seq = '---'
    expect(ungappedToGappedPosition(seq, 0)).toBeUndefined()
  })
})

describe('gappedToUngappedPosition and ungappedToGappedPosition are inverses', () => {
  test('round-trip conversion works', () => {
    const seq = 'M-KA--YL-S'
    // For each non-gap position, converting to ungapped and back should return original
    for (let i = 0; i < seq.length; i++) {
      if (seq[i] !== '-') {
        const ungapped = gappedToUngappedPosition(seq, i)
        expect(ungapped).toBeDefined()
        const backToGapped = ungappedToGappedPosition(seq, ungapped!)
        expect(backToGapped).toBe(i)
      }
    }
  })
})

describe('mapToRecord', () => {
  test('converts Map to Record', () => {
    const map = new Map<number, number>([
      [0, 5],
      [1, 10],
      [2, 15],
    ])
    const record = mapToRecord(map)
    expect(record[0]).toBe(5)
    expect(record[1]).toBe(10)
    expect(record[2]).toBe(15)
  })

  test('handles empty Map', () => {
    const map = new Map<number, number>()
    const record = mapToRecord(map)
    expect(Object.keys(record)).toHaveLength(0)
  })
})
