import { describe, expect, test } from 'vitest'

import { serializeKey } from './useFetch'

describe('serializeKey', () => {
  test('a key identifies the fetch', () => {
    expect(serializeKey('msa-list')).toBe(serializeKey('msa-list'))
    expect(serializeKey(['NM_1', 'hg38'])).not.toBe(
      serializeKey(['NM_1', 'mm39']),
    )
  })

  test('no key means do not fetch', () => {
    expect(serializeKey(null)).toBeNull()
    expect(serializeKey(undefined)).toBeNull()
    expect(serializeKey(false)).toBeNull()
    expect(serializeKey('')).not.toBeNull()
  })

  test('an array key with a piece still missing means do not fetch', () => {
    expect(serializeKey(['NM_1', undefined, 'feature-sequence'])).toBeNull()
  })

  // the trap this rule sets: a boolean IN a key reads as a missing piece, so a
  // `!!selected` where a string belonged disables the fetch and raises nothing
  test('a boolean in a key disables the fetch', () => {
    expect(serializeKey(['gene', false])).toBeNull()
    expect(serializeKey(['gene', true])).not.toBeNull()
  })
})
