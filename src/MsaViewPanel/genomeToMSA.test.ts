import { getSession } from '@jbrowse/core/util'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { genomeToMSA } from './genomeToMSA'

// Mock getSession
vi.mock('@jbrowse/core/util', () => ({
  getSession: vi.fn(),
}))

const mockGetSession = vi.mocked(getSession)

// What the assembly calls each chromosome. Empty means every name is already
// canonical, which is the config where the raw comparison this replaced
// happened to work.
let aliases: Record<string, string> = {}

function mockSession(session: { hovered: unknown }) {
  mockGetSession.mockReturnValue({
    assemblyManager: {
      get: () => ({
        getCanonicalRefName: (refName: string) => aliases[refName] ?? refName,
      }),
    },
    ...session,
  } as any)
}

describe('genomeToMSA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aliases = {}
  })

  test('returns undefined when connectedView is not initialized', () => {
    mockSession({
      hovered: {
        hoverFeature: {},
        hoverPosition: { coord: 1005, refName: 'chr1' },
      },
    } as any)

    const model = {
      querySeqName: 'hg38.chr1',
      rows: [['hg38.chr1', 'ACGTACGTAC']],
      transcriptToMsaMap: undefined,
      mafRegion: {
        refName: 'chr1',
        start: 1000,
        end: 1010,
        assemblyName: 'hg38',
      },
      connectedView: { initialized: false, assemblyNames: ['hg38'] },
      seqPosToVisibleCol: vi.fn(),
    } as any

    const result = genomeToMSA({ model })
    expect(result).toBeUndefined()
  })

  test('returns undefined when hovered is not valid', () => {
    mockSession({
      hovered: null,
    } as any)

    const model = {
      querySeqName: 'hg38.chr1',
      rows: [['hg38.chr1', 'ACGTACGTAC']],
      transcriptToMsaMap: undefined,
      mafRegion: {
        refName: 'chr1',
        start: 1000,
        end: 1010,
        assemblyName: 'hg38',
      },
      connectedView: { initialized: true, assemblyNames: ['hg38'] },
      seqPosToVisibleCol: vi.fn(),
    } as any

    const result = genomeToMSA({ model })
    expect(result).toBeUndefined()
  })

  describe('mafRegion mapping', () => {
    test('returns visible column for valid hover within mafRegion', () => {
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr1' },
        },
      } as any)

      const mockSeqPosToVisibleCol = vi.fn().mockReturnValue(5)

      const model = {
        querySeqName: 'hg38.chr1',
        rows: [['hg38.chr1', 'ACGTACGTAC']],
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
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr2' },
        },
      } as any)

      const model = {
        querySeqName: 'hg38.chr1',
        rows: [['hg38.chr1', 'ACGTACGTAC']],
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
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1000, refName: 'chr1' },
        },
      } as any)

      const model = {
        querySeqName: 'hg38.chr1',
        rows: [['hg38.chr1', 'ACGTACGTAC']],
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
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1011, refName: 'chr1' },
        },
      } as any)

      const model = {
        querySeqName: 'hg38.chr1',
        rows: [['hg38.chr1', 'ACGTACGTAC']],
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
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr1' },
        },
      } as any)

      const model = {
        querySeqName: 'hg38.chr1',
        rows: [['hg38.chr1', 'ACGTACGTAC']],
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
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr1' },
        },
      } as any)

      const mockSeqPosToVisibleCol = vi.fn().mockReturnValue(10)

      const model = {
        querySeqName: 'QUERY',
        querySeqOffset: 0,
        rows: [['QUERY', 'MKVLTAEEK']],
        transcriptToMsaMap: {
          refName: 'chr1',
          // g2p is keyed by 0-based genome position, the hover coord is 1-based
          g2p: { 1004: 10 },
        },
        mafRegion: undefined,
        connectedView: { initialized: true, assemblyNames: ['hg38'] },
        seqPosToVisibleCol: mockSeqPosToVisibleCol,
        visibleColToSeqPos: (_name: string, col: number) => col,
      } as any

      const result = genomeToMSA({ model })

      expect(mockSeqPosToVisibleCol).toHaveBeenCalledWith('QUERY', 10)
      expect(result).toBe(10)
    })

    test('returns undefined when the hover is on another refName', () => {
      // session.hovered is global, so a hover on an unrelated chromosome can
      // carry a coordinate that happens to be a g2p key
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr2' },
        },
      } as any)

      const mockSeqPosToVisibleCol = vi.fn()
      const model = {
        querySeqName: 'QUERY',
        rows: [['QUERY', 'MKVLTAEEK']],
        transcriptToMsaMap: {
          refName: 'chr1',
          g2p: { 1004: 10 },
        },
        mafRegion: undefined,
        connectedView: { initialized: true, assemblyNames: ['hg38'] },
        seqPosToVisibleCol: mockSeqPosToVisibleCol,
      } as any

      expect(genomeToMSA({ model })).toBeUndefined()
      expect(mockSeqPosToVisibleCol).not.toHaveBeenCalled()
    })

    // a pasted alignment often carries only the region BLAST aligned, and
    // querySeqOffset says how much of the protein comes before it
    test('shifts a trimmed query row by querySeqOffset', () => {
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr1' },
        },
      } as any)

      const seqPosToVisibleCol = vi.fn((_name: string, pos: number) => pos)
      const model = {
        querySeqName: 'QUERY',
        querySeqOffset: 4,
        rows: [['QUERY', 'MKVLTAEEK']],
        transcriptToMsaMap: { refName: 'chr1', g2p: { 1004: 10 } },
        mafRegion: undefined,
        connectedView: { initialized: true, assemblyNames: ['hg38'] },
        seqPosToVisibleCol,
        visibleColToSeqPos: (_name: string, col: number) => col,
      } as any

      expect(genomeToMSA({ model })).toBe(6)
      expect(seqPosToVisibleCol).toHaveBeenCalledWith('QUERY', 6)
    })

    test('maps nothing for a residue before the trimmed row starts', () => {
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr1' },
        },
      } as any)

      const seqPosToVisibleCol = vi.fn((_name: string, pos: number) => pos)
      const model = {
        querySeqName: 'QUERY',
        querySeqOffset: 20,
        rows: [['QUERY', 'MKVLTAEEK']],
        transcriptToMsaMap: { refName: 'chr1', g2p: { 1004: 10 } },
        mafRegion: undefined,
        connectedView: { initialized: true, assemblyNames: ['hg38'] },
        seqPosToVisibleCol,
        visibleColToSeqPos: (_name: string, col: number) => col,
      } as any

      expect(genomeToMSA({ model })).toBeUndefined()
      expect(seqPosToVisibleCol).not.toHaveBeenCalled()
    })

    // react-msaview answers one column past the end for a residue the row does
    // not have, which would light the last column for everything beyond it
    test('maps nothing for a residue the row stops short of', () => {
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr1' },
        },
      } as any)

      const model = {
        querySeqName: 'QUERY',
        querySeqOffset: 0,
        rows: [['QUERY', 'MKV']],
        transcriptToMsaMap: { refName: 'chr1', g2p: { 1004: 10 } },
        mafRegion: undefined,
        connectedView: { initialized: true, assemblyNames: ['hg38'] },
        seqPosToVisibleCol: () => 3,
        visibleColToSeqPos: () => undefined,
      } as any

      expect(genomeToMSA({ model })).toBeUndefined()
    })

    test('returns undefined when g2p has no mapping for coord', () => {
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: 'chr1' },
        },
      } as any)

      const model = {
        querySeqName: 'QUERY',
        rows: [['QUERY', 'MKVLTAEEK']],
        transcriptToMsaMap: {
          refName: 'chr1',
          g2p: { 1000: 0 }, // No entry for 1004
        },
        mafRegion: undefined,
        connectedView: { initialized: true, assemblyNames: ['hg38'] },
        seqPosToVisibleCol: vi.fn(),
      } as any

      const result = genomeToMSA({ model })
      expect(result).toBeUndefined()
    })
  })

  test('returns undefined when neither mafRegion nor transcriptToMsaMap is set', () => {
    mockSession({
      hovered: {
        hoverFeature: {},
        hoverPosition: { coord: 1005, refName: 'chr1' },
      },
    } as any)

    const model = {
      querySeqName: 'QUERY',
      rows: [['QUERY', 'MKVLTAEEK']],
      transcriptToMsaMap: undefined,
      mafRegion: undefined,
      connectedView: { initialized: true, assemblyNames: ['hg38'] },
      seqPosToVisibleCol: vi.fn(),
    } as any

    const result = genomeToMSA({ model })
    expect(result).toBeUndefined()
  })

  // seqPosToVisibleCol answers 0 for a row name it does not know, so without a
  // guard an alignment whose query row is missing -- the default 'QUERY' on an
  // uploaded file, or the empty name the manual panel leaves when it matches
  // nothing -- lights column 0 on every genome hover
  test('returns undefined when querySeqName names no row here', () => {
    mockSession({
      hovered: {
        hoverFeature: {},
        hoverPosition: { coord: 1005, refName: 'chr1' },
      },
    } as any)

    const seqPosToVisibleCol = vi.fn(() => 0)
    const model = {
      querySeqName: 'QUERY',
      rows: [['some_other_row', 'MKVLTAEEK']],
      transcriptToMsaMap: { refName: 'chr1', g2p: { 1004: 3 } },
      mafRegion: undefined,
      connectedView: { initialized: true, assemblyNames: ['hg38'] },
      seqPosToVisibleCol,
    } as any

    expect(genomeToMSA({ model })).toBeUndefined()
    expect(seqPosToVisibleCol).not.toHaveBeenCalled()
  })

  // A hover names the chromosome the assembly's way and the transcript names it
  // the annotation file's way, so on GENCODE-on-hg38 -- jbrowse.org's own
  // config -- the two are '1' and 'chr1' and pointing at a codon lit nothing.
  describe('a config whose assembly and annotation spell the refName apart', () => {
    beforeEach(() => {
      aliases = { chr1: '1', chr2: '2' }
    })

    test('maps a hover named 1 onto a transcript named chr1', () => {
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: '1' },
        },
      } as any)

      const seqPosToVisibleCol = vi.fn().mockReturnValue(10)
      const model = {
        querySeqName: 'QUERY',
        querySeqOffset: 0,
        rows: [['QUERY', 'MKVLTAEEK']],
        transcriptToMsaMap: { refName: 'chr1', g2p: { 1004: 10 } },
        mafRegion: undefined,
        connectedView: { initialized: true, assemblyNames: ['hg38'] },
        seqPosToVisibleCol,
        visibleColToSeqPos: (_name: string, col: number) => col,
      } as any

      expect(genomeToMSA({ model })).toBe(10)
      expect(seqPosToVisibleCol).toHaveBeenCalledWith('QUERY', 10)
    })

    // the gate still has to reject another chromosome, which is the whole
    // reason it is there
    test('still rejects a hover on another chromosome', () => {
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: '2' },
        },
      } as any)

      const seqPosToVisibleCol = vi.fn()
      const model = {
        querySeqName: 'QUERY',
        rows: [['QUERY', 'MKVLTAEEK']],
        transcriptToMsaMap: { refName: 'chr1', g2p: { 1004: 10 } },
        mafRegion: undefined,
        connectedView: { initialized: true, assemblyNames: ['hg38'] },
        seqPosToVisibleCol,
      } as any

      expect(genomeToMSA({ model })).toBeUndefined()
      expect(seqPosToVisibleCol).not.toHaveBeenCalled()
    })

    test('maps a hover named 1 into a mafRegion named chr1', () => {
      mockSession({
        hovered: {
          hoverFeature: {},
          hoverPosition: { coord: 1005, refName: '1' },
        },
      } as any)

      const seqPosToVisibleCol = vi.fn().mockReturnValue(5)
      const model = {
        querySeqName: 'hg38.chr1',
        rows: [['hg38.chr1', 'ACGTACGTAC']],
        transcriptToMsaMap: undefined,
        mafRegion: {
          refName: 'chr1',
          start: 1000,
          end: 1010,
          assemblyName: 'hg38',
        },
        connectedView: { initialized: true, assemblyNames: ['hg38'] },
        seqPosToVisibleCol,
      } as any

      expect(genomeToMSA({ model })).toBe(5)
      expect(seqPosToVisibleCol).toHaveBeenCalledWith('hg38.chr1', 4)
    })
  })
})
