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

vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: () => ({
    views: [lgv],
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
vi.mock('../LaunchMsaView/components/calculateProteinSequence', () => ({
  getProteinSequenceFromFeature: vi.fn(() => 'MKV'),
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

function transcript(id: string) {
  const json = { uniqueId: id, id, refName: 'chr17', start: 0, end: 9 }
  return {
    id: () => id,
    get: (key: string) => (key === 'id' || key === 'name' ? id : undefined),
    toJSON: () => json,
  } as unknown as Feature
}

const settle = () => new Promise(res => setTimeout(res, 0))

function connectedView() {
  return stateModelFactory().create({
    type: 'MsaView',
    id: 'msa1',
    connectedViewId: 'lgv1',
    connectedTranscript: 'NM_000546.6',
    blastParams: {
      searchProgram: 'blastp',
      blastDatabase: 'uniprotkb_swissprot',
      msaAlgorithm: 'clustalo',
    },
  })
}

beforeEach(() => {
  rpcCall.mockReset()
  lgv.tracks = [{ type: 'FeatureTrack', adapter: 'genes' }]
  lgv.dynamicBlocks.contentBlocks = []
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
