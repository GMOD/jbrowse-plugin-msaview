import { beforeEach, describe, expect, test, vi } from 'vitest'

import { doLaunchBlast } from './doLaunchBlast'
import stateModelFactory from './model'

// the launch autoruns are live on a real model, and a blastParams write is what
// wakes them -- so the search is mocked rather than sent to EBI. The session is
// mocked for the same reason: the hover and highlight autoruns reach for one on
// every change, and there is no session around a bare model.
vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: () => ({ views: [], hovered: undefined }),
}))
vi.mock('./doLaunchBlast', () => ({ doLaunchBlast: vi.fn() }))
vi.mock('./msaDataStore', () => ({
  cleanupOldData: vi.fn(async () => {}),
  generateDataStoreId: vi.fn(),
  retrieveMsaData: vi.fn(),
  storeMsaData: vi.fn(),
}))

const BLAST_PARAMS = {
  searchProgram: 'blastp',
  blastDatabase: 'uniprotkb_swissprot',
  msaAlgorithm: 'clustalo',
  proteinSequence: 'MKV',
} as const

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(doLaunchBlast).mockReturnValue(new Promise(() => {}))
})

function view() {
  return stateModelFactory().create({ type: 'MsaView', id: 'msaview1' })
}

// The item lived in extraViewMenuItems(), which react-msaview stopped calling
// in v5.6.0 and is deleting: the view hamburger renders menuItems(), so a
// checkbox nobody can reach is a feature that silently left.
describe('view menu', () => {
  test('offers the zoom-to-base-level toggle', () => {
    expect(
      view()
        .menuItems()
        .map(f => ('label' in f ? f.label : '')),
    ).toContain('Zoom to base level on click?')
  })

  test('the toggle drives zoomToBaseLevel', () => {
    const model = view()
    const item = model.menuItems().at(-1) as {
      checked: boolean
      onClick: () => void
    }
    expect(item.checked).toBe(false)
    item.onClick()
    expect(model.zoomToBaseLevel).toBe(true)
  })
})

// the params ARE the request, and they outlive the failure: a view that only
// drew the error resubmitted the job on every reload and offered no way out
describe('a failed launch', () => {
  test('retries by re-stating the request', () => {
    const model = view()
    model.setBlastParams({ ...BLAST_PARAMS })
    expect(doLaunchBlast).toHaveBeenCalledTimes(1)

    model.setError(new Error('EBI said no'))
    model.retryLaunch()
    expect(model.error).toBeUndefined()
    expect(model.blastParams).toEqual(BLAST_PARAMS)
    expect(doLaunchBlast).toHaveBeenCalledTimes(2)
  })

  // the params used to be cleared on success to mark the request done, which
  // threw away the only durable statement of what the view is: a stored
  // alignment expires after 7 days and there was nothing left to run again
  test('a successful launch keeps its request and is not run twice', async () => {
    vi.mocked(doLaunchBlast).mockResolvedValue({
      msa: '>a\nMK\n>b\nMK',
      tree: '(a,b);',
      treeMetadata: '{}',
    })
    const model = view()
    model.setBlastParams({ ...BLAST_PARAMS })
    await new Promise(res => setTimeout(res, 0))

    expect(model.blastParams).toEqual(BLAST_PARAMS)
    expect(model.launchCompleted).toBe(true)
    expect(doLaunchBlast).toHaveBeenCalledTimes(1)

    vi.mocked(doLaunchBlast).mockReturnValue(new Promise(() => {}))
    model.setError(new Error('alignment is no longer in browser storage'))
    model.retryLaunch()

    expect(model.error).toBeUndefined()
    expect(model.launchCompleted).toBe(false)
    expect(doLaunchBlast).toHaveBeenCalledTimes(2)
  })

  // a session reopens with the request still on it, so the mark is what stops
  // the whole search running again unasked
  test('a restored session does not rerun a request it already ran', () => {
    stateModelFactory().create({
      type: 'MsaView',
      id: 'msaview2',
      blastParams: { ...BLAST_PARAMS },
      launchCompleted: true,
    })
    expect(doLaunchBlast).not.toHaveBeenCalled()
  })

  test('dismisses by dropping it', () => {
    const model = view()
    model.setBlastParams({ ...BLAST_PARAMS })
    model.setError(new Error('EBI said no'))
    model.cancelLaunch()
    expect(model.blastParams).toBeUndefined()
    expect(model.error).toBeUndefined()
  })
})

