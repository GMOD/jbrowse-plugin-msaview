// @vitest-environment jsdom
import React from 'react'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import SubmitCancelActions from './SubmitCancelActions'
import { LAUNCH_PLACEMENT_KEY } from '../../utils/workspaces'

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

test('clicking it writes the placement the next launch will read', () => {
  render(
    <SubmitCancelActions
      model={trackModel(tiling)}
      onSubmit={() => {}}
      onCancel={() => {}}
    />,
  )
  toggle()!.click()
  expect(localStorage.getItem(LAUNCH_PLACEMENT_KEY)).toBe('stack')
  expect((toggle() as HTMLInputElement).checked).toBe(false)

  toggle()!.click()
  expect(localStorage.getItem(LAUNCH_PLACEMENT_KEY)).toBe('splitRight')
  expect((toggle() as HTMLInputElement).checked).toBe(true)
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
