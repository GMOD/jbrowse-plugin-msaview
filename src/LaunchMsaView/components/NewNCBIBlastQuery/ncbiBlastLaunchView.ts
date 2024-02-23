import { Feature, getSession } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { JBrowsePluginMsaViewModel } from '../../../JBrowsePluginMsaView/model'

export function ncbiBlastLaunchView({
  newViewTitle,
  view,
  feature,
}: {
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
}) {
  return getSession(view).addView('JBrowsePluginMsaView', {
    type: 'JBrowsePluginMsaView',
    displayName: newViewTitle,
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
  }) as JBrowsePluginMsaViewModel
}

// treeAreaWidth: 200,
//   treeWidth: 100,
//   drawNodeBubbles: true,
//   labelsAlignRight: true,
//   showBranchLen: false,
//   colWidth: 10,
//   rowHeight: 12,
//   colorSchemeName: 'percent_identity_dynamic',
//   data,
