import type { AbstractSessionModel } from '@jbrowse/core/util'

/**
 * Where a launched MSA view lands. Every launch names one of these and stops
 * there, so a host that arranges views differently is one function to teach.
 *
 *   stack       append below whatever is on screen
 *   splitRight  its own cell to the right, beside the view it is connected to
 *   newTab      its own tab in the current cell
 */
export type MsaViewPlacement = 'stack' | 'splitRight' | 'newTab'

const PLACEMENTS: MsaViewPlacement[] = ['stack', 'splitRight', 'newTab']

/**
 * What the dialog does unasked. Side-by-side, because a launch from a gene
 * feature sets `connectedViewId`: the pair shares a hover and a highlight, and
 * reads as a split. A session spec defaults to `stack` instead.
 */
export const DEFAULT_LAUNCH_PLACEMENT: MsaViewPlacement = 'splitRight'

export const LAUNCH_PLACEMENT_KEY = 'msaView-launchPlacement'

/**
 * The session actions that place a view in a tiled workspace. Only jbrowse-web
 * and desktop have them, so feature-detect rather than import.
 */
interface SessionWithMoves {
  moveViewToNewTab: (viewId: string) => unknown
  moveViewToSplit: (viewId: string, direction: 'row' | 'column') => unknown
}

// a host from before the workspace was always on
interface SessionWithWorkspaces {
  setUseWorkspaces: (useWorkspaces: boolean) => void
  setPendingMove: (move: {
    type: 'newTab' | 'splitRight'
    viewId: string
  }) => void
}

function hasAction(session: AbstractSessionModel, name: string) {
  return (
    name in session &&
    typeof (session as unknown as Record<string, unknown>)[name] === 'function'
  )
}

// Warned at most once. This is a property of the host, so the answer is the
// same on every launch and a dialog the user reopens should not stack up noise.
let warnedPartial = false

export function resetWorkspacesWarning() {
  warnedPartial = false
}

/**
 * Whether this host can honor anything other than `stack`. Silent: the dialog
 * asks on every render, and only a launch is worth warning about.
 */
export function sessionSupportsPlacement(session: AbstractSessionModel) {
  return (
    isSessionWithMoves(session) ||
    (hasAction(session, 'setUseWorkspaces') &&
      hasAction(session, 'setPendingMove'))
  )
}

function isSessionWithMoves(
  session: AbstractSessionModel,
): session is AbstractSessionModel & SessionWithMoves {
  return (
    hasAction(session, 'moveViewToNewTab') &&
    hasAction(session, 'moveViewToSplit')
  )
}

function isSessionWithWorkspaces(
  session: AbstractSessionModel,
): session is AbstractSessionModel & SessionWithWorkspaces {
  const canEnable = hasAction(session, 'setUseWorkspaces')
  const canPlace = hasAction(session, 'setPendingMove')

  // Missing BOTH is an embedded session, with nothing to ask for. Missing ONE
  // is a host that moved the action out from under us: protein3d once stopped
  // tiling silently for weeks when jbrowse-web folded `setPendingMove` into its
  // layout `init`.
  if (canEnable !== canPlace && !warnedPartial) {
    warnedPartial = true
    console.warn(
      `jbrowse-plugin-msaview: this session supports workspaces but not ` +
        `${canPlace ? 'setUseWorkspaces' : 'setPendingMove'}, so the MSA view ` +
        `was stacked instead of tiled: the session API moved and the plugin ` +
        `needs updating to match.`,
    )
  }
  return canEnable && canPlace
}

/**
 * Put a freshly added view where the launch said to. `stack` is a placement
 * rather than the absence of one, so no caller has to ask what host it is on.
 */
export function placeMsaView(
  session: AbstractSessionModel,
  viewId: string,
  placement: MsaViewPlacement,
) {
  if (placement === 'stack') {
    return
  }
  if (isSessionWithMoves(session)) {
    if (placement === 'newTab') {
      session.moveViewToNewTab(viewId)
    } else {
      session.moveViewToSplit(viewId, 'row')
    }
  } else if (isSessionWithWorkspaces(session)) {
    session.setPendingMove({ type: placement, viewId })
    session.setUseWorkspaces(true)
  }
}

function isPlacement(value: unknown): value is MsaViewPlacement {
  return PLACEMENTS.includes(value as MsaViewPlacement)
}

/**
 * The dialog's own remembered choice — not the host's preferences system, which
 * records whether the user likes workspaces and does not exist everywhere.
 */
export function readLaunchPlacement(): MsaViewPlacement {
  try {
    const stored = globalThis.localStorage.getItem(LAUNCH_PLACEMENT_KEY)
    return isPlacement(stored) ? stored : DEFAULT_LAUNCH_PLACEMENT
  } catch (error) {
    console.error(error)
    return DEFAULT_LAUNCH_PLACEMENT
  }
}

export function writeLaunchPlacement(placement: MsaViewPlacement) {
  try {
    globalThis.localStorage.setItem(LAUNCH_PLACEMENT_KEY, placement)
  } catch (error) {
    console.error(error)
  }
}
