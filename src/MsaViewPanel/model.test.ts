import { beforeEach, describe, expect, test, vi } from 'vitest'

import { doLaunchBlast } from './doLaunchBlast'
import stateModelFactory from './model'

// the launch autoruns are live on a real model, and a blastParams write is what
// wakes them -- so the search is mocked rather than sent to EBI
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

  test('dismisses by dropping it', () => {
    const model = view()
    model.setBlastParams({ ...BLAST_PARAMS })
    model.setError(new Error('EBI said no'))
    model.cancelLaunch()
    expect(model.blastParams).toBeUndefined()
    expect(model.error).toBeUndefined()
  })
})
