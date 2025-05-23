import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function ensemblGeneTreeLaunchView({
  session,
  newViewTitle,
  view,
  feature,
  data,
}: {
  session: AbstractSessionModel
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
  data: {
    tree: string
    msa: string
    treeMetadata: string
  }
}) {
  session.addView('MsaView', {
    type: 'MsaView',
    displayName: newViewTitle,
    colWidth: 10,
    rowHeight: 12,
    data,
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
  })
}
