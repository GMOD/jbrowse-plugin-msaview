import { getSession } from '@jbrowse/core/util'

import { launchMsaView } from '../../../utils/launchMsaView'
import { readLaunchPlacement } from '../../../utils/workspaces'

import type { BlastParams } from '../../../MsaViewPanel/model'
import type { CachedBlastResult } from '../../../utils/blastCache'
import type { Feature } from '@jbrowse/core/util'
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
  blastParams: BlastParams
}) {
  launchMsaView(getSession(view), {
    placement: readLaunchPlacement(),
    displayName: newViewTitle,
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
    drawNodeBubbles: true,
    colWidth: 10,
    rowHeight: 12,
    blastParams,
  })
}

export function blastLaunchViewFromCache({
  newViewTitle,
  view,
  cached,
  connectedFeature,
}: {
  newViewTitle: string
  view: LinearGenomeViewModel
  cached: CachedBlastResult
  connectedFeature?: ReturnType<Feature['toJSON']>
}) {
  launchMsaView(getSession(view), {
    placement: readLaunchPlacement(),
    displayName: newViewTitle,
    connectedViewId: view.id,
    connectedFeature,
    drawNodeBubbles: true,
    colWidth: 10,
    rowHeight: 12,
    data: {
      msa: cached.msa,
      tree: cached.tree,
      treeMetadata: cached.treeMetadata,
    },
  })
}
