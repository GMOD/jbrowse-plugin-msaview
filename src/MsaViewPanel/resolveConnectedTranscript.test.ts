import { observable } from 'mobx'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import stateModelFactory from './model'

import type { Feature } from '@jbrowse/core/util'

const rpcCall =
  vi.fn<
    (
      sessionId: string,
      name: string,
      args: { adapterConfig: string; regions: unknown },
    ) => Promise<Feature[]>
  >()
const lgv = {
  id: 'lgv1',
  initialized: true,
  pendingLaunch: undefined as unknown,
  error: undefined as unknown,
  assemblyNames: ['hg38'],
  tracks: [] as { type: string; adapter: string }[],
  displayedRegions: [
    { assemblyName: 'hg38', refName: 'chr17', start: 0, end: 83_257_441 },
  ],
  dynamicBlocks: {
    contentBlocks: [] as {
      assemblyName: string
      refName: string
      start: number
      end: number
    }[],
  },
}

const sessionViews = observable.array([lgv], { deep: false })

vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: () => ({
    views: sessionViews,
    hovered: undefined,
    rpcManager: { call: rpcCall },
  }),
}))
vi.mock('@jbrowse/core/configuration', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getConf: (track: { adapter: string }) => track.adapter,
}))
vi.mock('../LaunchMsaView/components/fetchSeq', () => ({
  fetchSeq: vi.fn(async () => ({ seq: 'ATGAAAGTG' })),
}))
vi.mock('@jbrowse/core/util/translateTranscript', () => ({
  translateTranscript: vi.fn(() => ({ protein: 'MKV', cds: [] })),
}))
vi.mock('./doLaunchBlast', () => ({
  doLaunchBlast: vi.fn(() => new Promise(() => {})),
}))
vi.mock('./msaDataStore', () => ({
  cleanupOldData: vi.fn(async () => {}),
  generateDataStoreId: vi.fn(),
  retrieveMsaData: vi.fn(),
  storeMsaData: vi.fn(),
}))

function transcript(id: string, extra: Record<string, unknown> = {}) {
  const json = {
    uniqueId: id,
    id,
    refName: 'chr17',
    start: 0,
    end: 9,
    ...extra,
  }
  return {
    id: () => id,
    get: (key: string) => (key === 'id' || key === 'name' ? id : undefined),
    toJSON: () => json,
  } as unknown as Feature
}

const settle = () => new Promise(res => setTimeout(res, 0))

function connectedView(
  { connectedViewId }: { connectedViewId?: string } = {
    connectedViewId: 'lgv1',
  },
) {
  return stateModelFactory().create({
    type: 'MsaView',
    id: 'msa1',
    connectedViewId,
    connectedTranscript: 'NM_000546.6',
    blastParams: {
      searchProgram: 'blastp',
      blastDatabase: 'uniprotkb_swissprot',
      msaAlgorithm: 'clustalo',
    },
  })
}

function linkedAlignment() {
  return stateModelFactory().create({
    type: 'MsaView',
    id: 'msa1',
    connectedViewId: 'lgv1',
    connectedTranscript: 'NM_000546.6',
    querySeqName: 'QUERY',
    data: { msa: '>QUERY\nMKV\n>mouse\nMKI\n' },
  })
}

