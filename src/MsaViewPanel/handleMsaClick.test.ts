import { describe, expect, test, vi } from 'vitest'

import stateModelFactory from './model'

const aliases: Record<string, string> = { chr1: '1' }

vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: () => session,
}))

const centerAtCalls: [number, string][] = []

const connectedView = (displayedRefName: string) => ({
  id: 'lgv1',
  type: 'LinearGenomeView',
  assemblyNames: ['hg38'],
  displayedRegions: [{ refName: displayedRefName, start: 0, end: 1000 }],
  centerAt: (coord: number, refName: string) => {
    centerAtCalls.push([coord, refName])
  },
  navTo: vi.fn(),
})

let session = {
  views: [connectedView('1')],
  hovered: undefined,
  assemblyManager: {
    get: () => ({
      initialized: true,
      getCanonicalRefName: (refName: string) => aliases[refName] ?? refName,
    }),
  },
}

function clickColumn({
  displayed,
  refName,
}: {
  displayed: string
  refName: string
}) {
  centerAtCalls.length = 0
  session = { ...session, views: [connectedView(displayed)] }
  const model = stateModelFactory().create({
    type: 'MsaView',
    id: 'msaview1',
    connectedViewId: 'lgv1',
    querySeqName: 'hg38.chr1',
    mafRegion: { refName, start: 500, end: 510, assemblyName: 'hg38' },
  })
  model.setMSA('>hg38.chr1\nACGTACGTAC')
  model.handleMsaClick(3)
  return centerAtCalls
}

describe('clicking an alignment column recenters the connected view', () => {
  test('on the name the view displays when the feature uses an alias', () => {
    expect(clickColumn({ displayed: '1', refName: 'chr1' })).toEqual([
      [503, '1'],
    ])
  })

  test('on the feature name when it is already a displayed region', () => {
    expect(clickColumn({ displayed: 'chr1', refName: 'chr1' })).toEqual([
      [503, 'chr1'],
    ])
  })

  test('on the feature name when no displayed region is the same chromosome', () => {
    expect(clickColumn({ displayed: '2', refName: 'chr1' })).toEqual([
      [503, 'chr1'],
    ])
  })
})
