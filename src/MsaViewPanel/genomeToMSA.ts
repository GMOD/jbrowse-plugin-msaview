import { getSession } from '@jbrowse/core/util'

import { hasHoverPosition } from './util'

import type { JBrowsePluginMsaViewModel } from './model'

export function genomeToMSA({ model }: { model: JBrowsePluginMsaViewModel }) {
  const { hovered } = getSession(model)
  const { querySeqName, transcriptToMsaMap, connectedView, mafRegion } = model

  if (!connectedView?.initialized || !hasHoverPosition(hovered)) {
    return undefined
  }

  const { coord, refName } = hovered.hoverPosition

  // hoverPosition.coord is a 1-based display coordinate (core's pxToBp adds the
  // +1), while g2p and mafRegion are keyed by 0-based genome position
  const genomePos = coord - 1

  if (mafRegion) {
    if (
      refName !== mafRegion.refName ||
      !connectedView.assemblyNames.includes(mafRegion.assemblyName) ||
      genomePos < mafRegion.start ||
      genomePos >= mafRegion.end
    ) {
      return undefined
    }
    return model.seqPosToVisibleCol(querySeqName, genomePos - mafRegion.start)
  }

  // session.hovered is global -- set by whichever LinearGenomeView the cursor
  // was last over, on any assembly -- so the refName gate is load bearing:
  // without it the same numeric coordinate on an unrelated chromosome matches a
  // g2p key and lights up a column for a different locus
  if (refName === transcriptToMsaMap?.refName) {
    const seqPos = transcriptToMsaMap.g2p[genomePos]
    if (seqPos !== undefined) {
      return model.seqPosToVisibleCol(querySeqName, seqPos)
    }
  }

  return undefined
}
