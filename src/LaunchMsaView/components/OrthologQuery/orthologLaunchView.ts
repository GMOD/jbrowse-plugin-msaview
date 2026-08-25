import { getSession } from '@jbrowse/core/util'

import { launchMsaView } from '../../../utils/launchMsaView'
import { readLaunchPlacement } from '../../../utils/workspaces'

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
  launchMsaView(getSession(view), {
    placement: readLaunchPlacement(),
    displayName: newViewTitle,
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
    drawNodeBubbles: true,
    colWidth: 10,
    rowHeight: 12,
    orthologParams,
  })
}
