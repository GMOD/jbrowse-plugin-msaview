import { AbstractSessionModel, Feature, FileLocation } from '@jbrowse/core/util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function launchView({
  session,
  newViewTitle,
  view,
  feature,
  msaFileLocation,
  treeFileLocation,
  data,
}: {
  session: AbstractSessionModel
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
  msaFileLocation?: FileLocation
  treeFileLocation?: FileLocation
  data?: {
    msa: string
    tree?: string
  }
}) {
  session.addView('MsaView', {
    type: 'MsaView',
    displayName: newViewTitle,
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
    msaFileLocation,
    treeFileLocation,
    data,
  })
}
