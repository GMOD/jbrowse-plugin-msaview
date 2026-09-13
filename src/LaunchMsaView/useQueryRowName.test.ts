// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { useQueryRowName } from './useQueryRowName'

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
