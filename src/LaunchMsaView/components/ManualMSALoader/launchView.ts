import { AbstractSessionModel, Feature, FileLocation } from '@jbrowse/core/util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function launchView({
  session,
  newViewTitle,
  view,
  feature,
  msaFilehandle,
  treeFilehandle,
  querySeqName,
  data,
}: {
  session: AbstractSessionModel
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
  msaFilehandle?: FileLocation
  treeFilehandle?: FileLocation
  querySeqName?: string
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
    msaFilehandle,
    treeFilehandle,
    querySeqName,
    data,
  })
}
