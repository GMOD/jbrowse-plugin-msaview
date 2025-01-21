import { Feature, getSession } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { JBrowsePluginMsaViewModel } from '../../../MsaViewPanel/model'

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
    treeAreaWidth: 250,
    treeWidth: 100,
    drawNodeBubbles: true,
    labelsAlignRight: true,
    colWidth: 10,
    rowHeight: 12,
    colorSchemeName: 'percent_identity_dynamic',
  }) as JBrowsePluginMsaViewModel
}
