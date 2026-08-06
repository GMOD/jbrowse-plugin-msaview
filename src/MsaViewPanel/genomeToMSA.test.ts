import { getSession } from '@jbrowse/core/util'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { genomeToMSA } from './genomeToMSA'

// Mock getSession
vi.mock('@jbrowse/core/util', () => ({
  getSession: vi.fn(),
}))

const mockGetSession = vi.mocked(getSession)

describe('genomeToMSA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns undefined when connectedView is not initialized', () => {
    mockGetSession.mockReturnValue({
      hovered: {
        hoverFeature: {},
        hoverPosition: { coord: 1005, refName: 'chr1' },
      },
    } as any)

    const model = {
      querySeqName: 'hg38.chr1',
      transcriptToMsaMap: undefined,
      mafRegion: {
        refName: 'chr1',
        start: 1000,
        end: 1010,
        assemblyName: 'hg38',
      },
      connectedView: { initialized: false },
      seqPosToVisibleCol: vi.fn(),
    } as any

    const result = genomeToMSA({ model })
    expect(result).toBeUndefined()
  })

  test('returns undefined when hovered is not valid', () => {
    mockGetSession.mockReturnValue({
      hovered: null,
    } as any)

    const model = {
      querySeqName: 'hg38.chr1',
      transcriptToMsaMap: undefined,
      mafRegion: {
        refName: 'chr1',
        start: 1000,
        end: 1010,
        assemblyName: 'hg38',
      },
      connectedView: { initialized: true },
      seqPosToVisibleCol: vi.fn(),
    } as any

    const result = genomeToMSA({ model })
    expect(result).toBeUndefined()
  })

  describe('mafRegion mapping', () => {
    test('returns visible column for valid hover within mafRegion', () => {
      mockGetSession.mockReturnValue({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr1' },
        },
      } as any)

      const mockSeqPosToVisibleCol = vi.fn().mockReturnValue(5)

      const model = {
        querySeqName: 'hg38.chr1',
        transcriptToMsaMap: undefined,
        mafRegion: {
          refName: 'chr1',
          start: 1000,
          end: 1010,
          assemblyName: 'hg38',
        },
        connectedView: {
          initialized: true,
          assemblyNames: ['hg38'],
        },
        seqPosToVisibleCol: mockSeqPosToVisibleCol,
      } as any

      const result = genomeToMSA({ model })

      // hover coord 1005 is 1-based, so the 0-based genome position is 1004,
      // which is ungapped position 4 of a region starting at 1000
      expect(mockSeqPosToVisibleCol).toHaveBeenCalledWith('hg38.chr1', 4)
      expect(result).toBe(5)
    })

    test('returns undefined when hover refName does not match mafRegion', () => {
      mockGetSession.mockReturnValue({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr2' },
        },
      } as any)

      const model = {
        querySeqName: 'hg38.chr1',
        transcriptToMsaMap: undefined,
        mafRegion: {
          refName: 'chr1',
          start: 1000,
          end: 1010,
          assemblyName: 'hg38',
        },
        connectedView: {
          initialized: true,
          assemblyNames: ['hg38'],
        },
        seqPosToVisibleCol: vi.fn(),
      } as any

      const result = genomeToMSA({ model })
      expect(result).toBeUndefined()
    })

    test('returns undefined when hover coord is before mafRegion start', () => {
      // 1-based coord 1000 is the 0-based base 999, one before the region
      mockGetSession.mockReturnValue({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1000, refName: 'chr1' },
        },
      } as any)

      const model = {
        querySeqName: 'hg38.chr1',
        transcriptToMsaMap: undefined,
        mafRegion: {
          refName: 'chr1',
          start: 1000,
          end: 1010,
          assemblyName: 'hg38',
        },
        connectedView: {
          initialized: true,
          assemblyNames: ['hg38'],
        },
        seqPosToVisibleCol: vi.fn(),
      } as any

      const result = genomeToMSA({ model })
      expect(result).toBeUndefined()
    })

    test('returns undefined when hover coord is at or after mafRegion end', () => {
      // 1-based coord 1011 is the 0-based base 1010, one past the region
      mockGetSession.mockReturnValue({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1011, refName: 'chr1' },
        },
      } as any)

      const model = {
        querySeqName: 'hg38.chr1',
        transcriptToMsaMap: undefined,
        mafRegion: {
          refName: 'chr1',
          start: 1000,
          end: 1010,
          assemblyName: 'hg38',
        },
        connectedView: {
          initialized: true,
          assemblyNames: ['hg38'],
        },
        seqPosToVisibleCol: vi.fn(),
      } as any

      const result = genomeToMSA({ model })
      expect(result).toBeUndefined()
    })

    test('returns undefined when assembly does not match', () => {
      mockGetSession.mockReturnValue({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr1' },
        },
      } as any)

      const model = {
        querySeqName: 'hg38.chr1',
        transcriptToMsaMap: undefined,
        mafRegion: {
          refName: 'chr1',
          start: 1000,
          end: 1010,
          assemblyName: 'hg38',
        },
        connectedView: {
          initialized: true,
          assemblyNames: ['mm39'], // Different assembly
        },
        seqPosToVisibleCol: vi.fn(),
      } as any

      const result = genomeToMSA({ model })
      expect(result).toBeUndefined()
    })
  })

  describe('transcriptToMsaMap mapping (original behavior)', () => {
    test('returns visible column using g2p mapping', () => {
      mockGetSession.mockReturnValue({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr1' },
        },
      } as any)

      const mockSeqPosToVisibleCol = vi.fn().mockReturnValue(10)

      const model = {
        querySeqName: 'QUERY',
        transcriptToMsaMap: {
          refName: 'chr1',
          // g2p is keyed by 0-based genome position, the hover coord is 1-based
          g2p: { 1004: 10 },
        },
        mafRegion: undefined,
        connectedView: { initialized: true },
        seqPosToVisibleCol: mockSeqPosToVisibleCol,
      } as any

      const result = genomeToMSA({ model })

      expect(mockSeqPosToVisibleCol).toHaveBeenCalledWith('QUERY', 10)
      expect(result).toBe(10)
    })

    test('returns undefined when the hover is on another refName', () => {
      // session.hovered is global, so a hover on an unrelated chromosome can
      // carry a coordinate that happens to be a g2p key
      mockGetSession.mockReturnValue({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr2' },
        },
      } as any)

      const mockSeqPosToVisibleCol = vi.fn()
      const model = {
        querySeqName: 'QUERY',
        transcriptToMsaMap: {
          refName: 'chr1',
          g2p: { 1004: 10 },
        },
        mafRegion: undefined,
        connectedView: { initialized: true },
        seqPosToVisibleCol: mockSeqPosToVisibleCol,
      } as any

      expect(genomeToMSA({ model })).toBeUndefined()
      expect(mockSeqPosToVisibleCol).not.toHaveBeenCalled()
    })

    test('returns undefined when g2p has no mapping for coord', () => {
      mockGetSession.mockReturnValue({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr1' },
        },
      } as any)

      const model = {
        querySeqName: 'QUERY',
        transcriptToMsaMap: {
          refName: 'chr1',
          g2p: { 1000: 0 }, // No entry for 1004
        },
        mafRegion: undefined,
        connectedView: { initialized: true },
        seqPosToVisibleCol: vi.fn(),
      } as any

      const result = genomeToMSA({ model })
      expect(result).toBeUndefined()
    })
  })

  test('returns undefined when neither mafRegion nor transcriptToMsaMap is set', () => {
    mockGetSession.mockReturnValue({
      hovered: {
        hoverFeature: {},
        hoverPosition: { coord: 1005, refName: 'chr1' },
      },
    } as any)

    const model = {
      querySeqName: 'QUERY',
      transcriptToMsaMap: undefined,
      mafRegion: undefined,
      connectedView: { initialized: true },
      seqPosToVisibleCol: vi.fn(),
    } as any

    const result = genomeToMSA({ model })
    expect(result).toBeUndefined()
  })
})
