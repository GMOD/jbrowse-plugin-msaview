import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { launchMsaView } from './launchMsaView'
import {
  DEFAULT_LAUNCH_PLACEMENT,
  LAUNCH_PLACEMENT_KEY,
  placeMsaView,
  readLaunchPlacement,
  resetWorkspacesWarning,
  sessionSupportsPlacement,
  writeLaunchPlacement,
} from './workspaces'

import type { AbstractSessionModel } from '@jbrowse/core/util'

interface Recorded {
  moves: unknown[]
  workspaces: boolean[]
  added: { type: string; snapshot: Record<string, unknown> }[]
}

function makeSession({
  canPlace = true,
  canEnable = true,
}: { canPlace?: boolean; canEnable?: boolean } = {}) {
  const recorded: Recorded = { moves: [], workspaces: [], added: [] }
  const session: Record<string, unknown> = {
    addView(type: string, snapshot: Record<string, unknown>) {
      recorded.added.push({ type, snapshot })
      return { id: `view-${recorded.added.length}` }
    },
  }
  if (canPlace) {
    session.setPendingMove = (move: unknown) => recorded.moves.push(move)
  }
  if (canEnable) {
    session.setUseWorkspaces = (on: boolean) => recorded.workspaces.push(on)
  }
  return { session: session as unknown as AbstractSessionModel, recorded }
}

// node has no localStorage, and the plugin runs in a browser -- a Map-backed
// stub keeps read/write round-tripping without pulling in jsdom
function stubStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  })
}

beforeEach(() => {
  resetWorkspacesWarning()
  stubStorage()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('stack places nothing, on a host that could tile', () => {
  const { session, recorded } = makeSession()
  placeMsaView(session, 'view-1', 'stack')
  expect(recorded.moves).toEqual([])
  expect(recorded.workspaces).toEqual([])
})

test('splitRight asks for the move, then turns workspaces on', () => {
  const { session, recorded } = makeSession()
  placeMsaView(session, 'view-1', 'splitRight')
  expect(recorded.moves).toEqual([{ type: 'splitRight', viewId: 'view-1' }])
  expect(recorded.workspaces).toEqual([true])
})

test('newTab is the same path with the other move type', () => {
  const { session, recorded } = makeSession()
  placeMsaView(session, 'view-1', 'newTab')
  expect(recorded.moves).toEqual([{ type: 'newTab', viewId: 'view-1' }])
})

// an embedded session has no workspaces at all, so there is nothing to report
test('a session with neither action is a silent no-op', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { session, recorded } = makeSession({
    canPlace: false,
    canEnable: false,
  })
  placeMsaView(session, 'view-1', 'splitRight')
  expect(recorded.moves).toEqual([])
  expect(warn).not.toHaveBeenCalled()
  expect(sessionSupportsPlacement(session)).toBe(false)
})

// the shape that broke jbrowse-plugin-protein3d silently: workspaces are there,
// the action this plugin reaches for is not
test('a half-supported host warns once and stacks', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { session, recorded } = makeSession({ canPlace: false })
  placeMsaView(session, 'view-1', 'splitRight')
  placeMsaView(session, 'view-2', 'splitRight')
  expect(recorded.moves).toEqual([])
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn.mock.calls[0]?.[0]).toContain('setPendingMove')
})

test('the dialog default is side-by-side, and a junk value falls back to it', () => {
  expect(DEFAULT_LAUNCH_PLACEMENT).toBe('splitRight')
  expect(readLaunchPlacement()).toBe('splitRight')
  localStorage.setItem(LAUNCH_PLACEMENT_KEY, 'sideways')
  expect(readLaunchPlacement()).toBe('splitRight')
  writeLaunchPlacement('stack')
  expect(readLaunchPlacement()).toBe('stack')
})

test('launchMsaView defaults to stack, so a spec written before placement existed is unchanged', () => {
  const { session, recorded } = makeSession()
  launchMsaView(session, { data: { msa: '>a\nAC' } })
  expect(recorded.added).toEqual([
    { type: 'MsaView', snapshot: { type: 'MsaView', data: { msa: '>a\nAC' } } },
  ])
  expect(recorded.moves).toEqual([])
})

// placement is a launch instruction, not view state: MST would drop it from the
// snapshot without a word, and the view would land stacked with nothing said
test('launchMsaView keeps placement out of the view snapshot', () => {
  const { session, recorded } = makeSession()
  launchMsaView(session, { placement: 'splitRight', colWidth: 10 })
  expect(recorded.added[0]?.snapshot).toEqual({ type: 'MsaView', colWidth: 10 })
  expect(recorded.moves).toEqual([{ type: 'splitRight', viewId: 'view-1' }])
})
