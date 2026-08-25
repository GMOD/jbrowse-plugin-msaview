import { getSession } from '@jbrowse/core/util'

import { launchMsaView } from '../../../utils/launchMsaView'
import { readLaunchPlacement } from '../../../utils/workspaces'

import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function preCalculatedLaunchView({
  newViewTitle,
  view,
  feature,
  data,
  querySeqName,
}: {
  data: { msa: string }
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
  querySeqName: string
}) {
  launchMsaView(getSession(view), {
    placement: readLaunchPlacement(),
    displayName: newViewTitle,
    treeAreaWidth: 200,
    querySeqName,
    treeWidth: 100,
    drawNodeBubbles: false,
    labelsAlignRight: true,
    showBranchLen: false,
    colWidth: 10,
    rowHeight: 12,
    colorSchemeName: 'percent_identity_dynamic',
    data,
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
  })
}
