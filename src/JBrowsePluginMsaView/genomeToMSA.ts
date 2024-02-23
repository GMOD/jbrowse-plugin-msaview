import { getSession, isContainedWithin } from '@jbrowse/core/util'
import { checkHovered } from './util'
import { ExtendedReactMSAViewModel } from './ExtendedReactMSAViewModel'

export function genomeToMSA({
  model,
}: {
  model: ExtendedReactMSAViewModel
}): number | undefined {
  const session = getSession(self)
  const { transcriptToMsaMap, connectedView } = model
  if (!connectedView?.initialized) {
    return undefined
  }
  const { hovered } = session

  if (!checkHovered(hovered)) {
    return undefined
  }

  const { hoverPosition } = hovered
  const { coord: hoverCoord, refName: hoverRef } = hoverPosition
  for (const entry of transcriptToMsaMap) {
    const { featureStart, featureEnd, refName, proteinStart, strand } = entry

    if (
      refName === hoverRef &&
      isContainedWithin(hoverCoord - 1, hoverCoord, featureStart, featureEnd)
    ) {
      const ret =
        Math.floor(
          proteinStart +
            (strand === -1
              ? featureEnd - hoverCoord
              : hoverCoord - featureStart) /
              3,
        ) + 1
      return model.relativePxToBp2('QUERY', ret)
    }
  }
  return undefined
}
