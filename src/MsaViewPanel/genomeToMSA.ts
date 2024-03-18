import { getSession } from '@jbrowse/core/util'
import { checkHovered } from './util'
import { JBrowsePluginMsaViewModel } from './model'

export function genomeToMSA({ model }: { model: JBrowsePluginMsaViewModel }) {
  const { hovered } = getSession(model)
  const { transcriptToMsaMap, connectedView } = model
  if (
    connectedView?.initialized &&
    transcriptToMsaMap &&
    checkHovered(hovered)
  ) {
    const { coord: hoverCoord } = hovered.hoverPosition
    const { g2p } = transcriptToMsaMap
    const ret = g2p[hoverCoord]
    if (ret !== undefined) {
      return model.seqCoordToRowSpecificGlobalCoord('QUERY', ret + 1)
    }
  }
  return undefined
}
