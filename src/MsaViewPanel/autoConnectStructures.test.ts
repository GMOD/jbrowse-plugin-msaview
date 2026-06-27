import { getSession } from '@jbrowse/core/util'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { autoConnectStructures } from './afterCreateAutoruns'

import type { JBrowsePluginMsaViewModel } from './model'
import type { ProteinView } from './structureConnection'

// Integration coverage for the autorun itself — the structure-matching matrix
// lives in structureConnection.test.ts (structureMatchesMsa). Here we check the
// autorun wires a match through to connectToStructure and respects its guards.

// Mock only getSession; keep the rest of the util module real so the
// afterCreateAutoruns import graph still loads.
vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: vi.fn(),
}))

const mockGetSession = vi.mocked(getSession)

function makeModel(opts: { connectedViewId?: string; uniprotId?: string }) {
  const connected: { proteinViewId: string; structureIdx: number }[] = []
  const model = {
    connectedViewId: opts.connectedViewId,
    uniprotId: opts.uniprotId,
    rows: [['hg38', 'MKATEST']],
    connectedStructures: connected,
    connectToStructure: (proteinViewId: string, structureIdx: number) => {
      connected.push({ proteinViewId, structureIdx })
    },
  } as unknown as JBrowsePluginMsaViewModel
  return { model, connected }
}

function withStructure(structure: {
  connectedViewId?: string
  uniprotId?: string
}) {
  const view: ProteinView = {
    type: 'ProteinView',
    id: 'pv1',
    structures: [{ ...structure, structureSequences: ['MKATEST'] }],
  }
  mockGetSession.mockReturnValue({
    views: [view],
  } as unknown as ReturnType<typeof getSession>)
}

describe('autoConnectStructures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('connects a matching structure (genome-view link, no UniProt id)', () => {
    const { model, connected } = makeModel({ connectedViewId: 'lgv-TP53' })
    withStructure({ connectedViewId: 'lgv-TP53' })
    autoConnectStructures(model)
    expect(connected).toEqual([{ proteinViewId: 'pv1', structureIdx: 0 }])
  })

  test('does not connect a non-matching structure', () => {
    const { model, connected } = makeModel({ connectedViewId: 'lgv-TP53' })
    withStructure({ connectedViewId: 'lgv-OTHER' })
    autoConnectStructures(model)
    expect(connected).toEqual([])
  })

  test('does not connect before the alignment has loaded (no rows)', () => {
    const { model, connected } = makeModel({ connectedViewId: 'lgv-TP53' })
    ;(model as unknown as { rows: unknown[] }).rows = []
    withStructure({ connectedViewId: 'lgv-TP53' })
    autoConnectStructures(model)
    expect(connected).toEqual([])
  })
})
