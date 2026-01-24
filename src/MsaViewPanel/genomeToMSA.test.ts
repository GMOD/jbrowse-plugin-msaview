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

      // coord 1005 - start 1000 = ungapped position 5
      expect(mockSeqPosToVisibleCol).toHaveBeenCalledWith('hg38.chr1', 5)
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
      mockGetSession.mockReturnValue({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 999, refName: 'chr1' },
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
      mockGetSession.mockReturnValue({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1010, refName: 'chr1' },
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
          g2p: { 1005: 10 },
        },
        mafRegion: undefined,
        connectedView: { initialized: true },
        seqPosToVisibleCol: mockSeqPosToVisibleCol,
      } as any

      const result = genomeToMSA({ model })

      expect(mockSeqPosToVisibleCol).toHaveBeenCalledWith('QUERY', 10)
      expect(result).toBe(10)
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
          g2p: { 1000: 0 }, // No entry for 1005
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
