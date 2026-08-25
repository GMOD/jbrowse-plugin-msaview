import { placeMsaView } from './workspaces'

import type { MsaViewPlacement } from './workspaces'
import type { AbstractSessionModel } from '@jbrowse/core/util'

/**
 * A launch, stated: what the view is, and where it goes. Everything but
 * `placement` is a react-msaview or plugin-model snapshot property, passed
 * through untouched so this never becomes a list that has to grow.
 */
export interface MsaViewLaunchSpec extends Record<string, unknown> {
  /** default `stack`, the only thing an embedded session can do */
  placement?: MsaViewPlacement
}

/**
 * The one place a launch adds an MSA view -- the dialog's four tabs, the Add
 * menu, and the `LaunchView-MsaView` extension point a session spec arrives on
 * all come through here. Each of them used to run its own `addView` and none
 * placed the result, which is how a launch from a gene feature landed stacked
 * under the very genome view it was connected to.
 */
export function launchMsaView(
  session: AbstractSessionModel,
  { placement = 'stack', ...snapshot }: MsaViewLaunchSpec,
) {
  const view = session.addView('MsaView', { type: 'MsaView', ...snapshot })
  placeMsaView(session, view.id, placement)
  return view
}
