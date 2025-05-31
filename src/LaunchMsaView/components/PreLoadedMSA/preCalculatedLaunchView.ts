import { AbstractSessionModel, Feature } from '@jbrowse/core/util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export async function preCalculatedLaunchView({
  session,
  newViewTitle,
  view,
  feature,
  data,
}: {
  data: { msa: string }
  session: AbstractSessionModel
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
}) {
  session.addView('MsaView', {
    type: 'MsaView',
    displayName: newViewTitle,
    treeAreaWidth: 200,
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
