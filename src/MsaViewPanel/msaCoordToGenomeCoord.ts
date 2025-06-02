import { JBrowsePluginMsaViewModel } from './model'

export function msaCoordToGenomeCoord({
  model,
  coord: mouseCol,
}: {
  model: JBrowsePluginMsaViewModel
  coord: number
}) {
  const { querySeqName, transcriptToMsaMap } = model
  if (transcriptToMsaMap === undefined) {
    return undefined
  } else {
    const c = mouseCol
    const k1 = model.seqCoordToRowSpecificGlobalCoord(querySeqName, c) || 0
    const k2 = model.seqCoordToRowSpecificGlobalCoord(querySeqName, c + 1) || 0
    const { refName, p2g } = transcriptToMsaMap
    const s = p2g[k1]
    const e = p2g[k2]
    return s !== undefined && e !== undefined
      ? {
          refName,
          start: Math.min(s, e),
          end: Math.max(s, e),
        }
      : undefined
  }
}