beforeEach(() => {
  rpcCall.mockReset()
  lgv.initialized = true
  lgv.pendingLaunch = undefined
  lgv.error = undefined
  lgv.tracks = [{ type: 'FeatureTrack', adapter: 'genes' }]
  lgv.dynamicBlocks.contentBlocks = []
  sessionViews.replace([lgv])
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('a lookup that misses', () => {
  test('reports the miss without leaving its progress up', async () => {
    rpcCall.mockResolvedValue([])
    const model = connectedView()
    await settle()

    expect(model.error).toBeInstanceOf(Error)
    expect(model.progress).toBe('')
  })

  test('Retry looks again', async () => {
    rpcCall.mockResolvedValue([])
    const model = connectedView()
    await settle()
    const calls = rpcCall.mock.calls.length

    rpcCall.mockResolvedValue([transcript('NM_000546.6')])
    model.retryLaunch()
    await settle()

    expect(rpcCall.mock.calls.length).toBeGreaterThan(calls)
    expect(model.connectedFeature).toMatchObject({ id: 'NM_000546.6' })
    expect(model.blastParams?.proteinSequence).toBe('MKV')
  })
})

describe('a lookup that misses beside an alignment in hand', () => {
  test('is a notice, and the alignment stays', async () => {
    rpcCall.mockResolvedValue([])
    const model = linkedAlignment()
    await settle()

    expect(model.error).toBeUndefined()
    expect(model.dataInitialized).toBe(true)
    expect(model.showLoading).toBe(false)
    expect(model.notices).toEqual([
      expect.stringMatching(/Transcript "NM_000546.6" was not found/),
    ])
  })

  test('is still loading while the lookup runs', async () => {
    rpcCall.mockReturnValue(new Promise(() => {}))
    const model = linkedAlignment()
    await settle()

    expect(model.showLoading).toBe(true)
    expect(model.notices).toEqual([])
  })

  test('a lookup that lands links the alignment', async () => {
    rpcCall.mockResolvedValue([
      transcript('NM_000546.6', {
        strand: 1,
        subfeatures: [{ type: 'CDS', start: 0, end: 9, phase: 0 }],
      }),
    ])
    const model = linkedAlignment()
    await settle()

    expect(model.notices).toEqual([])
    expect(model.showLoading).toBe(false)
    expect(model.transcriptToMsaMap?.refName).toBe('chr17')
  })

  test('a transcript that lands but does not map says why', async () => {
    rpcCall.mockResolvedValue([transcript('NM_000546.6')])
    const model = linkedAlignment()
    await settle()

    expect(model.notices).toEqual([
      expect.stringMatching(
        /linked transcript is not mapped to the genome: its strand is undefined/,
      ),
    ])
    expect(model.transcriptToMsaMap).toBeUndefined()
  })
})

describe('a lookup that cannot start', () => {
  test.each([
    ['no connectedViewId', undefined, /needs a connectedViewId/],
    ['a view id naming no view', 'lgv9', /No view with id "lgv9" is open/],
  ])(
    'ends a waiting launch with an error naming %s',
    async (_, viewId, message) => {
      const model = connectedView({ connectedViewId: viewId })
      await settle()

      expect(String(model.error)).toMatch(message)
      expect(model.showLoading).toBe(false)
      expect(model.notices).toEqual([])
      expect(rpcCall).not.toHaveBeenCalled()
    },
  )

  test('a genome view that arrives after the launch clears the error and looks', async () => {
    sessionViews.replace([])
    rpcCall.mockReturnValue(new Promise(() => {}))
    const model = connectedView()
    await settle()
    expect(String(model.error)).toMatch(/No view with id "lgv1"/)

    sessionViews.replace([lgv])
    await settle()

    expect(model.error).toBeUndefined()
    expect(model.connectionError).toBeUndefined()
    expect(model.showLoading).toBe(true)
    expect(rpcCall).toHaveBeenCalled()
  })

  test('ends a waiting launch when the genome view has no feature tracks', async () => {
    lgv.tracks = [{ type: 'AlignmentsTrack', adapter: 'bam' }]
    const model = connectedView()
    await settle()

    expect(String(model.error)).toMatch(/no feature tracks open/)
    expect(model.showLoading).toBe(false)
    expect(rpcCall).not.toHaveBeenCalled()
  })

  test('ends a waiting launch when the genome view failed', async () => {
    lgv.error = new Error('assembly hg38 not found')
    const model = connectedView()
    await settle()

    expect(String(model.error)).toMatch(
      /failed to load.*assembly hg38 not found/,
    )
    expect(model.showLoading).toBe(false)
  })

  test('is a notice beside an alignment in hand', async () => {
    lgv.tracks = []
    const model = linkedAlignment()
    await settle()

    expect(model.error).toBeUndefined()
    expect(model.showLoading).toBe(false)
    expect(model.notices).toEqual([
      expect.stringMatching(/no feature tracks open/),
    ])
  })
})

describe('a genome view still initializing', () => {
  test.each([
    ['before its assembly loads', { initialized: false }],
    ['while its launch opens tracks', { pendingLaunch: { tracks: ['genes'] } }],
  ])('is waited for %s', async (_, state) => {
    Object.assign(lgv, state, { tracks: [] })
    const model = connectedView()
    await settle()

    expect(model.error).toBeUndefined()
    expect(model.connectionError).toBeUndefined()
    expect(model.showLoading).toBe(true)
    expect(rpcCall).not.toHaveBeenCalled()
  })
})

describe('where a lookup searches', () => {
  test('feature tracks only, on screen before the whole chromosome', async () => {
    rpcCall.mockResolvedValue([])
    lgv.tracks = [
      { type: 'AlignmentsTrack', adapter: 'bam' },
      { type: 'FeatureTrack', adapter: 'genes' },
    ]
    lgv.dynamicBlocks.contentBlocks = [
      {
        assemblyName: 'hg38',
        refName: 'chr17',
        start: 7_661_778.6,
        end: 7_687_538.2,
      },
    ]
    connectedView()
    await settle()

    const asked = rpcCall.mock.calls.map(([, , args]) => [
      args.adapterConfig,
      args.regions,
    ])
    expect(asked).toEqual([
      [
        'genes',
        [
          {
            assemblyName: 'hg38',
            refName: 'chr17',
            start: 7_661_778,
            end: 7_687_539,
          },
        ],
      ],
      ['genes', lgv.displayedRegions],
    ])
  })
})

describe('two lookups in flight', () => {
  test('only the later one writes', async () => {
    const pending: ((feats: Feature[]) => void)[] = []
    rpcCall.mockImplementation(
      () =>
        new Promise<Feature[]>(res => {
          pending.push(res)
        }),
    )
    const model = connectedView()
    await settle()
    model.retryLaunch()
    await settle()
    expect(pending).toHaveLength(2)

    pending[1]!([transcript('NM_000546.6')])
    await settle()
    const written = model.connectedFeature
    pending[0]!([transcript('NM_000546.5')])
    await settle()

    expect(written).toMatchObject({ id: 'NM_000546.6' })
    expect(model.connectedFeature).toBe(written)
  })
})
