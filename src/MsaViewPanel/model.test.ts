import { describe, expect, test } from 'vitest'

import stateModelFactory from './model'

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
