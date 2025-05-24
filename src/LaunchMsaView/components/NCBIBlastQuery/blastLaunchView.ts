import { Feature, getSession } from '@jbrowse/core/util'

import type { JBrowsePluginMsaViewModel } from '../../../MsaViewPanel/model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function blastLaunchView({
  newViewTitle,
  view,
  feature,
  blastParams,
}: {
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
  blastParams: Record<string, unknown>
}) {
  return getSession(view).addView('MsaView', {
    type: 'MsaView',
    displayName: newViewTitle,
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
    drawNodeBubbles: true,
    colWidth: 10,
    rowHeight: 12,
    blastParams,
  }) as JBrowsePluginMsaViewModel
}
