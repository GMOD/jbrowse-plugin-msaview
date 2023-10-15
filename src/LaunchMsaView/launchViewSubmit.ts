import { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { ungzip } from 'pako'

export async function launchView({
  userSelection,
  session,
  newViewTitle,
  view: connectedView,
  feature,
}: {
  session: AbstractSessionModel
  userSelection: string
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
}) {
  const res = await fetch(
    `https://jbrowse.org/demos/msaview/knownCanonical/${userSelection}.mfa.gz`,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${await res.text()}`)
  }
  const data = await res.arrayBuffer()
  const d = new TextDecoder().decode(ungzip(data))
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
    treeFilehandle: {
      uri: 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz100way/hg38.100way.nh',
    },
    data: {
      msa: d,
    },
    connectedViewId: connectedView.id,
    connectedFeature: feature.toJSON(),
  })
}
