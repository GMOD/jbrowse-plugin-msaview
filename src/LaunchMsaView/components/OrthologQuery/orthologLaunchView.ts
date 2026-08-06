import { getSession } from '@jbrowse/core/util'

import type { OrthologParams } from '../../../MsaViewPanel/model'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function orthologLaunchView({
  newViewTitle,
  view,
  feature,
  orthologParams,
}: {
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
  orthologParams: OrthologParams
}) {
  getSession(view).addView('MsaView', {
    type: 'MsaView',
    displayName: newViewTitle,
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
    drawNodeBubbles: true,
    colWidth: 10,
    rowHeight: 12,
    orthologParams,
  })
}
