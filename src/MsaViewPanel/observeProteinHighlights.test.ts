import { getSession } from '@jbrowse/core/util'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { observeProteinHighlights } from './afterCreateAutoruns'

import type { JBrowsePluginMsaViewModel } from './model'

// Mock only getSession; keep the rest of the util module real so the
// afterCreateAutoruns import graph still loads.
vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: vi.fn(),
}))

const mockGetSession = vi.mocked(getSession)

const CONNECTED = 'lgv-1'

interface Range {
  start: number
  end: number
}

/**
 * A model with an identity genome->protein->column mapping, so an asserted
 * column equals the genome coordinate that produced it and the test reads as
 * "these genome coords lit these columns".
 */
function makeModel({ highlightColumns }: { highlightColumns?: number[] } = {}) {
  const calls: (number[] | undefined)[] = []
  const model = {
    querySeqName: 'query',
    connectedViewId: CONNECTED,
    // g2p is indexed by genome coord; identity keeps the arithmetic out of the way
    transcriptToMsaMap: {
      g2p: Object.fromEntries([...Array(200).keys()].map(i => [i, i])),
    },
    highlightColumns,
    highlightedColumns: undefined as number[] | undefined,
    seqPosToGlobalCol: (_name: string, pos: number) => pos,
    globalColToVisibleCol: (col: number) => col,
    setHighlightedColumns: (cols?: number[]) => {
      calls.push(cols)
      model.highlightedColumns = cols
    },
  } as unknown as JBrowsePluginMsaViewModel & {
    highlightedColumns: number[] | undefined
  }
  return { model, calls }
}

/** publish highlight channels on a ProteinView structure in the session */
function session({
  hover,
  click,
  connectedViewId = CONNECTED,
}: {
  hover?: Range[]
  click?: Range[]
  connectedViewId?: string
}) {
  mockGetSession.mockReturnValue({
    views: [
      {
        type: 'ProteinView',
        id: 'pv-1',
        structures: [
          {
            connectedViewId,
            hoverGenomeHighlights: hover,
            clickGenomeHighlights: click,
          },
        ],
      },
    ],
  } as unknown as ReturnType<typeof getSession>)
}

function noProteinView() {
  mockGetSession.mockReturnValue({
    views: [{ type: 'LinearGenomeView', id: CONNECTED }],
  } as unknown as ReturnType<typeof getSession>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the hover channel', () => {
  test('a hovered residue lights its column', () => {
    const { model, calls } = makeModel()
    const run = observeProteinHighlights(model)

    session({ hover: [{ start: 10, end: 13 }] })
    run()
    expect(calls).toEqual([[10, 11, 12]])
  })

  test('releasing the hover clears the highlight', () => {
    const { model, calls } = makeModel()
    const run = observeProteinHighlights(model)

    session({ hover: [{ start: 10, end: 12 }] })
    run()
    session({ hover: [] })
    run()
    expect(calls).toEqual([[10, 11], undefined])
  })
})

describe('the click channel', () => {
  test('a clicked domain lights its columns', () => {
    const { model, calls } = makeModel()
    const run = observeProteinHighlights(model)

    session({ click: [{ start: 30, end: 34 }] })
    run()
    expect(calls).toEqual([[30, 31, 32, 33]])
  })

  test('a hover wins over the standing click selection', () => {
    const { model, calls } = makeModel()
    const run = observeProteinHighlights(model)

    session({ click: [{ start: 30, end: 32 }], hover: [{ start: 5, end: 6 }] })
    run()
    expect(calls).toEqual([[5]])
  })

  test('a selection changed during a hover is picked up when the hover releases', () => {
    const { model, calls } = makeModel()
    const run = observeProteinHighlights(model)

    // the reaction skips the click channel while hovering, so it is not watching
    // it; this pins that releasing the hover still lands on the CURRENT selection
    // rather than on the one that was standing when the hover began
    session({ click: [{ start: 30, end: 32 }], hover: [{ start: 5, end: 6 }] })
    run()
    session({ click: [{ start: 60, end: 62 }], hover: [{ start: 5, end: 6 }] })
    run()
    session({ click: [{ start: 60, end: 62 }] })
    run()
    expect(calls).toEqual([[5], [60, 61]])
  })

  test('releasing the hover falls back to the click selection, not to nothing', () => {
    const { model, calls } = makeModel()
    const run = observeProteinHighlights(model)

    // this is the whole point of the two channels: previewing a residue must not
    // destroy the domain the user selected
    session({ click: [{ start: 30, end: 32 }] })
    run()
    session({ click: [{ start: 30, end: 32 }], hover: [{ start: 5, end: 6 }] })
    run()
    session({ click: [{ start: 30, end: 32 }] })
    run()
    expect(calls).toEqual([[30, 31], [5], [30, 31]])
  })
})

