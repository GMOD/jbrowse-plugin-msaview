import { getSession } from '@jbrowse/core/util'

import { launchMsaView } from '../../../utils/launchMsaView'
import { readLaunchPlacement } from '../../../utils/workspaces'

import type { Feature, FileLocation } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function launchView({
  newViewTitle,
  view,
  feature,
  msaFilehandle,
  treeFilehandle,
  querySeqName,
  querySeqOffset,
  data,
}: {
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
  msaFilehandle?: FileLocation
  treeFilehandle?: FileLocation
  querySeqName?: string
  /** transcript residues before the query row's first residue */
  querySeqOffset?: number
  data?: {
    msa: string
    tree?: string
  }
}) {
  launchMsaView(getSession(view), {
    placement: readLaunchPlacement(),
    displayName: newViewTitle,
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
    msaFilehandle,
    treeFilehandle,
    querySeqName,
    querySeqOffset,
    data,
  })
}
