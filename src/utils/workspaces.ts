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
    hasAction(session, 'setUseWorkspaces') &&
    hasAction(session, 'setPendingMove')
  )
}

function isSessionWithWorkspaces(
  session: AbstractSessionModel,
): session is AbstractSessionModel & SessionWithWorkspaces {
  const canEnable = hasAction(session, 'setUseWorkspaces')
  const canPlace = hasAction(session, 'setPendingMove')

  // Missing BOTH is an embedded session: it has no workspaces, there is nothing
  // to ask for, and silence is the right answer.
  //
  // Missing ONE is a host that has workspaces but places views some other way,
  // and silence there is how the same feature broke in jbrowse-plugin-protein3d
  // — jbrowse-web folded `setPendingMove` into its layout `init`, the guard went
  // false, and the plugin simply stopped asking: no error, no missing feature,
  // two views quietly stacking, nobody noticed for weeks. Feature detection
  // cannot ask a host to announce a change, but it can tell "not supported here"
  // from "supported, and gone".
  //
  // Two very different hosts produce this one shape and nothing on the session
  // tells them apart, so the message carries both rather than a guess:
  //
  // - releases through v4.3.0, where placement is `setPendingMoveToSplitRight`,
  //   a module function in @jbrowse/app-core rather than a session action.
  //   Nothing is wrong and nothing needs fixing
  // - a newer host that moved the action out from under us, which is the
  //   regression this warning exists to catch
  //
  // Do not quiet the first case by sniffing the version. The alarm is only worth
  // having if it fires on a shape it cannot explain, and these two are identical.
  if (canEnable !== canPlace && !warnedPartial) {
    warnedPartial = true
    console.warn(
      `jbrowse-plugin-msaview: this session supports workspaces but not ` +
        `${canPlace ? 'setUseWorkspaces' : 'setPendingMove'}, so the MSA view ` +
        `was stacked instead of tiled. Expected on releases through v4.3.0, ` +
        `which place views through @jbrowse/app-core instead; on a newer host ` +
        `it means the session API moved and the plugin needs updating to match.`,
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
  if (placement === 'stack' || !isSessionWithWorkspaces(session)) {
    return
  }
  session.setPendingMove({ type: placement, viewId })
  // Session-scoped: turning workspaces on for this session leaves the user's
  // own default alone, which is what `setUseWorkspaces` (as against
  // `setUseWorkspacesPreference`) is for.
  session.setUseWorkspaces(true)
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
