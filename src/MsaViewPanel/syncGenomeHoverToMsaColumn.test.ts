import { getSession } from '@jbrowse/core/util'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { syncGenomeHoverToMsaColumn } from './afterCreateAutoruns'

import type { JBrowsePluginMsaViewModel } from './model'

// Mock only getSession; keep the rest of the util module real so the
// afterCreateAutoruns import graph still loads.
vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: vi.fn(),
}))

const mockGetSession = vi.mocked(getSession)

const mafRegion = {
  refName: 'chr1',
  start: 1000,
  end: 1010,
  assemblyName: 'hg38',
}

// A model wired through the real genomeToMSA path: a connected genome view
// over a maf region, with seqPosToVisibleCol as identity so the asserted
// column equals the ungapped offset into the region.
function makeModel() {
  const calls: (number | undefined)[] = []
  const model = {
    querySeqName: 'hg38.chr1',
    transcriptToMsaMap: undefined,
    mafRegion,
    connectedView: { initialized: true, assemblyNames: ['hg38'] },
    seqPosToVisibleCol: (_name: string, pos: number) => pos,
    setMousePos: (col?: number) => {
      calls.push(col)
    },
  } as unknown as JBrowsePluginMsaViewModel
  return { model, calls }
}

function hoverGenome(coord: number) {
  mockGetSession.mockReturnValue({
    hovered: { hoverFeature: {}, hoverPosition: { coord, refName: 'chr1' } },
  } as unknown as ReturnType<typeof getSession>)
}

function clearGenomeHover() {
  mockGetSession.mockReturnValue({
    hovered: null,
  } as unknown as ReturnType<typeof getSession>)
}

describe('syncGenomeHoverToMsaColumn (real genomeToMSA mapping)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('genome hover at coord 1005 highlights MSA column 4', () => {
    const { model, calls } = makeModel()
    const run = syncGenomeHoverToMsaColumn(model)

    // the hover coord is 1-based, so 1005 is the 0-based base 1004, i.e.
    // ungapped offset 4 into a region starting at 1000
    hoverGenome(1005)
    run()
    expect(calls).toEqual([4])
  })

  test('moving the genome hover moves the highlighted column', () => {
    const { model, calls } = makeModel()
    const run = syncGenomeHoverToMsaColumn(model)

    hoverGenome(1002)
    run()
    hoverGenome(1007)
    run()
    expect(calls).toEqual([1, 6])
  })

  test('leaving the genome clears the column it set', () => {
    const { model, calls } = makeModel()
    const run = syncGenomeHoverToMsaColumn(model)

    hoverGenome(1004)
    run()
    clearGenomeHover()
    run()
    expect(calls).toEqual([3, undefined])
  })

  test('a hover outside the maf region clears a previously-set column once', () => {
    const { model, calls } = makeModel()
    const run = syncGenomeHoverToMsaColumn(model)

    hoverGenome(1004)
    run()
    hoverGenome(5000) // outside [1000,1010) -> genomeToMSA returns undefined
    run()
    run()
    expect(calls).toEqual([3, undefined])
  })

  test('never touches mouseCol when the genome never provides a column, so a direct MSA hover survives unrelated session hovers', () => {
    const { model, calls } = makeModel()
    const run = syncGenomeHoverToMsaColumn(model)

    clearGenomeHover()
    run()
    hoverGenome(9999) // unrelated/out-of-range hover elsewhere
    run()
    expect(calls).toEqual([])
  })
})
