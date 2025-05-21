import { AbstractSessionModel, Feature, FileLocation } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ungzip } from 'pako'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export async function preCalculatedLaunchView({
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
    treeAreaWidth: 200,
    treeWidth: 100,
    drawNodeBubbles: false,
    labelsAlignRight: true,
    showBranchLen: false,
    colWidth: 10,
    rowHeight: 12,
    colorSchemeName: 'percent_identity_dynamic',
    msaFileLocation,
    treeFileLocation,
    data,
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
  })
}
