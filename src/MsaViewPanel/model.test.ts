import { beforeEach, describe, expect, test, vi } from 'vitest'

import { doLaunchBlast } from './doLaunchBlast'
import stateModelFactory from './model'
import { deleteMsaData } from './msaDataStore'

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
  deleteMsaData: vi.fn(async () => {}),
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

  test('dismisses by dropping it', () => {
    const model = view()
    model.setBlastParams({ ...BLAST_PARAMS })
    model.setError(new Error('EBI said no'))
    model.cancelLaunch()
    expect(model.blastParams).toBeUndefined()
    expect(model.error).toBeUndefined()
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

  test('clears the volatiles applySnapshot cannot reach, and the stored row', () => {
    const model = view()
    model.setDomainsRequested(true)
    model.setLastStoredData({ msa: '>a\nMK' })
    model.setDataStoreId('msa-1')

    model.reset()

    expect(model.domainsRequested).toBe(false)
    expect(model.lastStoredData).toBeUndefined()
    expect(model.dataStoreId).toBeUndefined()
    expect(deleteMsaData).toHaveBeenCalledWith('msa-1')
  })
})
