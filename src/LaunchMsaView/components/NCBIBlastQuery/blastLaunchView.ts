import { getSession } from '@jbrowse/core/util'

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
  getSession(view).addView('MsaView', {
    type: 'MsaView',
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
}: {
  newViewTitle: string
  view: LinearGenomeViewModel
  cached: CachedBlastResult
}) {
  getSession(view).addView('MsaView', {
    type: 'MsaView',
    displayName: newViewTitle,
    connectedViewId: view.id,
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
