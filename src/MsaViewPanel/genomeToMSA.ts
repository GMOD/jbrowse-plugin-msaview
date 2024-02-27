import { getSession, isContainedWithin } from '@jbrowse/core/util'
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
    const { coord: hoverCoord, refName: hoverRef } = hovered.hoverPosition
    for (const entry of transcriptToMsaMap) {
      const { featureStart, featureEnd, refName, proteinStart, strand } = entry
      if (
        refName === hoverRef &&
        isContainedWithin(hoverCoord - 1, hoverCoord, featureStart, featureEnd)
      ) {
        return model.relativePxToBp2(
          'QUERY',
          Math.floor(
            proteinStart +
              (strand === -1
                ? featureEnd - hoverCoord
                : hoverCoord - featureStart) /
                3,
          ) + 1,
        )
      }
    }
  }
  return undefined
}
