// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { resolveQueryRowName, useQueryRowName } from './useQueryRowName'

const protein = 'MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFD'
const trimmed = `>aligned_query\n${protein.slice(5, 45)}\n>other\nWRONGWRONGWRONGWRONGWRONGWRONGWRONGWRONG\n`

describe('useQueryRowName', () => {
  test('carries the detected row and where it starts', () => {
    const { result } = renderHook(() => useQueryRowName(trimmed, protein))
    expect(result.current.querySeqName).toBe('aligned_query')
    expect(result.current.querySeqOffset).toBe(5)
  })

  // the offset was measured against the detected row; another row is a row the
  // user vouched for, and nothing here knows where in the protein it sits
  test('a row the user picks instead is taken at face value', () => {
    const { result } = renderHook(() => useQueryRowName(trimmed, protein))
    act(() => {
      result.current.setQuerySeqName('other')
    })
    expect(result.current.querySeqName).toBe('other')
    expect(result.current.querySeqOffset).toBe(0)
  })
})

// a pre-loaded dataset names its rows by a convention of its own, and the
// residues can be too diverged for detection to find the row that is right
// there
describe('resolveQueryRowName', () => {
  const names = ['ENST1_hg38', 'mm39', 'rn7']

  test('prefers the detected or picked row over any fallback', () => {
    expect(
      resolveQueryRowName({ querySeqName: 'mm39', names }, 'ENST1_hg38'),
    ).toBe('mm39')
  })

  test('falls back to a name the alignment actually carries', () => {
    expect(resolveQueryRowName({ querySeqName: '', names }, 'ENST1_hg38')).toBe(
      'ENST1_hg38',
    )
  })

  // the whole bug: the old panel launched with this name whether or not the
  // file had the row, and a name no row carries navigates nowhere
  test('answers nothing for a fallback the alignment does not carry', () => {
    expect(resolveQueryRowName({ querySeqName: '', names }, 'ENST9_hg38')).toBe(
      '',
    )
  })
})
