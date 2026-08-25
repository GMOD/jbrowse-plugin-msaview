import { placeMsaView } from './workspaces'

import type { MsaViewPlacement } from './workspaces'
import type { AbstractSessionModel } from '@jbrowse/core/util'

/**
 * A launch, stated: what the view is, and where it goes.
 *
 * Everything except `placement` is a react-msaview snapshot property or the
 * plugin model's own, passed through untouched — the view restores them
 * natively, so this stays a pass-through rather than a list that has to grow
 * every time react-msaview gains a property.
 */
export interface MsaViewLaunchSpec extends Record<string, unknown> {
  /** default `stack`, which is what every host including an embedded one does */
  placement?: MsaViewPlacement
}

/**
 * The one place a launch adds an MSA view.
 *
 * Every entry point goes through here — the dialog's four tabs, the
 * `LaunchView-MsaView` extension point a session spec arrives on — so
 * *where the view lands* is one decision made once, from a value the caller
 * states. Before this, five call sites each ran their own `addView` and none of
 * them placed the view at all, which is why a launch from a gene feature landed
 * stacked under the genome view it was connected to even in a tiled workspace.
 */
export function launchMsaView(
  session: AbstractSessionModel,
  { placement = 'stack', ...snapshot }: MsaViewLaunchSpec,
) {
  const view = session.addView('MsaView', { type: 'MsaView', ...snapshot })
  placeMsaView(session, view.id, placement)
  return view
}
