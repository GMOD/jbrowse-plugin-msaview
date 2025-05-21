import { Feature, getSession } from '@jbrowse/core/util'

import type { JBrowsePluginMsaViewModel } from '../../../MsaViewPanel/model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function ncbiBlastLaunchView({
  newViewTitle,
  view,
  feature,
  data,
}: {
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
  data: { msa: string; tree: string }
}) {
  const msaView = getSession(view).addView('MsaView', {
    type: 'MsaView',
    displayName: newViewTitle,
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
    treeAreaWidth: 250,
    treeWidth: 100,
    drawNodeBubbles: true,
    labelsAlignRight: true,
    colWidth: 10,
    rowHeight: 12,
    colorSchemeName: 'percent_identity_dynamic',
    data,
  }) as JBrowsePluginMsaViewModel

  return msaView
}
