import { afterAll, afterEach, describe, expect, test, vi } from 'vitest'

import {
  MAX_CODING_BASES,
  proteinPositionsInRange,
  transcriptMap,
} from './transcriptMap'

import type { TranscriptMap } from './transcriptMap'

function cds(start: number, end: number, extra: Record<string, unknown> = {}) {
  return { type: 'CDS', start, end, ...extra }
}

function mapped(feature: unknown): TranscriptMap {
  const map = transcriptMap(feature)
  if (!map) {
    throw new Error('expected the transcript to map')
  }
  return map
}

function transcript(extra: Record<string, unknown> = {}) {
  return {
    refName: 'chr1',
    strand: 1,
    start: 100,
    end: 200,
    subfeatures: [cds(100, 106), { type: 'exon', start: 90, end: 106 }],
    ...extra,
  }
}

describe('transcriptMap on a malformed transcript', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  afterEach(() => {
    warn.mockClear()
  })
  afterAll(() => {
    warn.mockRestore()
  })

  test.each([
    ['nothing', null, /not a feature/],
    ['no refName', transcript({ refName: undefined }), /no refName/],
    ['no strand', transcript({ strand: undefined }), /strand is undefined/],
    ['a GFF strand string', transcript({ strand: '+' }), /strand is "\+"/],
    ['no subfeatures', transcript({ subfeatures: undefined }), /no CDS/],
    [
      'only exons',
      transcript({ subfeatures: [{ type: 'exon', start: 1, end: 9 }] }),
      /no CDS/,
    ],
    ['a zero-length CDS', transcript({ subfeatures: [cds(5, 5)] }), /no CDS/],
    [
      'string coordinates',
      transcript({ subfeatures: [{ type: 'CDS', start: '1', end: '9' }] }),
      /no CDS/,
    ],
    [
      'a CDS spanning a chromosome',
      transcript({ subfeatures: [cds(0, MAX_CODING_BASES + 1)] }),
      /more than any real transcript/,
    ],
  ])('%s maps to nothing and says why', (_, feature, reason) => {
    expect(transcriptMap(feature)).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(feature ? 1 : 0)
    if (feature) {
      expect(String(warn.mock.calls[0]![0])).toMatch(reason)
    }
  })

  test('says why once per feature, however often the getter recomputes', () => {
    const feature = transcript({ strand: 0 })
    transcriptMap(feature)
    transcriptMap(feature)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('a CDS that is not a multiple of 3 still maps its whole codons', () => {
    const map = transcriptMap(transcript({ subfeatures: [cds(100, 107)] }))
    expect(map?.g2p[100]).toBe(0)
    expect(map?.g2p[105]).toBe(1)
    expect(map?.g2p[106]).toBe(2)
    expect(warn).not.toHaveBeenCalled()
  })

  test.each([
    ['1', 1],
    [2, 2],
    ['.', 0],
    [7, 0],
    [null, 0],
  ])('a phase of %j reads as %i', (phase, expected) => {
    const map = transcriptMap(
      transcript({ subfeatures: [cds(100, 109, { phase })] }),
    )
    expect(map?.g2p[100 + expected]).toBe(expected ? 1 : 0)
  })

  test('the malformed CDS rows are dropped and the well-formed ones kept', () => {
    const map = transcriptMap(
      transcript({
        subfeatures: [cds(100, 103), { type: 'CDS', start: 'x', end: 5 }],
      }),
    )
    expect(map?.codingPositions).toEqual([100, 101, 102])
  })
})

describe('proteinPositionsInRange', () => {
  const map = mapped(
    transcript({
      subfeatures: [cds(0, 3), cds(10_000, 10_003), cds(20_000, 20_003)],
    }),
  )

  test('a range across the introns yields each codon once', () => {
    expect([...proteinPositionsInRange(map, 0, 20_003)]).toEqual([0, 1, 2])
  })

  test('a range inside an intron yields nothing', () => {
    expect(proteinPositionsInRange(map, 5, 9_999).size).toBe(0)
  })

  test('the range is half-open', () => {
    expect([...proteinPositionsInRange(map, 10_002, 20_000)]).toEqual([1])
  })

  test('on the reverse strand the positions still come from g2p', () => {
    const reverse = mapped(
      transcript({ strand: -1, subfeatures: [cds(0, 3), cds(10_000, 10_003)] }),
    )
    expect([...proteinPositionsInRange(reverse, 0, 3)]).toEqual([1])
    expect([...proteinPositionsInRange(reverse, 10_000, 10_003)]).toEqual([0])
  })
})