describe('the declarative highlightColumns seed', () => {
  // the regression these guard: the observer used to compute zero columns on its
  // first run and wipe the seed MSAModelF.afterCreate had just applied, which is
  // what made the BRAF/TP53 links open with no V600/R248 column lit
  test('a first run with no protein view leaves the seed alone', () => {
    const { model, calls } = makeModel({ highlightColumns: [77] })
    const run = observeProteinHighlights(model)

    noProteinView()
    run()
    expect(calls).toEqual([[77]])
    expect(model.highlightedColumns).toEqual([77])
  })

  test('repeated runs never clobber the seed', () => {
    const { model } = makeModel({ highlightColumns: [77] })
    const run = observeProteinHighlights(model)

    noProteinView()
    run()
    run()
    run()
    expect(model.highlightedColumns).toEqual([77])
  })

  test('a hover overrides the seed, and releasing it restores the seed', () => {
    const { model, calls } = makeModel({ highlightColumns: [77] })
    const run = observeProteinHighlights(model)

    session({ hover: [{ start: 1, end: 2 }] })
    run()
    session({ hover: [] })
    run()
    expect(calls).toEqual([[1], [77]])
  })

  test('a click selection outranks the seed', () => {
    const { model, calls } = makeModel({ highlightColumns: [77] })
    const run = observeProteinHighlights(model)

    session({ click: [{ start: 40, end: 42 }] })
    run()
    expect(calls).toEqual([[40, 41]])
  })

  test('with no seed and no protein highlight, nothing is written at all', () => {
    const { model, calls } = makeModel()
    const run = observeProteinHighlights(model)

    noProteinView()
    run()
    run()
    expect(calls).toEqual([])
  })
})

describe('scope and redundant writes', () => {
  test('a structure connected to a different view is ignored', () => {
    const { model, calls } = makeModel()
    const run = observeProteinHighlights(model)

    session({
      hover: [{ start: 10, end: 12 }],
      connectedViewId: 'some-other-view',
    })
    run()
    expect(calls).toEqual([])
  })

  test('an unchanged highlight is not rewritten, so the overlay does not redraw', () => {
    const { model, calls } = makeModel()
    const run = observeProteinHighlights(model)

    session({ hover: [{ start: 10, end: 12 }] })
    run()
    run()
    run()
    expect(calls).toEqual([[10, 11]])
  })

  test('a genome coord with no protein position contributes no column', () => {
    const { model, calls } = makeModel()
    const run = observeProteinHighlights(model)

    // 500 is past the end of the identity g2p map built above
    session({ hover: [{ start: 500, end: 503 }] })
    run()
    expect(calls).toEqual([])
  })

  test('nothing happens until the view is connected and mapped', () => {
    const { calls } = makeModel()
    const bare = {
      connectedViewId: undefined,
      transcriptToMsaMap: undefined,
    } as unknown as JBrowsePluginMsaViewModel
    const run = observeProteinHighlights(bare)

    session({ hover: [{ start: 10, end: 12 }] })
    run()
    expect(calls).toEqual([])
  })
})
