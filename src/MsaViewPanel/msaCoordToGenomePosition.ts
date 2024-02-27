import { doesIntersect2 } from '@jbrowse/core/util'

// locals
import { JBrowsePluginMsaViewModel } from './model'

export function msaCoordToGenomePosition({
  model,
  coord: mouseCol,
}: {
  model: JBrowsePluginMsaViewModel
  coord: number
}) {
  const { transcriptToMsaMap, connectedView } = model
  if (
    !connectedView?.initialized ||
    mouseCol === undefined ||
    transcriptToMsaMap === undefined
  ) {
    return
  }
  for (const entry of transcriptToMsaMap) {
    const {
      featureStart,
      featureEnd,
      refName,
      proteinStart,
      proteinEnd,
      strand,
    } = entry
    const c = mouseCol - 1
    const k1 = model.relativePxToBp('QUERY', c) || 0
    const k2 = model.relativePxToBp('QUERY', c + 1) || 0
    if (doesIntersect2(proteinStart, proteinEnd, k1, k2)) {
      // does not take into account phase, so 'incomplete CDS' might
      // be buggy
      const ret = Math.round((k1 - proteinStart) * 3)
      const rev = strand === -1
      const s = rev ? featureEnd - ret : featureStart + ret
      const e = rev ? featureEnd - ret - 3 : featureStart + ret + 3
      return {
        assemblyName: 'hg38',
        refName,
        start: Math.min(s, e),
        end: Math.max(s, e),
      }
    }
  }
  return undefined
}
