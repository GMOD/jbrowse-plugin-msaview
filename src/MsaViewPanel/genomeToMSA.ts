import { getSession } from '@jbrowse/core/util'

import { hasHoverPosition } from './util'

import type { JBrowsePluginMsaViewModel } from './model'

export function genomeToMSA({ model }: { model: JBrowsePluginMsaViewModel }) {
  const { hovered } = getSession(model)
  const { querySeqName, transcriptToMsaMap, connectedView, mafRegion } = model

  if (!connectedView?.initialized || !hasHoverPosition(hovered)) {
    return undefined
  }

  const { coord: hoverCoord, refName } = hovered.hoverPosition

  if (mafRegion) {
    if (
      refName !== mafRegion.refName ||
      !connectedView.assemblyNames.includes(mafRegion.assemblyName) ||
      hoverCoord < mafRegion.start ||
      hoverCoord >= mafRegion.end
    ) {
      return undefined
    }
    return model.seqPosToVisibleCol(querySeqName, hoverCoord - mafRegion.start)
  }

  if (transcriptToMsaMap) {
    const seqPos = transcriptToMsaMap.g2p[hoverCoord]
    if (seqPos !== undefined) {
      return model.seqPosToVisibleCol(querySeqName, seqPos)
    }
  }

  return undefined
}
