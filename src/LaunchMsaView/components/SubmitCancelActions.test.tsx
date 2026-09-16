// @vitest-environment jsdom
import React from 'react'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { LAUNCH_PLACEMENT_KEY } from '../../utils/workspaces'
import SubmitCancelActions from './SubmitCancelActions'
import { LaunchPlacementProvider } from './launchPlacement'

import type { AbstractTrackModel } from '@jbrowse/core/util'

// getSession walks the MST tree, and this component only wants the two actions
// off the far end of that walk
vi.mock('@jbrowse/core/util', () => ({
  getSession: (model: { session: unknown }) => model.session,
}))

function trackModel(session: Record<string, unknown>) {
  return { session } as unknown as AbstractTrackModel
}

const tiling = { setUseWorkspaces() {}, setPendingMove() {} }

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

function toggle() {
  return screen.queryByRole('checkbox')
}

test('a host that can tile offers the choice, checked by default', () => {
  render(
    <SubmitCancelActions
      model={trackModel(tiling)}
      onSubmit={() => {}}
      onCancel={() => {}}
    />,
  )
  expect(toggle()).toBeTruthy()
  expect((toggle() as HTMLInputElement).checked).toBe(true)
  expect(localStorage.getItem(LAUNCH_PLACEMENT_KEY)).toBeNull()
})

// the box would do nothing on an embedded session, and a control that silently
// does nothing is worse than one that is not there
test('a host that cannot tile does not offer it', () => {
  render(
    <SubmitCancelActions
      model={trackModel({})}
      onSubmit={() => {}}
      onCancel={() => {}}
    />,
  )
  expect(toggle()).toBeNull()
  expect(screen.getByText('Submit')).toBeTruthy()
})

test('a panel that launches nothing passes no model, and gets no box', () => {
  render(<SubmitCancelActions onSubmit={() => {}} onCancel={() => {}} />)
  expect(toggle()).toBeNull()
})

test('submitting writes the placement the launch will read', () => {
  render(
    <SubmitCancelActions
      model={trackModel(tiling)}
      onSubmit={() => {}}
      onCancel={() => {}}
    />,
  )
  toggle()!.click()
  expect((toggle() as HTMLInputElement).checked).toBe(false)
  screen.getByText('Submit').click()
  expect(localStorage.getItem(LAUNCH_PLACEMENT_KEY)).toBe('stack')
})

// the box is a property of this launch until it is launched; a dialog the user
// backed out of should not have moved where every future one lands
test('cancelling leaves the stored placement alone', () => {
  render(
    <SubmitCancelActions
      model={trackModel(tiling)}
      onSubmit={() => {}}
      onCancel={() => {}}
    />,
  )
  toggle()!.click()
  screen.getByText('Cancel').click()
  expect(localStorage.getItem(LAUNCH_PLACEMENT_KEY)).toBeNull()
})

// a host with no tiling never shows the box, so submitting there must not
// overwrite the choice the user made on a host that does
test('a host that cannot tile writes nothing on submit', () => {
  localStorage.setItem(LAUNCH_PLACEMENT_KEY, 'splitRight')
  render(
    <SubmitCancelActions
      model={trackModel({})}
      onSubmit={() => {}}
      onCancel={() => {}}
    />,
  )
  screen.getByText('Submit').click()
  expect(localStorage.getItem(LAUNCH_PLACEMENT_KEY)).toBe('splitRight')
})

// every visited tab stays mounted, so each has an actions row of its own; with
// the answer held per row, ticking the box on one tab and submitting from
// another wrote the other tab's stale one
test('every tab in one dialog shares the answer', () => {
  render(
    <LaunchPlacementProvider>
      <div data-testid="tab-a">
        <SubmitCancelActions
          model={trackModel(tiling)}
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      </div>
      <div data-testid="tab-b">
        <SubmitCancelActions
          model={trackModel(tiling)}
          onSubmit={() => {}}
          onCancel={() => {}}
          submitLabel="Launch"
        />
      </div>
    </LaunchPlacementProvider>,
  )
  const boxes = screen.getAllByRole('checkbox')
  boxes[0]!.click()
  expect((boxes[1] as HTMLInputElement).checked).toBe(false)

  screen.getByText('Launch').click()
  expect(localStorage.getItem(LAUNCH_PLACEMENT_KEY)).toBe('stack')
})

test('a stored choice is what the box opens on', () => {
  localStorage.setItem(LAUNCH_PLACEMENT_KEY, 'stack')
  render(
    <SubmitCancelActions
      model={trackModel(tiling)}
      onSubmit={() => {}}
      onCancel={() => {}}
    />,
  )
  expect((toggle() as HTMLInputElement).checked).toBe(false)
})
