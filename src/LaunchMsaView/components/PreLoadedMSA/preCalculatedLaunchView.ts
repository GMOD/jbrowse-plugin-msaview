import { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { ungzip } from 'pako'

async function myfetch(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${await res.text()}`)
  }
  const data = await res.arrayBuffer()
  return new TextDecoder().decode(ungzip(data))
}

export async function preCalculatedLaunchView({
  userSelection,
  session,
  newViewTitle,
  view,
  feature,
}: {
  session: AbstractSessionModel
  userSelection: string
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
}) {
  const d = await myfetch(
    `https://jbrowse.org/demos/msaview/knownCanonical/${userSelection}.mfa.gz`,
  )

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
    treeMetadataFilehandle: {
      uri: 'https://s3.amazonaws.com/jbrowse.org/demos/app/species.json',
    },
    data: {
      msa: d,
    },
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
  })
}
