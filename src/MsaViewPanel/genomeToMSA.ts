import { getSession } from '@jbrowse/core/util'

import { JBrowsePluginMsaViewModel } from './model'
import { checkHovered } from './util'

/**
 * Convert a genome coordinate from session.hovered to a visible MSA column.
 *
 * @param model - The MSA view model
 * @returns The visible column index, or undefined if no mapping exists
 */
export function genomeToMSA({ model }: { model: JBrowsePluginMsaViewModel }) {
  const { hovered } = getSession(model)
  const { querySeqName, transcriptToMsaMap, connectedView, mafRegion } = model

  if (!connectedView?.initialized || !checkHovered(hovered)) {
    return undefined
  }

  const { coord: hoverCoord, refName } = hovered.hoverPosition

  // Handle MAF region mapping
  if (mafRegion) {
    // Check if the hover is on the same refName as the MAF region
    if (refName !== mafRegion.refName) {
      return undefined
    }
    // Check if we're on the same assembly (if assembly info is available)
    const viewAssemblies = connectedView.assemblyNames
    if (!viewAssemblies.includes(mafRegion.assemblyName)) {
      return undefined
    }
    // Check if the hover coordinate is within the MAF region
    if (hoverCoord < mafRegion.start || hoverCoord >= mafRegion.end) {
      return undefined
    }
    // Calculate the ungapped position relative to the region start
    const ungappedPos = hoverCoord - mafRegion.start
    // Convert to visible column using the query sequence
    return model.seqPosToVisibleCol(querySeqName, ungappedPos)
  }

  // Handle transcript mapping (original behavior)
  if (transcriptToMsaMap) {
    const { g2p } = transcriptToMsaMap
    // g2p maps genome coordinate to sequence position (0-based)
    const seqPos = g2p[hoverCoord]
    if (seqPos !== undefined) {
      // Convert sequence position to visible column
      return model.seqPosToVisibleCol(querySeqName, seqPos)
    }
  }

  return undefined
}
