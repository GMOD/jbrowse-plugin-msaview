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
  const { querySeqName, transcriptToMsaMap, connectedView } = model
  if (
    connectedView?.initialized &&
    transcriptToMsaMap &&
    checkHovered(hovered)
  ) {
    const { coord: hoverCoord } = hovered.hoverPosition
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
