import { getSession } from '@jbrowse/core/util'

import type { Feature, FileLocation } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function launchView({
  newViewTitle,
  view,
  feature,
  msaFilehandle,
  treeFilehandle,
  querySeqName,
  data,
}: {
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
  getSession(view).addView('MsaView', {
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
