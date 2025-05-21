import { AbstractSessionModel, Feature, FileLocation } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ungzip } from 'pako'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
  msaFileLocation,
  treeFileLocation,
  data,
}: {
  session: AbstractSessionModel
  userSelection: string
  newViewTitle: string
  view: LinearGenomeViewModel
  feature: Feature
  msaFileLocation?: FileLocation
  treeFileLocation?: FileLocation
  data?: { msa: string; tree?: string }
}) {
  let msaData: string
  let treeData: string | undefined

  // Handle different input methods
  if (data) {
    // Text input method
    msaData = data.msa
    treeData = data.tree
  } else if (msaFileLocation) {
    // File input method
    const msaLoc = await openLocation(msaFileLocation)
    const msaBlob = await msaLoc.readFile()
    msaData = new TextDecoder().decode(msaBlob)

    if (treeFileLocation) {
      const treeLoc = await openLocation(treeFileLocation)
      const treeBlob = await treeLoc.readFile()
      treeData = new TextDecoder().decode(treeBlob)
    }
  } else {
    // Default method - fetch from server
    msaData = await myfetch(
      `https://jbrowse.org/demos/msaview/knownCanonical/${userSelection}.mfa.gz`,
    )
  }

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
      msa: msaData,
      tree: treeData,
    },
    connectedViewId: view.id,
    connectedFeature: feature.toJSON(),
  })
}
