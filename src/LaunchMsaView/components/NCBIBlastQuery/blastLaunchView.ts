import { Feature, getSession } from '@jbrowse/core/util'

import type { JBrowsePluginMsaViewModel } from '../../../MsaViewPanel/model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function ncbiBlastLaunchView({
  newViewTitle,
  view,
  feature,
}: {
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
}) {
  return getSession(view).addView('MsaView', {
    type: 'MsaView',
    displayName: newViewTitle,
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
    drawNodeBubbles: true,
    colWidth: 10,
    rowHeight: 12,
  }) as JBrowsePluginMsaViewModel
}