// react-msaview drops a snapshot document past 50kb and reports it through
// `unshareableData`, which the header renders as "Not in the link". An indexed
// view's alignment IS in the link -- its init names the block and processInit
// refetches it -- so that view answers the question itself.
describe('what the snapshot cannot carry', () => {
  const big = `>a\n${'M'.repeat(60_000)}`

  test('an indexed view says the host brings its alignment back', () => {
    const model = view()
    model.setInit({
      msaIndexedLocation: { uri: 'msa.fa.gz' },
      msaName: 'ENST1',
    })
    model.setMSA(big)
    expect(model.hostRestoresData).toBe(true)
    expect(model.unshareableData).toEqual([])
  })

  // the base getter reads a volatile a host flips to say it brings the data
  // back by its own means; overriding without it threw that switch away
  test('a host that says it carries the data is still believed', () => {
    const model = view()
    model.setMSA(big)
    expect(model.unshareableData).not.toEqual([])
    model.setHostCarriesData(true)
    expect(model.hostRestoresData).toBe(true)
    expect(model.unshareableData).toEqual([])
  })

  test('a pasted alignment is reported, because a link really does lose it', () => {
    const model = view()
    model.setMSA(big)
    expect(model.hostRestoresData).toBe(false)
    expect(model.unshareableData.map(d => d.what)).toEqual(['alignment'])
  })
})

// react-msaview's reset keeps only what is on its own preservedOnReset list,
// and a downstream property is never on it; its volatiles survive instead,
// which is the direction that carries the last file's state into the next one
describe('returning to the import form', () => {
  test('keeps what is about the view, not about the file', () => {
    const model = view()
    model.setDisplayName('BLAST - TP53')
    model.setMinimized(true)
    model.setZoomToBaseLevel(true)
    model.setMSA('>a\nMK')

    model.reset()

    expect(model.displayName).toBe('BLAST - TP53')
    expect(model.minimized).toBe(true)
    expect(model.zoomToBaseLevel).toBe(true)
    expect(model.dataInitialized).toBe(false)
  })

  test('clears the volatiles applySnapshot cannot reach, and the stored id', () => {
    const model = view()
    model.setDomainsRequested(true)
    model.setLastStoredData({ msa: '>a\nMK' })
    model.setDataStoreId('msa-1')
    model.setOwnsDataStoreRow(true)

    model.reset()

    expect(model.domainsRequested).toBe(false)
    expect(model.lastStoredData).toBeUndefined()
    expect(model.ownsDataStoreRow).toBe(false)
    expect(model.dataStoreId).toBeUndefined()
  })
})

test('the view asks react-msaview for its icon toolbar', () => {
  expect((view() as { embeddedMode?: boolean }).embeddedMode).toBe(true)
})

// two CDS on the reverse strand, so residue 3's codon straddles the intron
const reverseTranscript = {
  refName: 'chr1',
  strand: -1,
  start: 100,
  end: 208,
  subfeatures: [
    { type: 'CDS', start: 100, end: 107, phase: 0 },
    { type: 'CDS', start: 200, end: 208, phase: 0 },
  ],
}

describe('connectedDomains', () => {
  function domainView() {
    const model = stateModelFactory().create({
      type: 'MsaView',
      id: 'msaview1',
      data: { msa: '>QUERY\nMKV-LA\n>Mouse\nMKVQLA' },
      connectedFeature: reverseTranscript,
    })
    model.setAnnotations([
      {
        id: 'QUERY',
        accession: 'cd1',
        name: 'Hb beta-like',
        description: '',
        start: 1,
        end: 5,
      },
      {
        id: 'QUERY',
        accession: 'cd2',
        name: 'heme binding site',
        description: '',
        start: 2,
        end: 4,
      },
      {
        id: 'Mouse',
        accession: 'cd1',
        name: 'Hb beta-like',
        description: '',
        start: 1,
        end: 6,
      },
    ])
    return model
  }

  test('carries the query row domains in the colors the alignment draws', () => {
    const model = domainView()
    const fills = new Map(
      [...model.featureColors].map(([a, c]) => [
        `${a.id}:${a.accession}`,
        c.fill,
      ]),
    )
    expect(model.connectedDomains).toEqual([
      {
        name: 'Hb beta-like',
        accession: 'cd1',
        color: fills.get('QUERY:cd1'),
        regions: [
          { refName: 'chr1', start: 100, end: 107 },
          { refName: 'chr1', start: 200, end: 208 },
        ],
      },
      {
        name: 'heme binding site',
        accession: 'cd2',
        color: fills.get('QUERY:cd2'),
        regions: [
          { refName: 'chr1', start: 103, end: 107 },
          { refName: 'chr1', start: 200, end: 205 },
        ],
      },
    ])
  })

  test('follows the overlay and the legend filter', () => {
    const model = domainView()
    model.setFilter('cd2', false)
    expect(model.connectedDomains.map(d => d.accession)).toEqual(['cd1'])
    model.setShowDomains(false)
    expect(model.connectedDomains).toEqual([])
  })
})
